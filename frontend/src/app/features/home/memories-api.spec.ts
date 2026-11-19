import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom } from 'rxjs';

import { Memory } from './memory';
import { MemoryAnswer } from './memory-answer';
import { MemoriesApi } from './memories-api';
import { createSampleMemories } from './sample-memories';
import { SearchAnswer, SearchResult } from './search-result';

const MEMORIES_URL = '/api/v1/memories';

function setUp(): { service: MemoriesApi; backend: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  return { service: TestBed.inject(MemoriesApi), backend: TestBed.inject(HttpTestingController) };
}

function textMemory(title: string): Memory {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    title,
    raw_text: title,
    attachments: [],
    summary: null,
    link_preview: null,
    source_memory: null,
    created_at: '2026-11-17T10:00:00Z',
  };
}

describe('MemoriesApi backend calls', () => {
  let service: MemoriesApi;
  let backend: HttpTestingController;

  beforeEach(() => ({ service, backend } = setUp()));
  afterEach(() => backend.verify());

  it('sends the typed text and every file to the backend as one form', () => {
    const photo = new File(['x'], 'ticket.png', { type: 'image/png' });
    const pdf = new File(['xy'], 'bill.pdf', { type: 'application/pdf' });
    const saved = textMemory('Concert night');
    let result: Memory | undefined;

    service
      .createMemory({ text: '  Concert night  ', files: [photo, pdf] })
      .subscribe((memory) => (result = memory));

    const request = backend.expectOne({ method: 'POST', url: MEMORIES_URL });
    const form = request.request.body as FormData;
    expect(form.get('text')).toBe('Concert night');
    expect(form.getAll('files')).toEqual([photo, pdf]);
    request.flush(saved);
    expect(result).toEqual(saved);
  });

  it('leaves the text out of the form when only files are saved', () => {
    service
      .createMemory({
        text: '   ',
        files: [new File(['x'], 'bill.pdf', { type: 'application/pdf' })],
      })
      .subscribe();

    const request = backend.expectOne({ method: 'POST', url: MEMORIES_URL });
    expect((request.request.body as FormData).has('text')).toBe(false);
    request.flush(textMemory('bill.pdf'));
  });

  it('lists the memories from the backend, asking for the biggest page', () => {
    const memories = [textMemory('Mom phone 98765'), textMemory('Vet appointment')];
    let result: Memory[] = [];

    service.listMemories().subscribe((list) => (result = list));

    const request = backend.expectOne((req) => req.url === MEMORIES_URL);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('limit')).toBe('100');
    request.flush({ items: memories, total: 2, limit: 100, offset: 0 });
    expect(result).toEqual(memories);
  });

  it('searches on the backend and shows the closest memories, without a written answer', () => {
    const memories = [textMemory('Mom phone 98765')];
    let result: SearchResult | undefined;

    service.searchMemories('mom number').subscribe((found) => (result = found));

    const request = backend.expectOne((req) => req.url === `${MEMORIES_URL}/search`);
    expect(request.request.params.get('q')).toBe('mom number');
    expect(request.request.params.get('limit')).toBe('5');
    request.flush({ items: memories });
    expect(result).toEqual({ answer: null, memories });
  });

  it('asks the AI a question and turns the reply into an answer with its sources', () => {
    const memory = textMemory('Rent is due by the 5th');
    let answer: SearchAnswer | undefined;

    service.askQuestion('when is rent due').subscribe((found) => (answer = found));

    const request = backend.expectOne({ method: 'POST', url: '/api/v1/chat/messages' });
    expect(request.request.body).toEqual({ question: 'when is rent due' });
    request.flush({ answer: 'Rent is due by the 5th.', memories: [memory] });
    expect(answer).toEqual({
      text: 'Rent is due by the 5th.',
      sources: [{ id: memory.id, title: 'Rent is due by the 5th' }],
    });
  });

  it('passes on a failure when the AI cannot write the answer', () => {
    let status = 0;

    service
      .askQuestion('when is rent due')
      .subscribe({ error: (error) => (status = error.status) });
    backend
      .expectOne('/api/v1/chat/messages')
      .flush({}, { status: 503, statusText: 'Service Unavailable' });

    expect(status).toBe(503);
  });

  it('gets one memory by id, and passes a 404 on', () => {
    const memory = textMemory('Mom phone 98765');
    let status = 0;
    let result: Memory | undefined;

    service.getMemory(memory.id).subscribe((found) => (result = found));
    backend.expectOne(`${MEMORIES_URL}/${memory.id}`).flush(memory);
    expect(result).toEqual(memory);

    service.getMemory('missing').subscribe({ error: (error) => (status = error.status) });
    backend
      .expectOne(`${MEMORIES_URL}/missing`)
      .flush({}, { status: 404, statusText: 'Not Found' });
    expect(status).toBe(404);
  });

  it('renames a memory on the backend with the trimmed title', () => {
    const memory = textMemory('Old title');
    let result: Memory | undefined;

    service.updateMemory(memory.id, { title: '  New title  ' }).subscribe((m) => (result = m));

    const request = backend.expectOne({ method: 'PATCH', url: `${MEMORIES_URL}/${memory.id}` });
    expect(request.request.body).toEqual({ title: 'New title' });
    request.flush({ ...memory, title: 'New title' });
    expect(result?.title).toBe('New title');
  });

  it('asks a question about one memory on the backend and keeps the question with the answer', () => {
    let answer: MemoryAnswer | undefined;

    service.askMemory('lease', 'When is rent due?').subscribe((found) => (answer = found));

    const request = backend.expectOne({ method: 'POST', url: `${MEMORIES_URL}/lease/answers` });
    expect(request.request.body).toEqual({ question: 'When is rent due?' });
    request.flush({ answer: 'Rent is due by the 5th.' });
    expect(answer).toEqual({ question: 'When is rent due?', text: 'Rent is due by the 5th.' });
  });

  it('passes on a failure when the AI cannot answer about a memory', () => {
    let status = 0;

    service
      .askMemory('lease', 'When is rent due?')
      .subscribe({ error: (error) => (status = error.status) });
    backend
      .expectOne(`${MEMORIES_URL}/lease/answers`)
      .flush({}, { status: 503, statusText: 'Service Unavailable' });

    expect(status).toBe(503);
  });

  it('deletes a memory on the backend', () => {
    let isDone = false;

    service.deleteMemory('abc').subscribe(() => (isDone = true));

    const request = backend.expectOne({ method: 'DELETE', url: `${MEMORIES_URL}/abc` });
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(isDone).toBe(true);
  });
});

// Saving an answer is still an in-browser stand-in. It works on the memories loaded from
// the backend, so each test first "loads" some.
describe('MemoriesApi stand-in for save answer', () => {
  let service: MemoriesApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    ({ service, backend } = setUp());
  });
  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  /** Make the service load these memories, as if the backend had returned them. */
  function load(memories: Memory[]): void {
    service.listMemories().subscribe();
    backend
      .expectOne((req) => req.url === MEMORIES_URL)
      .flush({ items: memories, total: memories.length, limit: 100, offset: 0 });
  }

  it('saves an answer as a new memory linked to the one it came from', async () => {
    load(createSampleMemories());
    const answer: MemoryAnswer = {
      question: 'When is the rent due?',
      text: 'Rent is due by the 5th.',
    };

    const saved = await settle(service.saveAnswer('sample-lease', answer));

    expect(saved).toMatchObject({
      type: 'text',
      title: 'When is the rent due?',
      raw_text: answer.text,
      source_memory: { id: 'sample-lease', title: 'Apartment lease agreement' },
    });
  });
});

// Skips the pretend delay of the stand-in.
async function settle<T>(request: Observable<T>): Promise<T> {
  const result = firstValueFrom(request);
  // Attach a no-op handler so a failure is only reported where the test awaits it.
  result.catch(() => undefined);
  await vi.runAllTimersAsync();
  return result;
}

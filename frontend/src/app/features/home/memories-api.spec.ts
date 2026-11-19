import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom } from 'rxjs';

import { Memory } from './memory';
import { MemoriesApi } from './memories-api';
import { createSampleMemories } from './sample-memories';

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

  it('deletes a memory on the backend', () => {
    let isDone = false;

    service.deleteMemory('abc').subscribe(() => (isDone = true));

    const request = backend.expectOne({ method: 'DELETE', url: `${MEMORIES_URL}/abc` });
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(isDone).toBe(true);
  });
});

// Asking, searching, renaming and saving answers are still an in-browser stand-in. It works on
// the memories loaded from the backend, so each test first "loads" some.
describe('MemoriesApi stand-in for ask, search and rename', () => {
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

  it('answers a question from the one memory it is asked about', async () => {
    load(createSampleMemories());

    const wifi = await settle(service.askMemory('sample-wifi', "What's the password?"));
    const rent = await settle(service.askMemory('sample-lease', 'When is the rent due?'));
    const hotel = await settle(service.askMemory('sample-budget', 'How much is the hotel?'));

    expect(wifi).toEqual({
      question: "What's the password?",
      text: 'Password: sunflower42',
      found: true,
    });
    expect(rent.text).toContain('due by the 5th');
    expect(hotel.text).toContain('Hotel Shinjuku, 5 nights: Category Stay, Cost (USD) 960');
  });

  it("says so instead of guessing when the memory doesn't contain the answer", async () => {
    load(createSampleMemories());

    // The restaurant note never mentions a price, though the budget sheet does.
    const answer = await settle(service.askMemory('sample-restaurant', 'How much is the food?'));

    expect(answer.found).toBe(false);
    expect(answer.text).toContain("doesn't say");
  });

  it('saves an answer as a new memory linked to the one it came from', async () => {
    load(createSampleMemories());
    const answer = await settle(service.askMemory('sample-lease', 'When is the rent due?'));

    const saved = await settle(service.saveAnswer('sample-lease', answer));

    expect(saved).toMatchObject({
      type: 'text',
      title: 'When is the rent due?',
      raw_text: answer.text,
      source_memory: { id: 'sample-lease', title: 'Apartment lease agreement' },
    });
  });

  it('finds memories with the suggested searches', async () => {
    load(createSampleMemories());

    const parking = await settle(service.searchMemories('Where did I park at the airport?'));
    const rent = await settle(service.searchMemories('When is the rent due?'));

    expect(parking.memories[0].id).toBe('sample-parking');
    expect(parking.answer?.text).toContain('level P2, spot C-47');
    expect(rent.memories[0].id).toBe('sample-lease');
    expect(rent.answer?.text).toContain('due by the 5th');
  });

  it('answers about a saved link from what the page is about, not its address', async () => {
    load(createSampleMemories());

    const result = await settle(service.searchMemories('banana bread recipe'));

    expect(result.memories[0].id).toBe('sample-recipe');
    expect(result.answer?.text).not.toContain('https://');
    expect(result.answer?.text).toContain('banana bread');
  });

  it('searches by the new title after a rename', async () => {
    const [first] = createSampleMemories();
    load([first]);
    service.updateMemory(first.id, { title: 'Wifi at home' }).subscribe();
    backend
      .expectOne({ method: 'PATCH', url: `${MEMORIES_URL}/${first.id}` })
      .flush({ ...first, title: 'Wifi at home' });

    const result = await settle(service.searchMemories('wifi at home'));

    expect(result.memories[0].title).toBe('Wifi at home');
  });

  it('finds a memory that was just saved', async () => {
    const saved = textMemory('Vet appointment for Bruno on Friday at 5');
    load([textMemory('Mom phone 98765')]);
    service.createMemory({ text: saved.title, files: [] }).subscribe();
    backend.expectOne({ method: 'POST', url: MEMORIES_URL }).flush(saved);

    const result = await settle(service.searchMemories('When is the vet appointment?'));

    expect(result.memories.map((memory) => memory.id)).toEqual([saved.id]);
    expect(result.answer?.sources).toEqual([{ id: saved.id, title: saved.title }]);
  });

  it('stops finding a memory once it is deleted', async () => {
    const mom = textMemory('Mom phone 98765');
    load([mom]);
    service.deleteMemory(mom.id).subscribe();
    backend.expectOne({ method: 'DELETE', url: `${MEMORIES_URL}/${mom.id}` }).flush(null);

    const result = await settle(service.searchMemories('mom phone'));

    expect(result).toEqual({ answer: null, memories: [] });
  });

  it('lists the candidates instead of guessing when several match equally', async () => {
    load([textMemory('Gym at 7 this evening'), textMemory('Pack the gym bag')]);

    const result = await settle(service.searchMemories('gym'));

    expect(result.memories).toHaveLength(2);
    expect(result.answer).toEqual({
      text: '2 memories could match. Which one do you mean?',
      sources: [],
    });
  });

  it('shows at most five matches, best first', async () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => `Gym on ${day}`);
    load([...days, 'Gym with Rahul on Sunday'].map(textMemory));

    const result = await settle(service.searchMemories('gym with Rahul'));

    expect(result.memories).toHaveLength(5);
    expect(result.memories[0].title).toBe('Gym with Rahul on Sunday');
  });
});

// Skips the pretend thinking delay of the stand-in.
async function settle<T>(request: Observable<T>): Promise<T> {
  const result = firstValueFrom(request);
  // Attach a no-op handler so a failure is only reported where the test awaits it.
  result.catch(() => undefined);
  await vi.runAllTimersAsync();
  return result;
}

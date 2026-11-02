import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom } from 'rxjs';

import { MemoriesApi } from './memories-api';

describe('MemoriesApi', () => {
  let service: MemoriesApi;

  beforeEach(() => {
    service = createService();
  });

  afterEach(() => vi.useRealTimers());

  it('starts with sample memories of every format, with real sample files', async () => {
    const memories = await settle(service.listMemories());

    expect(new Set(memories.map((memory) => memory.type))).toEqual(
      new Set(['text', 'image', 'pdf', 'link', 'excel']),
    );
    const fileUrls = memories.flatMap((memory) => memory.attachments.map((file) => file.file_url));
    expect(fileUrls.length).toBeGreaterThan(0);
    expect(fileUrls.every((url) => url.startsWith('/samples/'))).toBe(true);
  });

  it('gets one memory, and fails for one that does not exist', async () => {
    const [first] = await settle(service.listMemories());

    expect(await settle(service.getMemory(first.id))).toEqual(first);
    await expect(settle(service.getMemory('missing'))).rejects.toThrow('Memory not found');
  });

  it('answers a question from the one memory it is asked about', async () => {
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
    // The restaurant note never mentions a price, though the budget sheet does.
    const answer = await settle(service.askMemory('sample-restaurant', 'How much is the food?'));

    expect(answer.found).toBe(false);
    expect(answer.text).toContain("doesn't say");
  });

  it('saves an answer as a new memory linked to the one it came from', async () => {
    const answer = await settle(service.askMemory('sample-lease', 'When is the rent due?'));

    const saved = await settle(service.saveAnswer('sample-lease', answer));

    expect(saved).toMatchObject({
      type: 'text',
      title: 'When is the rent due?',
      raw_text: answer.text,
      source_memory: { id: 'sample-lease', title: 'Apartment lease agreement' },
    });
    expect((await settle(service.listMemories()))[0].id).toBe(saved.id);
  });

  it('finds the sample memories with the suggested searches', async () => {
    const parking = await settle(service.searchMemories('Where did I park at the airport?'));
    const rent = await settle(service.searchMemories('When is the rent due?'));

    expect(parking.memories[0].id).toBe('sample-parking');
    expect(parking.answer?.text).toContain('level P2, spot C-47');
    expect(rent.memories[0].id).toBe('sample-lease');
    expect(rent.answer?.text).toContain('due by the 5th');
  });

  it('answers about a saved link from what the page is about, not its address', async () => {
    const result = await settle(service.searchMemories('banana bread recipe'));

    expect(result.memories[0].id).toBe('sample-recipe');
    expect(result.answer?.text).not.toContain('https://');
    expect(result.answer?.text).toContain('banana bread');
  });

  it('renames a memory everywhere it is listed', async () => {
    const [first] = await settle(service.listMemories());

    const renamed = await settle(service.updateMemory(first.id, { title: '  Wifi at home  ' }));

    expect(renamed).toEqual({ ...first, title: 'Wifi at home' });
    expect((await settle(service.listMemories()))[0].title).toBe('Wifi at home');
  });
});

// The remaining tests start from an empty account so samples can't match by accident.
describe('MemoriesApi with no memories yet', () => {
  let service: MemoriesApi;

  beforeEach(async () => {
    service = createService();
    for (const memory of await settle(service.listMemories())) {
      await settle(service.deleteMemory(memory.id));
    }
  });

  afterEach(() => vi.useRealTimers());

  it('saves typed text as a text memory titled by its content', async () => {
    const memory = await settle(service.createMemory({ text: '  Gym at 7 tonight  ', files: [] }));

    expect(memory).toMatchObject({
      type: 'text',
      title: 'Gym at 7 tonight',
      raw_text: 'Gym at 7 tonight',
      attachments: [],
      summary: null,
      link_preview: null,
    });
  });

  it('recognises links and map links in typed text', async () => {
    const link = await settle(
      service.createMemory({ text: 'https://shop.example/dress', files: [] }),
    );
    const map = await settle(
      service.createMemory({ text: 'https://maps.app.goo.gl/abc123', files: [] }),
    );

    expect(link.type).toBe('link');
    expect(map.type).toBe('map');
  });

  it('keeps typed text and attached files together in one memory', async () => {
    const photo = new File(['x'], 'ticket.png', { type: 'image/png' });
    const pdf = new File(['xy'], 'bill.pdf', { type: 'application/pdf' });

    const memory = await settle(
      service.createMemory({ text: 'Concert night', files: [photo, pdf] }),
    );

    expect(memory.type).toBe('text');
    expect(memory.title).toBe('Concert night');
    expect(memory.attachments).toEqual([
      expect.objectContaining({
        kind: 'image',
        file_name: 'ticket.png',
        file_url: 'blob:ticket.png',
        file_size: 1,
      }),
      expect.objectContaining({
        kind: 'pdf',
        file_name: 'bill.pdf',
        file_url: 'blob:bill.pdf',
        file_size: 2,
      }),
    ]);
    expect(await settle(service.listMemories())).toHaveLength(1);
  });

  it("names a files-only memory after its first file and takes that file's kind", async () => {
    const files = [
      new File(['x'], 'bill.pdf', { type: 'application/pdf' }),
      new File(['x'], 'budget.xlsx'),
    ];

    const memory = await settle(service.createMemory({ text: '   ', files }));

    expect(memory).toMatchObject({ type: 'pdf', title: 'bill.pdf + 1 more', raw_text: null });
  });

  it('lists memories newest first', async () => {
    await settle(service.createMemory({ text: 'Vet appointment in 3 days', files: [] }));
    await settle(service.createMemory({ text: 'Mom phone 98765', files: [] }));

    const memories = await settle(service.listMemories());

    expect(memories.map((memory) => memory.title)).toEqual([
      'Mom phone 98765',
      'Vet appointment in 3 days',
    ]);
  });

  it('deletes a memory and frees all its files', async () => {
    const photo = await settle(
      service.createMemory({
        text: '',
        files: [
          new File(['x'], 'photo.png', { type: 'image/png' }),
          new File(['x'], 'bill.pdf', { type: 'application/pdf' }),
        ],
      }),
    );
    await settle(service.createMemory({ text: 'Mom phone 98765', files: [] }));

    await settle(service.deleteMemory(photo.id));

    const memories = await settle(service.listMemories());
    expect(memories.map((memory) => memory.title)).toEqual(['Mom phone 98765']);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo.png');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:bill.pdf');
  });

  it('answers from the one clear best match and points to it', async () => {
    await settle(
      service.createMemory({ text: 'Vet appointment for Bruno on Friday at 5', files: [] }),
    );
    await settle(service.createMemory({ text: 'Mom phone 98765', files: [] }));

    const result = await settle(service.searchMemories('When is the vet appointment?'));

    expect(result.memories.map((memory) => memory.title)).toEqual([
      'Vet appointment for Bruno on Friday at 5',
    ]);
    expect(result.answer?.text).toBe('Vet appointment for Bruno on Friday at 5');
    expect(result.answer?.sources).toEqual([
      { id: result.memories[0].id, title: 'Vet appointment for Bruno on Friday at 5' },
    ]);
  });

  it('lists the candidates instead of guessing when several match equally', async () => {
    await settle(service.createMemory({ text: 'Gym at 7 this evening', files: [] }));
    await settle(service.createMemory({ text: 'Pack the gym bag', files: [] }));

    const result = await settle(service.searchMemories('gym'));

    expect(result.memories).toHaveLength(2);
    expect(result.answer).toEqual({
      text: '2 memories could match. Which one do you mean?',
      sources: [],
    });
  });

  it('shows at most five matches, best first', async () => {
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      await settle(service.createMemory({ text: `Gym on ${day}`, files: [] }));
    }
    await settle(service.createMemory({ text: 'Gym with Rahul on Sunday', files: [] }));

    const result = await settle(service.searchMemories('gym with Rahul'));

    expect(result.memories).toHaveLength(5);
    expect(result.memories[0].title).toBe('Gym with Rahul on Sunday');
  });

  it('finds nothing and gives no answer when nothing matches', async () => {
    await settle(service.createMemory({ text: 'Mom phone 98765', files: [] }));

    const result = await settle(service.searchMemories('where is my passport?'));

    expect(result).toEqual({ answer: null, memories: [] });
  });
});

function createService(): MemoriesApi {
  vi.useFakeTimers();
  // jsdom has no blob URLs; the stand-in uses them to serve uploaded files.
  URL.createObjectURL = vi.fn((file: Blob) => `blob:${(file as File).name}`);
  URL.revokeObjectURL = vi.fn();
  TestBed.configureTestingModule({});
  return TestBed.inject(MemoriesApi);
}

// Skips the pretend network delay.
async function settle<T>(request: Observable<T>): Promise<T> {
  const result = firstValueFrom(request);
  // Attach a no-op handler so a failure is only reported where the test awaits it.
  result.catch(() => undefined);
  await vi.runAllTimersAsync();
  return result;
}

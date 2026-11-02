import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { MemoriesApi } from '../memories-api';
import { Memory } from '../memory';
import { MemoryAnswer } from '../memory-answer';
import { MemoryLibrary } from '../memory-library';
import { MemoryDetail } from './memory-detail';

const LEASE: Memory = {
  id: 'lease',
  type: 'pdf',
  title: 'Apartment lease agreement',
  raw_text: null,
  attachments: [
    {
      id: 'a1',
      kind: 'pdf',
      file_name: 'lease.pdf',
      file_url: '/samples/lease.pdf',
      file_size: 2048,
      preview_rows: null,
    },
  ],
  summary: 'Rent is due by the 5th.',
  link_preview: null,
  source_memory: null,
  created_at: '2026-10-29T18:00:00.000Z',
};
const NOTE: Memory = {
  ...LEASE,
  id: 'note',
  type: 'text',
  title: "Mom's wifi",
  raw_text: 'Password: sunflower42',
  attachments: [],
  summary: null,
};

const RENT_ANSWER: MemoryAnswer = {
  question: 'When is rent due?',
  text: 'Rent is due by the 5th.',
  found: true,
};
const SAVED_ANSWER: Memory = {
  ...NOTE,
  id: 'answer',
  title: 'When is rent due?',
  raw_text: 'Rent is due by the 5th.',
  source_memory: { id: 'lease', title: 'Apartment lease agreement' },
};

describe('MemoryDetail', () => {
  let harness: RouterTestingHarness;
  let compiled: HTMLElement;
  let memoriesApi: {
    getMemory: ReturnType<typeof vi.fn>;
    updateMemory: ReturnType<typeof vi.fn>;
    deleteMemory: ReturnType<typeof vi.fn>;
    askMemory: ReturnType<typeof vi.fn>;
    saveAnswer: ReturnType<typeof vi.fn>;
  };
  let reload: ReturnType<typeof vi.fn>;
  let addToast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    memoriesApi = {
      getMemory: vi.fn((id: string) => of(id === NOTE.id ? NOTE : LEASE)),
      updateMemory: vi.fn((id: string, changes: { title: string }) => of({ ...NOTE, ...changes })),
      deleteMemory: vi.fn().mockReturnValue(of(undefined)),
      askMemory: vi.fn().mockReturnValue(of(RENT_ANSWER)),
      saveAnswer: vi.fn().mockReturnValue(of(SAVED_ANSWER)),
    };
    reload = vi.fn();
    addToast = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'home', children: [] },
            { path: 'home/memories/:memoryId', component: MemoryDetail },
          ],
          withComponentInputBinding(),
        ),
        { provide: MemoriesApi, useValue: memoriesApi },
        { provide: MemoryLibrary, useValue: { reload } },
        { provide: MessageService, useValue: { add: addToast } },
      ],
    });
  });

  async function open(memoryId: string): Promise<void> {
    harness = await RouterTestingHarness.create(`/home/memories/${memoryId}`);
    compiled = harness.fixture.nativeElement as HTMLElement;
  }

  async function stable(): Promise<void> {
    await harness.fixture.whenStable();
  }

  // The actions menu and the confirm dialog are drawn at the end of <body>.
  async function chooseAction(label: string): Promise<void> {
    compiled.querySelector<HTMLButtonElement>('button[aria-label="More actions"]')!.click();
    await stable();
    const items = Array.from(document.body.querySelectorAll<HTMLElement>('.p-menu-item'));
    const item = items.find((candidate) => candidate.textContent?.trim() === label)!;
    item.querySelector<HTMLElement>('.p-menu-item-content')!.click();
    await stable();
  }

  async function typeTitle(title: string, key: 'Enter' | 'Escape'): Promise<void> {
    compiled.querySelector<HTMLButtonElement>('button[aria-label="Edit title"]')!.click();
    await stable();
    const box = compiled.querySelector<HTMLInputElement>('input[aria-label="Memory title"]')!;
    box.value = title;
    box.dispatchEvent(new Event('input'));
    await stable();
    box.dispatchEvent(new KeyboardEvent('keydown', { key }));
    await stable();
  }

  it('shows the title, type, saved date, original file and summary', async () => {
    await open('lease');

    expect(memoriesApi.getMemory).toHaveBeenCalledWith('lease');
    expect(compiled.querySelector('h1')?.textContent).toBe('Apartment lease agreement');
    expect(compiled.querySelector('.detail__meta')?.textContent).toContain('PDF');
    expect(compiled.querySelector('.detail__meta')?.textContent).toContain('Oct 29, 2026');
    expect(compiled.querySelector('ra-memory-content')?.textContent).toContain('lease.pdf');
    expect(compiled.querySelector('.detail__summary')?.textContent).toContain('due by the 5th');
  });

  it('leaves the summary out when there is none', async () => {
    await open('note');

    expect(compiled.querySelector('ra-memory-content')?.textContent).toContain('sunflower42');
    expect(compiled.querySelector('.detail__summary')).toBeNull();
  });

  it("says so when the memory doesn't exist", async () => {
    memoriesApi.getMemory.mockReturnValue(throwError(() => new Error('Memory not found')));

    await open('missing');

    expect(compiled.querySelector('h1')?.textContent).toContain("This memory isn't here");
    expect(compiled.querySelector('button[aria-label="More actions"]')).toBeNull();
  });

  it('renames the memory on Enter and refreshes the sidebar', async () => {
    await open('note');

    await typeTitle('  Wifi at home  ', 'Enter');

    expect(memoriesApi.updateMemory).toHaveBeenCalledWith('note', { title: 'Wifi at home' });
    expect(compiled.querySelector('h1')?.textContent).toBe('Wifi at home');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('keeps the old title when editing is cancelled with Escape', async () => {
    await open('note');

    await typeTitle('Something else', 'Escape');

    expect(memoriesApi.updateMemory).not.toHaveBeenCalled();
    expect(compiled.querySelector('h1')?.textContent).toBe("Mom's wifi");
  });

  it('deletes the memory once confirmed and goes home', async () => {
    await open('note');

    await chooseAction('Delete');
    const buttons = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'));
    buttons.find((button) => button.textContent?.trim() === 'Delete')!.click();
    await stable();

    expect(memoriesApi.deleteMemory).toHaveBeenCalledWith('note');
    expect(reload).toHaveBeenCalledOnce();
    expect(TestBed.inject(Router).url).toBe('/home');
  });

  it('copies the typed text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await open('note');

    await chooseAction('Copy text');

    expect(writeText).toHaveBeenCalledWith('Password: sunflower42');
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'Copied to clipboard' }),
    );
  });

  async function askAbout(question: string): Promise<void> {
    const box = compiled.querySelector<HTMLInputElement>('ra-ask-memory input')!;
    box.value = question;
    box.dispatchEvent(new Event('input'));
    await stable();
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await stable();
  }

  it('answers a question about this memory only, below the box', async () => {
    await open('lease');

    await askAbout('When is rent due?');

    expect(memoriesApi.askMemory).toHaveBeenCalledWith('lease', 'When is rent due?');
    expect(compiled.querySelector('.ask__text')?.textContent).toContain('due by the 5th');
  });

  it('saves the answer as a linked memory and refreshes the sidebar', async () => {
    await open('lease');
    await askAbout('When is rent due?');

    Array.from(compiled.querySelectorAll<HTMLButtonElement>('ra-ask-memory button'))
      .find((button) => button.textContent?.includes('Save answer'))!
      .click();
    await stable();

    expect(memoriesApi.saveAnswer).toHaveBeenCalledWith('lease', RENT_ANSWER);
    expect(reload).toHaveBeenCalledOnce();
    expect(compiled.querySelector('.ask__saved')?.textContent).toContain('Saved as a new memory');
  });

  it('forgets the answer when another memory is opened', async () => {
    await open('lease');
    await askAbout('When is rent due?');

    await harness.navigateByUrl('/home/memories/note');

    expect(compiled.querySelector('h1')?.textContent).toBe("Mom's wifi");
    expect(compiled.querySelector('.ask__answer')).toBeNull();
  });

  it('links a saved answer back to the memory it came from', async () => {
    memoriesApi.getMemory.mockReturnValue(of(SAVED_ANSWER));

    await open('answer');

    const link = compiled.querySelector<HTMLAnchorElement>('.detail__source a')!;
    expect(link.textContent).toBe('Apartment lease agreement');
    expect(link.getAttribute('href')).toBe('/home/memories/lease');
  });
});

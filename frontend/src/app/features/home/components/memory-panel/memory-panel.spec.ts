import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Memory } from '../../memory';
import { MemoryPanel, groupByDay } from './memory-panel';

function memoryAddedAt(title: string, createdAt: Date): Memory {
  return {
    id: title,
    type: 'text',
    title,
    raw_text: title,
    attachments: [],
    summary: null,
    link_preview: null,
    source_memory: null,
    created_at: createdAt.toISOString(),
  };
}

function attachmentNamed(fileName: string) {
  return {
    id: fileName,
    file_name: fileName,
    file_url: 'blob:x',
    file_size: 1,
    preview_rows: null,
  };
}

describe('groupByDay', () => {
  const now = new Date(2026, 10, 1, 15, 0);

  it('sorts newest first and splits into Today, Yesterday and Earlier', () => {
    const memories = [
      memoryAddedAt('last week', new Date(2026, 9, 25, 9, 0)),
      memoryAddedAt('this morning', new Date(2026, 10, 1, 8, 0)),
      memoryAddedAt('late yesterday', new Date(2026, 9, 31, 23, 30)),
      memoryAddedAt('this afternoon', new Date(2026, 10, 1, 14, 0)),
    ];

    const groups = groupByDay(memories, now);

    expect(groups.map((group) => [group.label, group.memories.map((m) => m.title)])).toEqual([
      ['Today', ['this afternoon', 'this morning']],
      ['Yesterday', ['late yesterday']],
      ['Earlier', ['last week']],
    ]);
  });

  it('leaves out days with nothing in them', () => {
    const groups = groupByDay([memoryAddedAt('old', new Date(2026, 0, 1))], now);

    expect(groups.map((group) => group.label)).toEqual(['Earlier']);
  });
});

describe('MemoryPanel', () => {
  let fixture: ComponentFixture<MemoryPanel>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemoryPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(MemoryPanel);
    compiled = fixture.nativeElement as HTMLElement;
  });

  async function render(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries({ memories: [], ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('lists memories under their day heading', async () => {
    await render({ memories: [memoryAddedAt('Gym at 7', new Date())] });

    expect(compiled.textContent).toContain('Today');
    expect(compiled.querySelector('.memory-panel__row')?.textContent).toContain('Gym at 7');
  });

  it('shows how many files a memory has', async () => {
    const withFiles = {
      ...memoryAddedAt('Concert night', new Date()),
      attachments: [
        { ...attachmentNamed('ticket.png'), kind: 'image' },
        { ...attachmentNamed('bill.pdf'), kind: 'pdf' },
      ],
    } satisfies Memory;

    await render({ memories: [withFiles, memoryAddedAt('Gym at 7', new Date())] });

    const counts = Array.from(compiled.querySelectorAll('.memory-panel__files'));
    expect(counts.map((count) => count.textContent?.trim())).toEqual(['2']);
  });

  it('asks to open a memory when its row is clicked', async () => {
    const memory = memoryAddedAt('Gym at 7', new Date());
    const opened: Memory[] = [];
    fixture.componentInstance.openMemory.subscribe((value) => opened.push(value));
    await render({ memories: [memory] });

    compiled.querySelector<HTMLElement>('.memory-panel__row-title')!.click();

    expect(opened).toEqual([memory]);
  });

  it('deletes a memory only after the user confirms', async () => {
    const memory = memoryAddedAt('Gym at 7', new Date());
    const opened: Memory[] = [];
    const deleted: Memory[] = [];
    fixture.componentInstance.openMemory.subscribe((value) => opened.push(value));
    fixture.componentInstance.deleteMemory.subscribe((value) => deleted.push(value));
    await render({ memories: [memory] });

    compiled.querySelector<HTMLButtonElement>('.memory-panel__delete button')!.click();
    await fixture.whenStable();
    expect(deleted).toEqual([]);

    const confirmButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Delete',
    )!;
    confirmButton.click();

    expect(deleted).toEqual([memory]);
    expect(opened).toEqual([]);
  });

  it('explains an empty list', async () => {
    await render({});

    expect(compiled.textContent).toContain('Nothing remembered yet.');
  });

  it('shows placeholders while loading and a message on error', async () => {
    await render({ isLoading: true });
    expect(compiled.querySelectorAll('p-skeleton').length).toBeGreaterThan(0);

    await render({ isLoading: false, hasError: true });
    expect(compiled.textContent).toContain("Couldn't load your memories");
  });
});

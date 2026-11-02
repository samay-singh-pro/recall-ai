import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemoryAnswer } from '../../memory-answer';
import { MemoryReference } from '../../memory-reference';
import { AskMemory } from './ask-memory';

const FOUND: MemoryAnswer = {
  question: 'When is rent due?',
  text: 'Rent 28,000 is due by the 5th.',
  found: true,
};
const NOT_FOUND: MemoryAnswer = {
  question: 'Are pets allowed?',
  text: "This memory doesn't say anything about that.",
  found: false,
};

describe('AskMemory', () => {
  let fixture: ComponentFixture<AskMemory>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AskMemory],
    }).compileComponents();

    fixture = TestBed.createComponent(AskMemory);
    compiled = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  async function render(inputs: Record<string, unknown>): Promise<void> {
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    await fixture.whenStable();
  }

  function saveButton(): HTMLButtonElement | undefined {
    return Array.from(compiled.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save answer'),
    );
  }

  it('sends the question on Enter and empties the box', async () => {
    const asked: string[] = [];
    fixture.componentInstance.ask.subscribe((question) => asked.push(question));
    const box = compiled.querySelector('input')!;

    box.value = '  When is rent due?  ';
    box.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();

    expect(asked).toEqual(['When is rent due?']);
    expect(box.value).toBe('');
  });

  it('shows the latest answer with its question and offers to save it', async () => {
    const saves: void[] = [];
    fixture.componentInstance.saveAnswer.subscribe(() => saves.push(undefined));

    await render({ answer: FOUND });
    saveButton()!.click();

    expect(compiled.querySelector('.ask__question')?.textContent).toBe('When is rent due?');
    expect(compiled.querySelector('.ask__text')?.textContent).toContain('due by the 5th');
    expect(saves).toHaveLength(1);
  });

  it("doesn't offer to save when the memory doesn't contain the answer", async () => {
    await render({ answer: NOT_FOUND });

    expect(compiled.querySelector('.ask__text')?.textContent).toContain("doesn't say");
    expect(saveButton()).toBeUndefined();
  });

  it('confirms a saved answer and links to it', async () => {
    const saved: MemoryReference = { id: 'm2', title: 'When is rent due?' };
    const opened: MemoryReference[] = [];
    fixture.componentInstance.openSavedAnswer.subscribe((memory) => opened.push(memory));

    await render({ answer: FOUND, savedAnswer: saved });
    Array.from(compiled.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Open'))!
      .click();

    expect(compiled.querySelector('.ask__saved')?.textContent).toContain('Saved as a new memory');
    expect(saveButton()).toBeUndefined();
    expect(opened).toEqual([saved]);
  });
});

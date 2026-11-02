import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemoryDraft } from '../../memory-draft';
import { MAX_FILES, MemoryInput } from './memory-input';

describe('MemoryInput', () => {
  let fixture: ComponentFixture<MemoryInput>;
  let compiled: HTMLElement;
  let emitted: MemoryDraft[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemoryInput],
    }).compileComponents();

    fixture = TestBed.createComponent(MemoryInput);
    emitted = [];
    fixture.componentInstance.remember.subscribe((drafts) => emitted.push(drafts));
    await fixture.whenStable();
    compiled = fixture.nativeElement as HTMLElement;
  });

  async function type(text: string): Promise<void> {
    const textarea = compiled.querySelector('textarea')!;
    textarea.value = text;
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function pickFiles(files: File[]): Promise<void> {
    const picker = compiled.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(picker, 'files', { value: files, configurable: true });
    picker.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  function rememberButton(): HTMLButtonElement {
    return compiled.querySelectorAll<HTMLButtonElement>('button')[1];
  }

  it('keeps Remember disabled until something is typed or attached', async () => {
    expect(rememberButton().disabled).toBe(true);

    await type('   ');
    expect(rememberButton().disabled).toBe(true);

    await type('Gym at 7');
    expect(rememberButton().disabled).toBe(false);
  });

  it('sends the typed text and every attached file together as one memory', async () => {
    const photo = new File(['x'], 'photo.png', { type: 'image/png' });
    const sheet = new File(['x'], 'budget.xlsx');
    await type('  Gym at 7  ');
    await pickFiles([photo, sheet]);

    rememberButton().click();

    expect(emitted).toEqual([{ text: 'Gym at 7', files: [photo, sheet] }]);
  });

  it('saves on Enter but not on Shift+Enter', async () => {
    await type('Vet in 3 days');
    const textarea = compiled.querySelector('textarea')!;

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    expect(emitted).toHaveLength(0);

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(emitted).toEqual([{ text: 'Vet in 3 days', files: [] }]);
  });

  it('accepts files dropped onto the box', async () => {
    const photo = new File(['x'], 'photo.png', { type: 'image/png' });
    const pdf = new File(['x'], 'bill.pdf', { type: 'application/pdf' });
    const drop = new Event('drop', { cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [photo, pdf] } });

    compiled.querySelector('.memory-input')!.dispatchEvent(drop);
    await fixture.whenStable();
    rememberButton().click();

    expect(drop.defaultPrevented).toBe(true);
    expect(emitted).toEqual([{ text: '', files: [photo, pdf] }]);
  });

  it('rejects unsupported files with a message and keeps the supported ones', async () => {
    const pdf = new File(['x'], 'bill.pdf', { type: 'application/pdf' });
    const zip = new File(['x'], 'backup.zip', { type: 'application/zip' });

    await pickFiles([zip, pdf]);

    expect(compiled.textContent).toContain('"backup.zip" isn\'t supported');
    expect(compiled.querySelectorAll('p-chip')).toHaveLength(1);
  });

  it(`stops at ${MAX_FILES} files`, async () => {
    const files = Array.from(
      { length: MAX_FILES + 1 },
      (_, index) => new File(['x'], `photo-${index}.png`, { type: 'image/png' }),
    );

    await pickFiles(files);

    expect(compiled.querySelectorAll('p-chip')).toHaveLength(MAX_FILES);
    expect(compiled.textContent).toContain(`up to ${MAX_FILES} files`);
  });

  it('fills in example text from a suggestion', async () => {
    const reminder = Array.from(compiled.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Add a reminder'),
    )!;

    reminder.click();
    await fixture.whenStable();

    expect(compiled.querySelector('textarea')!.value).toBe('Gym at 7 this evening');
    expect(rememberButton().disabled).toBe(false);
  });

  it('empties the box when cleared after a save', async () => {
    await type('Gym at 7');
    await pickFiles([new File(['x'], 'photo.png', { type: 'image/png' })]);

    fixture.componentInstance.clear();
    await fixture.whenStable();

    expect(compiled.querySelector('textarea')!.value).toBe('');
    expect(compiled.querySelectorAll('p-chip')).toHaveLength(0);
  });
});

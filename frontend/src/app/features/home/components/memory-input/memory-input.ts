import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Chip } from 'primeng/chip';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';

import { MemoryDraft } from '../../memory-draft';

export const MAX_FILES = 5;
export const MAX_FILE_SIZE_MB = 10;
const BYTES_PER_MB = 1024 * 1024;
const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
/** Value for the file picker's `accept` attribute: images, PDF and spreadsheets. */
const ACCEPTED_FILE_TYPES = ['image/*', '.pdf', ...SPREADSHEET_EXTENSIONS].join(',');

/** A starter shown under the box: fills in example text, or opens the file picker when it has none. */
interface Suggestion {
  label: string;
  icon: string;
  exampleText?: string;
}

const SUGGESTIONS: Suggestion[] = [
  { label: 'Add a reminder', icon: 'pi pi-bell', exampleText: 'Gym at 7 this evening' },
  { label: 'Save a link', icon: 'pi pi-link', exampleText: 'https://' },
  { label: 'Upload a file', icon: 'pi pi-upload' },
];

/**
 * The add box: type or paste text, attach or drop files, then press Remember.
 * Emits what to save; saving itself is the screen's job.
 */
@Component({
  selector: 'ra-memory-input',
  imports: [FormsModule, Button, Chip, Message, Textarea, Tooltip],
  templateUrl: './memory-input.html',
  styleUrl: './memory-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemoryInput {
  readonly isSaving = input(false);
  readonly remember = output<MemoryDraft>();

  private readonly textBox = viewChild.required<ElementRef<HTMLTextAreaElement>>('textBox');
  protected readonly acceptedFileTypes = ACCEPTED_FILE_TYPES;
  protected readonly suggestions = SUGGESTIONS;
  protected readonly text = signal('');
  protected readonly files = signal<File[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly isDraggingOver = signal(false);
  protected readonly canRemember = computed(
    () => !this.isSaving() && (this.text().trim().length > 0 || this.files().length > 0),
  );

  /** Empty the box after a successful save. */
  clear(): void {
    this.text.set('');
    this.files.set([]);
    this.errorMessage.set('');
  }

  /** Send everything in the box (text and files) to be saved as one memory. */
  protected submit(): void {
    if (!this.canRemember()) return;
    this.remember.emit({ text: this.text().trim(), files: this.files() });
  }

  /** Fill in the suggestion's example text, or open the file picker for file suggestions. */
  protected useSuggestion(suggestion: Suggestion, filePicker: HTMLInputElement): void {
    if (!suggestion.exampleText) {
      filePicker.click();
      return;
    }
    this.text.set(suggestion.exampleText);
    this.textBox().nativeElement.focus();
  }

  /** Enter saves; Shift+Enter keeps its normal job of adding a new line. */
  protected handleEnter(event: Event): void {
    if ((event as KeyboardEvent).shiftKey) return;
    event.preventDefault();
    this.submit();
  }

  /** Add files that pass the type, size and count limits; explain the first one that fails. */
  protected addFiles(incoming: FileList | File[] | null | undefined): void {
    const candidates = Array.from(incoming ?? []);
    if (candidates.length === 0) return;
    this.errorMessage.set('');

    const accepted: File[] = [];
    for (const file of candidates) {
      const problem = this.findProblem(file, this.files().length + accepted.length);
      if (problem) {
        this.errorMessage.set(problem);
        continue;
      }
      accepted.push(file);
    }
    this.files.update((files) => [...files, ...accepted]);
  }

  protected removeFile(fileToRemove: File): void {
    this.files.update((files) => files.filter((file) => file !== fileToRemove));
  }

  protected handleFilePicked(event: Event): void {
    const picker = event.target as HTMLInputElement;
    this.addFiles(picker.files);
    // Reset so picking the same file again still fires a change.
    picker.value = '';
  }

  // Pasted text goes into the box as usual; only pasted files are intercepted.
  protected handlePaste(event: ClipboardEvent): void {
    const pastedFiles = event.clipboardData?.files;
    if (!pastedFiles?.length) return;
    event.preventDefault();
    this.addFiles(pastedFiles);
  }

  protected handleDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingOver.set(true);
  }

  protected handleDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingOver.set(false);
    this.addFiles(event.dataTransfer?.files);
  }

  private findProblem(file: File, filesAlreadyAttached: number): string | null {
    if (filesAlreadyAttached >= MAX_FILES)
      return `You can attach up to ${MAX_FILES} files at once.`;
    if (!this.isSupported(file)) return `"${file.name}" isn't supported. Use images, PDF or Excel.`;
    if (file.size > MAX_FILE_SIZE_MB * BYTES_PER_MB) {
      return `"${file.name}" is bigger than ${MAX_FILE_SIZE_MB} MB.`;
    }
    return null;
  }

  private isSupported(file: File): boolean {
    const name = file.name.toLowerCase();
    return (
      file.type.startsWith('image/') ||
      file.type === 'application/pdf' ||
      SPREADSHEET_EXTENSIONS.some((extension) => name.endsWith(extension))
    );
  }
}

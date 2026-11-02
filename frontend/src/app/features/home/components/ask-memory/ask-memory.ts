import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Skeleton } from 'primeng/skeleton';

import { MemoryAnswer } from '../../memory-answer';
import { MemoryReference } from '../../memory-reference';

/**
 * A small question box for the open memory, showing only the latest answer (no history).
 * A useful answer can be saved, which turns it into its own memory.
 */
@Component({
  selector: 'ra-ask-memory',
  imports: [FormsModule, Button, InputText, Skeleton],
  templateUrl: './ask-memory.html',
  styleUrl: './ask-memory.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AskMemory {
  readonly answer = input<MemoryAnswer | null>(null);
  readonly isAsking = input(false);
  readonly isSaving = input(false);
  /** The memory the answer was saved as, once saved. */
  readonly savedAnswer = input<MemoryReference | null>(null);
  readonly ask = output<string>();
  readonly saveAnswer = output<void>();
  readonly openSavedAnswer = output<MemoryReference>();

  protected readonly question = signal('');
  protected readonly canAsk = computed(() => this.question().trim().length > 0 && !this.isAsking());

  /** Send the typed question and empty the box; the answer shows below it. */
  protected submit(): void {
    if (!this.canAsk()) return;
    this.ask.emit(this.question().trim());
    this.question.set('');
  }
}

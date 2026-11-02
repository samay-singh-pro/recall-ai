import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';

import { MemoryInput } from '../components/memory-input/memory-input';
import { MemoriesApi } from '../memories-api';
import { MemoryDraft } from '../memory-draft';
import { MemoryLibrary } from '../memory-library';

// Shown until login exists.
const GUEST_NAME = 'Guest';
const NOON_HOUR = 12;
const EVENING_HOUR = 18;

/** The add screen: a greeting and the box where anything can be dropped in and remembered. */
@Component({
  selector: 'ra-new-memory',
  imports: [MemoryInput],
  templateUrl: './new-memory.html',
  styleUrl: './new-memory.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewMemory {
  private readonly memoriesApi = inject(MemoriesApi);
  private readonly library = inject(MemoryLibrary);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly memoryInput = viewChild.required(MemoryInput);

  protected readonly isSaving = signal(false);
  protected readonly greeting = computed(
    () => `${greetingForHour(new Date().getHours())}, ${GUEST_NAME}`,
  );

  /** Save what's in the add box as one memory, then confirm and refresh the list. */
  protected saveMemory(draft: MemoryDraft): void {
    this.isSaving.set(true);
    this.memoriesApi
      .createMemory(draft)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.memoryInput().clear();
          this.messageService.add({ severity: 'success', summary: 'Saved to your memories' });
          this.library.reload();
        },
        error: () => {
          this.isSaving.set(false);
          this.messageService.add({
            severity: 'error',
            summary: "Couldn't save. Please try again.",
          });
        },
      });
  }
}

function greetingForHour(hour: number): string {
  if (hour < NOON_HOUR) return 'Good morning';
  if (hour < EVENING_HOUR) return 'Good afternoon';
  return 'Good evening';
}

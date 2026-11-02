import { DOCUMENT, DatePipe, Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { Menu } from 'primeng/menu';
import { Skeleton } from 'primeng/skeleton';
import { EMPTY, Observable, catchError, switchMap, tap } from 'rxjs';

import { Attachment } from '../attachment';
import { AskMemory } from '../components/ask-memory/ask-memory';
import { MemoryContent } from '../components/memory-content/memory-content';
import { MemoriesApi } from '../memories-api';
import { Memory } from '../memory';
import { MemoryAnswer } from '../memory-answer';
import { MemoryLibrary } from '../memory-library';
import { MemoryReference } from '../memory-reference';
import { MEMORY_TYPE_COLORS, MEMORY_TYPE_ICONS, MEMORY_TYPE_LABELS } from '../memory-type-display';

const TITLE_MAX_LENGTH = 120;

/**
 * One saved memory on its own page: title, original content, AI summary, questions and actions.
 * The same layout for every format; only the original content area changes.
 */
@Component({
  selector: 'ra-memory-detail',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    Button,
    ConfirmDialog,
    InputText,
    Menu,
    Skeleton,
    AskMemory,
    MemoryContent,
  ],
  providers: [ConfirmationService],
  templateUrl: './memory-detail.html',
  styleUrl: './memory-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemoryDetail {
  private readonly memoriesApi = inject(MemoriesApi);
  private readonly library = inject(MemoryLibrary);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  /** Set by the router from `memories/:memoryId`. */
  readonly memoryId = input.required<string>();

  protected readonly memory = signal<Memory | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);
  protected readonly isEditingTitle = signal(false);
  protected readonly isSavingTitle = signal(false);
  protected readonly titleDraft = signal('');
  protected readonly titleMaxLength = TITLE_MAX_LENGTH;
  // "Ask this memory" keeps only the latest answer, forgotten when the page changes.
  protected readonly answer = signal<MemoryAnswer | null>(null);
  protected readonly isAsking = signal(false);
  protected readonly isSavingAnswer = signal(false);
  protected readonly savedAnswer = signal<MemoryReference | null>(null);

  protected readonly typeLabel = computed(() => label(this.memory(), MEMORY_TYPE_LABELS));
  protected readonly typeIcon = computed(() => label(this.memory(), MEMORY_TYPE_ICONS));
  protected readonly typeColor = computed(() => label(this.memory(), MEMORY_TYPE_COLORS));
  protected readonly fileCount = computed(() => {
    const count = this.memory()?.attachments.length ?? 0;
    if (count === 0) return '';
    return count === 1 ? '1 file' : `${count} files`;
  });
  protected readonly canSaveTitle = computed(
    () => this.titleDraft().trim().length > 0 && !this.isSavingTitle(),
  );
  protected readonly actions = computed<MenuItem[]>(() => {
    const memory = this.memory();
    if (!memory) return [];
    const text = memory.raw_text;
    const files = memory.attachments;
    return [
      { label: 'Edit title', icon: 'pi pi-pencil', command: () => this.startEditingTitle() },
      ...(text ? [{ label: 'Copy text', icon: 'pi pi-copy', command: () => this.copy(text) }] : []),
      ...files.map((file) => ({
        label: files.length === 1 ? 'Download' : `Download ${file.file_name}`,
        icon: 'pi pi-download',
        command: () => this.download(file),
      })),
      { separator: true },
      { label: 'Delete', icon: 'pi pi-trash', command: () => this.confirmDelete(memory) },
    ];
  });

  constructor() {
    // The router reuses this page when another memory is opened, so reload on every id.
    toObservable(this.memoryId)
      .pipe(
        switchMap((memoryId) => this.loadMemory(memoryId)),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Put the cursor in the title box as soon as it appears.
    effect(() => {
      const box = this.titleInput()?.nativeElement;
      box?.focus();
      box?.select();
    });
  }

  /** Ask a question answered only from this memory; replaces the previous answer. */
  protected askMemory(question: string): void {
    const memory = this.memory();
    if (!memory || this.isAsking()) return;

    this.isAsking.set(true);
    this.answer.set(null);
    this.savedAnswer.set(null);
    this.memoriesApi
      .askMemory(memory.id, question)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (answer) => {
          this.isAsking.set(false);
          // Drop a late answer if the user has moved on to another memory meanwhile.
          if (this.memory()?.id === memory.id) this.answer.set(answer);
        },
        error: () => {
          this.isAsking.set(false);
          this.showError("Couldn't get an answer. Please try again.");
        },
      });
  }

  /** Keep the current answer as its own memory, linked to this one. */
  protected saveAnswer(): void {
    const memory = this.memory();
    const answer = this.answer();
    if (!memory || !answer || this.isSavingAnswer()) return;

    this.isSavingAnswer.set(true);
    this.memoriesApi
      .saveAnswer(memory.id, answer)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.isSavingAnswer.set(false);
          this.savedAnswer.set({ id: saved.id, title: saved.title });
          this.messageService.add({ severity: 'success', summary: 'Answer saved as a memory' });
          this.library.reload();
        },
        error: () => {
          this.isSavingAnswer.set(false);
          this.showError("Couldn't save the answer. Please try again.");
        },
      });
  }

  /** Open another memory's page. */
  protected openMemory(memory: MemoryReference): void {
    void this.router.navigate(['/home/memories', memory.id]);
  }

  /** Go back to where the user came from (e.g. search results), or home if they came from a link. */
  protected goBack(): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
      return;
    }
    this.goHome();
  }

  /** Go to the add screen. */
  protected goHome(): void {
    void this.router.navigateByUrl('/home');
  }

  /** Swap the title for a text box holding the current title. */
  protected startEditingTitle(): void {
    this.titleDraft.set(this.memory()?.title ?? '');
    this.isEditingTitle.set(true);
  }

  /** Leave the title as it was. */
  protected cancelEditingTitle(): void {
    this.isEditingTitle.set(false);
  }

  /** Save the edited title and refresh the sidebar, which shows it too. */
  protected saveTitle(): void {
    const memory = this.memory();
    const title = this.titleDraft().trim();
    if (!memory || !this.canSaveTitle()) return;
    if (title === memory.title) {
      this.isEditingTitle.set(false);
      return;
    }

    this.isSavingTitle.set(true);
    this.memoriesApi
      .updateMemory(memory.id, { title })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.memory.set(updated);
          this.isSavingTitle.set(false);
          this.isEditingTitle.set(false);
          this.library.reload();
        },
        error: () => {
          this.isSavingTitle.set(false);
          this.showError("Couldn't rename. Please try again.");
        },
      });
  }

  private loadMemory(memoryId: string): Observable<Memory> {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.isEditingTitle.set(false);
    this.answer.set(null);
    this.savedAnswer.set(null);
    return this.memoriesApi.getMemory(memoryId).pipe(
      tap((memory) => {
        this.memory.set(memory);
        this.isLoading.set(false);
      }),
      catchError(() => {
        this.memory.set(null);
        this.hasError.set(true);
        this.isLoading.set(false);
        return EMPTY;
      }),
    );
  }

  /** Copy text to the clipboard and confirm. */
  protected copy(text: string): void {
    navigator.clipboard.writeText(text).then(
      () => this.messageService.add({ severity: 'success', summary: 'Copied to clipboard' }),
      () => this.showError("Couldn't copy. Please try again."),
    );
  }

  // A menu item can't be a download link itself, so click a temporary one.
  private download(file: Attachment): void {
    const link = this.document.createElement('a');
    link.href = file.file_url;
    link.download = file.file_name;
    link.click();
  }

  private confirmDelete(memory: Memory): void {
    this.confirmationService.confirm({
      header: 'Delete this memory?',
      message: 'It will be removed together with its files. This cannot be undone.',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this.deleteMemory(memory),
    });
  }

  private deleteMemory(memory: Memory): void {
    this.memoriesApi
      .deleteMemory(memory.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Memory deleted' });
          this.library.reload();
          // Replace this page in the history so Back can't return to a deleted memory.
          void this.router.navigateByUrl('/home', { replaceUrl: true });
        },
        error: () => this.showError("Couldn't delete. Please try again."),
      });
  }

  private showError(summary: string): void {
    this.messageService.add({ severity: 'error', summary });
  }
}

function label(memory: Memory | null, labels: Record<Memory['type'], string>): string {
  return memory ? labels[memory.type] : '';
}

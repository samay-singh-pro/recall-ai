import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, EMPTY, Observable, catchError, switchMap, tap } from 'rxjs';

import { MemoriesApi } from './memories-api';
import { Memory } from './memory';

/**
 * The memories listed in the sidebar, shared with the pages beside it so a save, rename or
 * delete on any page refreshes the list. Provided by the home page, so it lives as long as it.
 */
@Injectable()
export class MemoryLibrary {
  private readonly memoriesApi = inject(MemoriesApi);
  private readonly reloadRequests = new BehaviorSubject<void>(undefined);
  private readonly memoryList = signal<Memory[]>([]);
  private readonly isLoadingList = signal(true);
  private readonly hasListError = signal(false);

  readonly memories = this.memoryList.asReadonly();
  readonly hasError = this.hasListError.asReadonly();
  // Placeholders only on the first load; later reloads keep the current list on screen.
  readonly isFirstLoad = computed(() => this.isLoadingList() && this.memoryList().length === 0);

  constructor() {
    // Load now and on every reload; switchMap drops a slow older reply so it can't win.
    this.reloadRequests
      .pipe(
        switchMap(() => this.loadMemories()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** Fetch the list again, after a memory was saved, renamed or deleted. */
  reload(): void {
    this.reloadRequests.next();
  }

  private loadMemories(): Observable<Memory[]> {
    this.isLoadingList.set(true);
    this.hasListError.set(false);
    return this.memoriesApi.listMemories().pipe(
      tap((memories) => {
        this.memoryList.set(memories);
        this.isLoadingList.set(false);
      }),
      catchError(() => {
        this.hasListError.set(true);
        this.isLoadingList.set(false);
        return EMPTY;
      }),
    );
  }
}

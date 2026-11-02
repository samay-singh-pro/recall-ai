import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { EMPTY, Observable, catchError, of, switchMap, tap } from 'rxjs';

import { MemoryCard } from '../components/memory-card/memory-card';
import { MemoriesApi } from '../memories-api';
import { SearchResult } from '../search-result';

// Examples that find the sample memories; they show the kind of question that works.
const SUGGESTED_SEARCHES = [
  "What's the wifi password at mom's?",
  'Where did I park at the airport?',
  'When is the rent due?',
  'Which restaurant did Priya recommend?',
  'How much is the Japan trip?',
];
const PLACEHOLDER_CARDS = [1, 2, 3];

/**
 * Global search: describe something in plain words and get a short answer from your memories
 * plus the memories that match. The search lives in the address (`?q=`), so Back returns here.
 */
@Component({
  selector: 'ra-memory-search',
  imports: [NgTemplateOutlet, RouterLink, Button, Skeleton, MemoryCard],
  templateUrl: './memory-search.html',
  styleUrl: './memory-search.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemorySearch {
  private readonly memoriesApi = inject(MemoriesApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Set by the router from `?q=`. */
  readonly q = input<string>();

  protected readonly query = computed(() => (this.q() ?? '').trim());
  protected readonly result = signal<SearchResult | null>(null);
  protected readonly isSearching = signal(false);
  protected readonly hasError = signal(false);
  protected readonly suggestions = SUGGESTED_SEARCHES;
  protected readonly placeholderCards = PLACEHOLDER_CARDS;
  // No sources means several memories matched equally and the user should pick.
  protected readonly resultsHeading = computed(() =>
    this.result()?.answer?.sources.length === 0 ? 'Possible matches' : 'Matching memories',
  );

  constructor() {
    // Search again whenever the words in the address change; a newer search replaces an older one.
    toObservable(this.query)
      .pipe(
        switchMap((query) => this.runSearch(query)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** Run one of the example searches. */
  protected searchFor(query: string): void {
    void this.router.navigate(['/home/search'], { queryParams: { q: query } });
  }

  /** Try the same search again after a failure. */
  protected retry(): void {
    this.runSearch(this.query()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  private runSearch(query: string): Observable<SearchResult | null> {
    this.hasError.set(false);
    this.result.set(null);
    if (!query) return of(null);

    this.isSearching.set(true);
    return this.memoriesApi.searchMemories(query).pipe(
      tap((result) => {
        this.result.set(result);
        this.isSearching.set(false);
      }),
      catchError(() => {
        this.hasError.set(true);
        this.isSearching.set(false);
        return EMPTY;
      }),
    );
  }
}

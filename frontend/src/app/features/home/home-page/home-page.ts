import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { Toast } from 'primeng/toast';
import { filter, map } from 'rxjs';

import { AppHeader } from '../../../layout/app-header/app-header';
import { MemoryPanel } from '../components/memory-panel/memory-panel';
import { SearchBar } from '../components/search-bar/search-bar';
import { MemoriesApi } from '../memories-api';
import { Memory } from '../memory';
import { MemoryLibrary } from '../memory-library';

// Shown until login exists.
const GUEST_NAME = 'Guest';
const SEARCH_URL = '/home/search';

/**
 * The frame of the main screen: the memories sidebar and the header with global search.
 * Its pages (add box, search, memory detail) show in the middle.
 */
@Component({
  selector: 'ra-home-page',
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    Button,
    Drawer,
    Toast,
    AppHeader,
    MemoryPanel,
    SearchBar,
  ],
  // Shared with the pages shown inside: one toast area and one memories list.
  providers: [MessageService, MemoryLibrary],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly memoriesApi = inject(MemoriesApi);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly library = inject(MemoryLibrary);
  protected readonly userName = GUEST_NAME;
  protected readonly isPanelOpen = signal(false);
  // What the header search bar shows: the words of the search on screen, if any.
  protected readonly searchQuery = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.currentSearch()),
    ),
    { initialValue: this.currentSearch() },
  );

  /** Show the search screen for these words. */
  protected search(query: string): void {
    this.isPanelOpen.set(false);
    void this.router.navigate([SEARCH_URL], { queryParams: { q: query } });
  }

  /** Clearing the bar on the search screen goes back to its example searches. */
  protected clearSearch(): void {
    if (this.router.url.startsWith(SEARCH_URL)) void this.router.navigateByUrl(SEARCH_URL);
  }

  /** Go to the add box. */
  protected startNewMemory(): void {
    this.isPanelOpen.set(false);
    void this.router.navigateByUrl('/home');
  }

  /** Open a memory on its own page. */
  protected openMemory(memory: Memory): void {
    this.isPanelOpen.set(false);
    void this.router.navigate(['/home/memories', memory.id]);
  }

  /** Delete a memory (already confirmed by the user) and take it out of the list. */
  protected deleteMemory(memory: Memory): void {
    this.memoriesApi
      .deleteMemory(memory.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Memory deleted' });
          this.library.reload();
          // Its page is gone, so leave it if it's the one on screen.
          if (this.router.url === `/home/memories/${memory.id}`) {
            void this.router.navigateByUrl('/home', { replaceUrl: true });
          }
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: "Couldn't delete. Please try again.",
          });
        },
      });
  }

  private currentSearch(): string {
    if (!this.router.url.startsWith(SEARCH_URL)) return '';
    return this.router.parseUrl(this.router.url).queryParamMap.get('q') ?? '';
  }
}

import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { MemoryPanel } from '../components/memory-panel/memory-panel';
import { SearchBar } from '../components/search-bar/search-bar';
import { HOME_ROUTES } from '../home.routes';
import { MemoriesApi } from '../memories-api';
import { Memory } from '../memory';

const SAVED_MEMORY: Memory = {
  id: '1',
  type: 'text',
  title: 'Movie to watch: Interstellar',
  raw_text: 'Movie to watch: Interstellar',
  attachments: [],
  summary: null,
  link_preview: null,
  source_memory: null,
  created_at: new Date().toISOString(),
};

describe('HomePage', () => {
  let harness: RouterTestingHarness;
  let compiled: HTMLElement;
  let memoriesApi: {
    listMemories: ReturnType<typeof vi.fn>;
    getMemory: ReturnType<typeof vi.fn>;
    searchMemories: ReturnType<typeof vi.fn>;
    deleteMemory: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    memoriesApi = {
      listMemories: vi.fn().mockReturnValue(of([SAVED_MEMORY])),
      getMemory: vi.fn().mockReturnValue(of(SAVED_MEMORY)),
      searchMemories: vi.fn().mockReturnValue(of({ answer: null, memories: [SAVED_MEMORY] })),
      deleteMemory: vi.fn().mockReturnValue(of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'home', children: HOME_ROUTES }], withComponentInputBinding()),
        { provide: MemoriesApi, useValue: memoriesApi },
      ],
    });

    harness = await RouterTestingHarness.create('/home');
    compiled = harness.fixture.nativeElement as HTMLElement;
  });

  function searchBar() {
    return harness.fixture.debugElement.query(By.directive(SearchBar));
  }

  function sidebarPanel() {
    return harness.fixture.debugElement
      .query(By.css('.home__sidebar'))
      .query(By.directive(MemoryPanel));
  }

  function currentUrl(): string {
    return TestBed.inject(Router).url;
  }

  it('lists saved memories beside the add box', () => {
    expect(compiled.querySelector('.home__sidebar')?.textContent).toContain('Interstellar');
    expect(compiled.querySelector('ra-new-memory')).not.toBeNull();
  });

  it('opens the search screen from the header and keeps the words in the bar', async () => {
    searchBar().triggerEventHandler('search', 'movie to watch');
    await harness.fixture.whenStable();

    expect(currentUrl()).toBe('/home/search?q=movie%20to%20watch');
    expect(memoriesApi.searchMemories).toHaveBeenCalledWith('movie to watch');
    expect(compiled.querySelector<HTMLInputElement>('ra-search-bar input')!.value).toBe(
      'movie to watch',
    );
  });

  it('goes back to the example searches when the search is cleared', async () => {
    await harness.navigateByUrl('/home/search?q=movie');

    searchBar().triggerEventHandler('clear');
    await harness.fixture.whenStable();

    expect(currentUrl()).toBe('/home/search');
    expect(compiled.querySelector('.search__suggestion')).not.toBeNull();
  });

  it('opens a memory from the sidebar on its own page', async () => {
    sidebarPanel().triggerEventHandler('openMemory', SAVED_MEMORY);
    await harness.fixture.whenStable();

    expect(currentUrl()).toBe('/home/memories/1');
    expect(compiled.querySelector('ra-memory-detail h1')?.textContent).toContain('Interstellar');
  });

  it('leaves the page of a memory that is deleted from the sidebar', async () => {
    await harness.navigateByUrl('/home/memories/1');
    memoriesApi.listMemories.mockClear();

    sidebarPanel().triggerEventHandler('deleteMemory', SAVED_MEMORY);
    await harness.fixture.whenStable();

    expect(memoriesApi.deleteMemory).toHaveBeenCalledWith('1');
    expect(memoriesApi.listMemories).toHaveBeenCalledOnce();
    expect(currentUrl()).toBe('/home');
  });
});

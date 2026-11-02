import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of, throwError } from 'rxjs';

import { MemoriesApi } from '../memories-api';
import { Memory } from '../memory';
import { SearchResult } from '../search-result';
import { MemorySearch } from './memory-search';

function memoryNamed(id: string, title: string): Memory {
  return {
    id,
    type: 'text',
    title,
    raw_text: title,
    attachments: [],
    summary: null,
    link_preview: null,
    source_memory: null,
    created_at: '2026-10-29T10:00:00.000Z',
  };
}

const WIFI = memoryNamed('wifi', "Mom's wifi password");
const FOUND: SearchResult = {
  answer: { text: 'Password: sunflower42', sources: [{ id: 'wifi', title: WIFI.title }] },
  memories: [WIFI, memoryNamed('router', 'Router manual')],
};

describe('MemorySearch', () => {
  let harness: RouterTestingHarness;
  let compiled: HTMLElement;
  let searchMemories: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    searchMemories = vi.fn().mockReturnValue(of(FOUND));
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'home/search', component: MemorySearch },
            { path: 'home/memories/:memoryId', children: [] },
          ],
          withComponentInputBinding(),
        ),
        { provide: MemoriesApi, useValue: { searchMemories } },
      ],
    });
  });

  async function open(url: string): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    compiled = harness.fixture.nativeElement as HTMLElement;
  }

  it('suggests example searches before anything is searched, and runs one when clicked', async () => {
    await open('/home/search');
    expect(searchMemories).not.toHaveBeenCalled();

    compiled.querySelector<HTMLButtonElement>('.search__suggestion')!.click();
    await harness.fixture.whenStable();

    const router = TestBed.inject(Router);
    expect(router.parseUrl(router.url).queryParamMap.get('q')).toBe(
      "What's the wifi password at mom's?",
    );
    expect(searchMemories).toHaveBeenCalledWith("What's the wifi password at mom's?");
  });

  it('shows the answer, where it came from, and the matching memory cards', async () => {
    await open('/home/search?q=wifi%20password');

    expect(searchMemories).toHaveBeenCalledWith('wifi password');
    expect(compiled.querySelector('.search__answer-text')?.textContent).toBe(
      'Password: sunflower42',
    );
    const source = compiled.querySelector<HTMLAnchorElement>('.search__answer-source')!;
    expect(source.textContent).toBe("Mom's wifi password");
    expect(source.getAttribute('href')).toBe('/home/memories/wifi');
    const cards = Array.from(compiled.querySelectorAll('ra-memory-card .card__title'));
    expect(cards.map((card) => card.textContent)).toEqual(["Mom's wifi password", 'Router manual']);
    expect(compiled.querySelector('.search__results-title')?.textContent).toContain(
      'Matching memories',
    );
  });

  it('calls the results possible matches when the answer asks the user to pick', async () => {
    searchMemories.mockReturnValue(
      of({ ...FOUND, answer: { text: '2 memories could match.', sources: [] } }),
    );

    await open('/home/search?q=wifi');

    expect(compiled.querySelector('.search__answer-source')).toBeNull();
    expect(compiled.querySelector('.search__results-title')?.textContent).toContain(
      'Possible matches',
    );
  });

  it('says so when nothing matches and offers examples', async () => {
    searchMemories.mockReturnValue(of({ answer: null, memories: [] }));

    await open('/home/search?q=passport');

    expect(compiled.querySelector('h1')?.textContent).toContain('Nothing matches "passport"');
    expect(compiled.querySelectorAll('.search__suggestion').length).toBeGreaterThan(0);
  });

  it('shows placeholders while searching', async () => {
    searchMemories.mockReturnValue(new Subject<SearchResult>());

    await open('/home/search?q=wifi');

    expect(compiled.querySelector('.search__loading')).not.toBeNull();
    expect(compiled.querySelector('ra-memory-card')).toBeNull();
  });

  it('offers to try again when the search fails', async () => {
    searchMemories.mockReturnValueOnce(throwError(() => new Error('offline')));
    await open('/home/search?q=wifi');
    expect(compiled.querySelector('h1')?.textContent).toContain("Couldn't search");

    compiled.querySelector<HTMLButtonElement>('.search__state button')!.click();
    await harness.fixture.whenStable();

    expect(searchMemories).toHaveBeenCalledTimes(2);
    expect(compiled.querySelector('.search__answer-text')?.textContent).toBe(
      'Password: sunflower42',
    );
  });
});

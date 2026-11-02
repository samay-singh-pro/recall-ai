import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchBar } from './search-bar';

describe('SearchBar', () => {
  let fixture: ComponentFixture<SearchBar>;
  let compiled: HTMLElement;
  let field: HTMLInputElement;
  let searches: string[];
  let clears: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchBar],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchBar);
    searches = [];
    clears = 0;
    fixture.componentInstance.search.subscribe((query) => searches.push(query));
    fixture.componentInstance.clear.subscribe(() => clears++);
    await fixture.whenStable();
    compiled = fixture.nativeElement as HTMLElement;
    field = compiled.querySelector('input')!;
  });

  async function type(text: string): Promise<void> {
    field.value = text;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('searches on Enter and keeps the words in the bar', async () => {
    await type('  wifi password  ');

    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(searches).toEqual(['wifi password']);
    expect(field.value).toBe('  wifi password  ');
  });

  it('ignores Enter when nothing is typed', async () => {
    await type('   ');

    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(searches).toEqual([]);
  });

  it('shows the current search and clears it with the × button', async () => {
    fixture.componentRef.setInput('query', 'rent due');
    await fixture.whenStable();
    expect(field.value).toBe('rent due');

    compiled.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]')!.click();
    await fixture.whenStable();

    expect(field.value).toBe('');
    expect(clears).toBe(1);
    expect(compiled.querySelector('button[aria-label="Clear search"]')).toBeNull();
  });

  it('jumps to the bar with Ctrl+K', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));

    expect(document.activeElement).toBe(field);
  });
});

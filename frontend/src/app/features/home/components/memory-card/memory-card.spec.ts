import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture } from '@angular/core/testing';

import { Attachment } from '../../attachment';
import { Memory } from '../../memory';
import { MemoryCard, snippetOf } from './memory-card';

const PHOTO: Attachment = {
  id: 'a1',
  kind: 'image',
  file_name: 'spot.png',
  file_url: 'blob:spot',
  file_size: 2048,
  preview_rows: null,
};

function memoryOf(overrides: Partial<Memory>): Memory {
  return {
    id: 'm1',
    type: 'text',
    title: "Mom's wifi password",
    raw_text: "Mom's wifi\nPassword: sunflower42",
    attachments: [],
    summary: null,
    link_preview: null,
    source_memory: null,
    created_at: '2026-10-29T10:00:00.000Z',
    ...overrides,
  };
}

describe('snippetOf', () => {
  it('joins the lines of a note into one', () => {
    expect(snippetOf(memoryOf({}))).toBe("Mom's wifi · Password: sunflower42");
  });

  it("shows a page's description for a link and the summary for a file", () => {
    const link = memoryOf({
      type: 'link',
      raw_text: 'https://shop.example/dress',
      link_preview: { title: 'Dress', description: 'Light linen dress.' },
    });
    const pdf = memoryOf({ type: 'pdf', raw_text: null, summary: 'Rent is due by the 5th.' });

    expect(snippetOf(link)).toBe('Light linen dress.');
    expect(snippetOf(pdf)).toBe('Rent is due by the 5th.');
  });

  it("doesn't repeat a title that is the whole note", () => {
    expect(snippetOf(memoryOf({ title: 'Gym at 7', raw_text: 'Gym at 7' }))).toBe('');
  });
});

describe('MemoryCard', () => {
  let fixture: ComponentFixture<MemoryCard>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemoryCard],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MemoryCard);
    compiled = fixture.nativeElement as HTMLElement;
  });

  async function render(memory: Memory): Promise<void> {
    fixture.componentRef.setInput('memory', memory);
    await fixture.whenStable();
  }

  it('shows the title, type, snippet and date, and links to the memory', async () => {
    await render(memoryOf({}));

    expect(compiled.querySelector('.card__title')?.textContent).toBe("Mom's wifi password");
    expect(compiled.querySelector('.card__type')?.textContent).toBe('Text');
    expect(compiled.querySelector('.card__snippet')?.textContent).toContain('sunflower42');
    expect(compiled.querySelector('.card__meta')?.textContent).toContain('Oct 29, 2026');
    expect(compiled.querySelector('a')?.getAttribute('href')).toBe('/home/memories/m1');
  });

  it('shows a photo as its own thumbnail with its file count', async () => {
    await render(memoryOf({ type: 'image', raw_text: null, attachments: [PHOTO] }));

    expect(compiled.querySelector('.card__thumb img')?.getAttribute('src')).toBe('blob:spot');
    expect(compiled.querySelector('.card__files')?.textContent?.trim()).toBe('1');
  });
});

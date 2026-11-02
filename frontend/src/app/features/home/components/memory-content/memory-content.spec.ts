import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Attachment } from '../../attachment';
import { Memory } from '../../memory';
import { MemoryContent, domainOf, partsOf } from './memory-content';

const TICKET: Attachment = {
  id: 'a1',
  kind: 'image',
  file_name: 'ticket.png',
  file_url: 'blob:ticket',
  file_size: 2048,
  preview_rows: null,
};
const BILL: Attachment = {
  ...TICKET,
  id: 'a2',
  kind: 'pdf',
  file_name: 'bill.pdf',
  file_url: 'blob:bill',
};

function memoryOf(overrides: Partial<Memory>): Memory {
  return {
    id: 'm1',
    type: 'text',
    title: 'Concert night',
    raw_text: 'Concert night, Row F seat 12',
    attachments: [],
    summary: null,
    link_preview: null,
    source_memory: null,
    created_at: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('domainOf', () => {
  it('shows only the site name of a link', () => {
    expect(domainOf('https://www.shop.example/dress?size=m')).toBe('shop.example');
    expect(domainOf('not a link')).toBe('not a link');
  });
});

describe('partsOf', () => {
  it('lists the typed text first, then each file with its type and size', () => {
    const parts = partsOf(memoryOf({ attachments: [TICKET, BILL] }));

    expect(parts.map(({ label, details }) => [label, details])).toEqual([
      ['Note', '6 words'],
      ['ticket.png', 'PNG · 2 KB'],
      ['bill.pdf', 'PDF · 2 KB'],
    ]);
  });

  it('names a saved link after its site', () => {
    const [part] = partsOf(memoryOf({ type: 'link', raw_text: 'https://www.shop.example/a' }));

    expect([part.label, part.details]).toEqual(['shop.example', 'Web page']);
  });
});

describe('MemoryContent', () => {
  let fixture: ComponentFixture<MemoryContent>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemoryContent],
    }).compileComponents();

    fixture = TestBed.createComponent(MemoryContent);
    compiled = fixture.nativeElement as HTMLElement;
  });

  async function render(memory: Memory): Promise<void> {
    fixture.componentRef.setInput('memory', memory);
    await fixture.whenStable();
  }

  it('shows a note as written, with a Copy button that hands over its text', async () => {
    const copied: string[] = [];
    fixture.componentInstance.copyText.subscribe((text) => copied.push(text));
    await render(memoryOf({}));

    compiled.querySelector<HTMLButtonElement>('.viewer__actions button')!.click();

    expect(compiled.querySelector('.viewer__text')?.textContent).toBe(
      'Concert night, Row F seat 12',
    );
    expect(compiled.querySelector('.viewer__parts')).toBeNull();
    expect(copied).toEqual(['Concert night, Row F seat 12']);
  });

  it('shows one part at a time and switches between text and files', async () => {
    await render(memoryOf({ attachments: [TICKET, BILL] }));
    expect(compiled.querySelector('.viewer__label')?.textContent).toBe('Note');

    const options = Array.from(
      compiled.querySelectorAll<HTMLElement>('.viewer__parts p-togglebutton'),
    );
    options.find((option) => option.textContent?.includes('bill.pdf'))!.click();
    await fixture.whenStable();

    expect(compiled.querySelector('.viewer__label')?.textContent).toBe('bill.pdf');
    expect(compiled.querySelector('iframe')?.getAttribute('src')).toBe('blob:bill');
    expect(compiled.querySelector('.viewer__text')).toBeNull();
    const download = compiled.querySelector<HTMLAnchorElement>('.viewer__actions a[download]')!;
    expect(download.getAttribute('download')).toBe('bill.pdf');
  });

  it('starts on the first part again when another memory is shown', async () => {
    await render(memoryOf({ attachments: [TICKET, BILL] }));
    compiled.querySelectorAll<HTMLElement>('.viewer__parts p-togglebutton')[2].click();
    await fixture.whenStable();

    await render(memoryOf({ id: 'm2', raw_text: null, attachments: [TICKET, BILL] }));

    expect(compiled.querySelector('.viewer__label')?.textContent).toBe('ticket.png');
  });

  it("shows a saved page's site, title and description with a link to open it", async () => {
    await render(
      memoryOf({
        type: 'link',
        raw_text: 'https://www.shop.example/dress',
        link_preview: { title: 'Linen summer dress', description: 'Light and breathable.' },
      }),
    );

    expect(compiled.querySelector('.viewer__link-domain')?.textContent).toBe('shop.example');
    expect(compiled.querySelector('.viewer__link-title')?.textContent).toBe('Linen summer dress');
    expect(compiled.textContent).toContain('Light and breathable.');
    const open = compiled.querySelector<HTMLAnchorElement>('.viewer__actions a')!;
    expect(open.textContent).toContain('Open link');
    expect(open.getAttribute('href')).toBe('https://www.shop.example/dress');
    expect(open.getAttribute('target')).toBe('_blank');
  });

  it('still offers a saved link when its page could not be read', async () => {
    await render(memoryOf({ type: 'map', raw_text: 'https://maps.app.goo.gl/abc' }));

    expect(compiled.querySelector('.viewer__link-title')).toBeNull();
    expect(compiled.querySelector('.viewer__actions a')?.textContent).toContain('Open in Maps');
  });
});

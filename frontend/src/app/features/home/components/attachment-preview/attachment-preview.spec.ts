import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Attachment } from '../../attachment';
import {
  AttachmentPreview,
  describeFile,
  describeFileSize,
  fileTypeOf,
} from './attachment-preview';

function attachmentOf(overrides: Partial<Attachment>): Attachment {
  return {
    id: 'a1',
    kind: 'image',
    file_name: 'photo.png',
    file_url: 'blob:photo',
    file_size: 2048,
    preview_rows: null,
    ...overrides,
  };
}

describe('file descriptions', () => {
  it('shows small files in KB and larger ones in MB', () => {
    expect(describeFileSize(300)).toBe('1 KB');
    expect(describeFileSize(820 * 1024)).toBe('820 KB');
    expect(describeFileSize(2.4 * 1024 * 1024)).toBe('2.4 MB');
  });

  it('names the file type from its extension', () => {
    expect(fileTypeOf('Trip budget.v2.xlsx')).toBe('XLSX');
    expect(fileTypeOf('README')).toBe('FILE');
    expect(describeFile(attachmentOf({}))).toBe('PNG · 2 KB');
  });
});

describe('AttachmentPreview', () => {
  let fixture: ComponentFixture<AttachmentPreview>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttachmentPreview],
    }).compileComponents();

    fixture = TestBed.createComponent(AttachmentPreview);
    compiled = fixture.nativeElement as HTMLElement;
  });

  async function render(attachment: Attachment): Promise<void> {
    fixture.componentRef.setInput('attachment', attachment);
    await fixture.whenStable();
  }

  it('shows a picture', async () => {
    await render(attachmentOf({}));

    expect(compiled.querySelector('img')?.getAttribute('src')).toBe('blob:photo');
  });

  it('shows a PDF in the browser viewer', async () => {
    await render(attachmentOf({ kind: 'pdf', file_name: 'bill.pdf', file_url: 'blob:bill' }));

    expect(compiled.querySelector('iframe')?.getAttribute('src')).toBe('blob:bill');
  });

  it('shows the first rows of a spreadsheet as a table', async () => {
    await render(
      attachmentOf({
        kind: 'excel',
        file_name: 'budget.xlsx',
        preview_rows: [
          ['Item', 'Cost'],
          ['Flights', '1480'],
          ['Hotel', '960'],
        ],
      }),
    );

    const headings = Array.from(compiled.querySelectorAll('th')).map((cell) => cell.textContent);
    const rows = Array.from(compiled.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent),
    );
    expect(headings).toEqual(['Item', 'Cost']);
    expect(rows).toEqual([
      ['Flights', '1480'],
      ['Hotel', '960'],
    ]);
  });

  it('offers a download card for a file it has no preview for', async () => {
    await render(
      attachmentOf({ kind: 'excel', file_name: 'budget.xlsx', file_url: 'blob:budget' }),
    );

    expect(compiled.querySelector('img, iframe, table')).toBeNull();
    expect(compiled.textContent).toContain('XLSX · 2 KB · No preview available');
    const download = compiled.querySelector<HTMLAnchorElement>('a[download]')!;
    expect(download.getAttribute('href')).toBe('blob:budget');
    expect(download.getAttribute('download')).toBe('budget.xlsx');
  });
});

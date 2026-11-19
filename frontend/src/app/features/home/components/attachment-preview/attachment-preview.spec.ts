import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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
    file_url: '/api/v1/memories/m1/attachments/a1/file',
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
  let backend: HttpTestingController;

  beforeEach(async () => {
    // jsdom has no blob links; the preview makes one from the downloaded file.
    URL.createObjectURL = vi.fn(() => 'blob:downloaded-file');
    URL.revokeObjectURL = vi.fn();
    await TestBed.configureTestingModule({
      imports: [AttachmentPreview],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AttachmentPreview);
    compiled = fixture.nativeElement as HTMLElement;
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  async function render(attachment: Attachment): Promise<void> {
    fixture.componentRef.setInput('attachment', attachment);
    await fixture.whenStable();
  }

  // Not `whenStable`: it would wait for the download, which only finishes once the test answers it.
  function renderWhileDownloading(attachment: Attachment): void {
    fixture.componentRef.setInput('attachment', attachment);
    fixture.detectChanges();
  }

  /** Answer the file download the preview asked for. */
  async function answerDownload(url: string, file: Blob): Promise<void> {
    backend.expectOne(url).flush(file);
    await fixture.whenStable();
  }

  it('downloads the file and shows a picture', async () => {
    renderWhileDownloading(attachmentOf({}));
    expect(compiled.textContent).toContain('Loading');
    expect(compiled.querySelector('img')).toBeNull();

    await answerDownload('/api/v1/memories/m1/attachments/a1/file', new Blob(['x']));

    expect(compiled.querySelector('img')?.getAttribute('src')).toBe('blob:downloaded-file');
  });

  it('downloads a PDF and shows it in the browser viewer', async () => {
    renderWhileDownloading(
      attachmentOf({ kind: 'pdf', file_name: 'bill.pdf', file_url: '/api/v1/files/bill' }),
    );

    await answerDownload('/api/v1/files/bill', new Blob(['x']));

    expect(compiled.querySelector('iframe')?.getAttribute('src')).toBe('blob:downloaded-file');
  });

  it('says so when the file cannot be downloaded', async () => {
    renderWhileDownloading(attachmentOf({}));

    backend
      .expectOne('/api/v1/memories/m1/attachments/a1/file')
      .flush(new Blob(['']), { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(compiled.textContent).toContain("Couldn't load this file");
    expect(compiled.querySelector('img')).toBeNull();
  });

  it('frees the temporary link when the preview is removed', async () => {
    renderWhileDownloading(attachmentOf({}));
    await answerDownload('/api/v1/memories/m1/attachments/a1/file', new Blob(['x']));

    fixture.destroy();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:downloaded-file');
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
    backend.expectNone(() => true);
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
  });

  it('downloads the file with the login token when Download is pressed', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    await render(
      attachmentOf({ kind: 'excel', file_name: 'budget.xlsx', file_url: '/api/v1/files/budget' }),
    );

    compiled.querySelector<HTMLButtonElement>('button')!.click();
    backend.expectOne('/api/v1/files/budget').flush(new Blob(['']));

    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
});

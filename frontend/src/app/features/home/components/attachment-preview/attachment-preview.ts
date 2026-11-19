import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  OnDestroy,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Image } from 'primeng/image';
import { TableModule } from 'primeng/table';
import { Subscription } from 'rxjs';

import { Attachment } from '../../attachment';
import { AttachmentFilesApi } from '../../attachment-files-api';
import { MEMORY_TYPE_ICONS } from '../../memory-type-display';

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;
// PrimeNG draws the <img> itself, so its look is passed in; it fits inside the viewer's stage.
const IMAGE_STYLE = {
  display: 'block',
  maxWidth: '100%',
  maxHeight: 'calc(var(--ra-stage-height) - 2rem)',
  objectFit: 'contain',
  borderRadius: '0.5rem',
  cursor: 'zoom-in',
};

/**
 * The preview of one attached file, filling the viewer's stage: a fitted picture, the PDF
 * viewer, the first rows of a spreadsheet, or a download card when there is no preview.
 */
@Component({
  selector: 'ra-attachment-preview',
  imports: [ButtonDirective, ButtonIcon, ButtonLabel, Image, TableModule],
  templateUrl: './attachment-preview.html',
  styleUrl: './attachment-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttachmentPreview implements OnChanges, OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly filesApi = inject(AttachmentFilesApi);

  readonly attachment = input.required<Attachment>();

  // The downloaded file: a temporary link the browser can show. Null until it has arrived.
  protected readonly fileUrl = signal<string | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly hasFailed = signal(false);
  private download: Subscription | undefined;

  protected readonly imageStyle = IMAGE_STYLE;
  protected readonly icon = computed(() => MEMORY_TYPE_ICONS[this.attachment().kind]);
  protected readonly details = computed(() => describeFile(this.attachment()));
  // Angular blocks URLs in <iframe> unless marked trusted; this one was made by us just above.
  protected readonly pdfUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.fileUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  protected readonly sheet = computed(() => {
    const [headers, ...rows] = this.attachment().preview_rows ?? [];
    return headers ? { headers, rows } : null;
  });

  /** Runs each time this component is given a file: download it, unless it is a spreadsheet. */
  ngOnChanges(): void {
    this.clear();
    const { kind, file_url } = this.attachment();
    // A spreadsheet is not downloaded here: its first rows come with the memory.
    if (kind === 'excel') return;

    this.isLoading.set(true);
    this.download = this.filesApi.loadFileUrl(file_url).subscribe({
      next: (url) => {
        this.fileUrl.set(url);
        this.isLoading.set(false);
      },
      error: () => {
        this.hasFailed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.clear();
  }

  /** Stop any download in progress and free the temporary link (it takes browser memory). */
  private clear(): void {
    this.download?.unsubscribe();
    const url = this.fileUrl();
    if (url) URL.revokeObjectURL(url);
    this.fileUrl.set(null);
    this.isLoading.set(false);
    this.hasFailed.set(false);
  }
}

/** "PDF · 2 KB" for a file's type and size. */
export function describeFile(attachment: Attachment): string {
  return `${fileTypeOf(attachment.file_name)} · ${describeFileSize(attachment.file_size)}`;
}

/** "XLSX" from "budget.xlsx"; "FILE" when the name has no extension. */
export function fileTypeOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toUpperCase() : 'FILE';
}

/** "820 KB" or "2.4 MB". */
export function describeFileSize(bytes: number): string {
  if (bytes < BYTES_PER_MB) return `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`;
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
}

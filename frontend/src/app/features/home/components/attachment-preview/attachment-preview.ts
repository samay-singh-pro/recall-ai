import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Image } from 'primeng/image';
import { TableModule } from 'primeng/table';

import { Attachment } from '../../attachment';
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
export class AttachmentPreview {
  private readonly sanitizer = inject(DomSanitizer);

  readonly attachment = input.required<Attachment>();

  protected readonly imageStyle = IMAGE_STYLE;
  protected readonly icon = computed(() => MEMORY_TYPE_ICONS[this.attachment().kind]);
  protected readonly details = computed(() => describeFile(this.attachment()));
  // Angular blocks URLs in <iframe> unless marked trusted; the URL comes from our own API.
  protected readonly pdfUrl = computed<SafeResourceUrl | null>(() => {
    const { kind, file_url } = this.attachment();
    return kind === 'pdf' ? this.sanitizer.bypassSecurityTrustResourceUrl(file_url) : null;
  });
  protected readonly sheet = computed(() => {
    const [headers, ...rows] = this.attachment().preview_rows ?? [];
    return headers ? { headers, rows } : null;
  });
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

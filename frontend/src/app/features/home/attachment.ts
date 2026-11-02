/** Kind of file attached to a memory. */
export type AttachmentKind = 'image' | 'pdf' | 'excel';

/** One file saved as part of a memory (`AttachmentResponse`). */
export interface Attachment {
  id: string;
  kind: AttachmentKind;
  file_name: string;
  /** Where the file can be viewed or downloaded. */
  file_url: string;
  /** Size in bytes. */
  file_size: number;
  /** For spreadsheets: the first rows, read by the backend, header row first; otherwise null. */
  preview_rows: string[][] | null;
}

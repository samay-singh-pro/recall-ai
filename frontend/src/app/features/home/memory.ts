import { Attachment } from './attachment';
import { LinkPreview } from './link-preview';
import { MemoryReference } from './memory-reference';

/**
 * What a memory mainly is; mirrors the backend `memories.type` column.
 * Decided by the typed text when there is some (note, link, map), otherwise by the first file.
 */
export type MemoryType = 'text' | 'image' | 'pdf' | 'excel' | 'link' | 'map';

/** One saved memory: what the user typed and attached before pressing Remember (`MemoryResponse`). */
export interface Memory {
  id: string;
  type: MemoryType;
  title: string;
  /** The typed text; null when only files were saved. */
  raw_text: string | null;
  attachments: Attachment[];
  /** A 1-3 line AI summary; null when there is nothing useful to add to the original. */
  summary: string | null;
  /** For a saved link: the page's title and description; otherwise null. */
  link_preview: LinkPreview | null;
  /** For a saved answer: the memory it was asked about; otherwise null. */
  source_memory: MemoryReference | null;
  created_at: string;
}

import { Memory } from './memory';
import { MemoryReference } from './memory-reference';

/** A short answer drawn only from the user's memories, with the memories it came from. */
export interface SearchAnswer {
  text: string;
  /** Empty when several memories could match equally, so the user picks instead of a guess. */
  sources: MemoryReference[];
}

/** What a search finds (`SearchResponse`). */
export interface SearchResult {
  /** Null when nothing matched. */
  answer: SearchAnswer | null;
  /** Best matches first, at most five. */
  memories: Memory[];
}

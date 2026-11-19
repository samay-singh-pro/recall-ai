import { Memory } from './memory';

/** What the backend returns for a search (`MemorySearchResponse`). */
export interface MemorySearchResponse {
  items: Memory[];
}

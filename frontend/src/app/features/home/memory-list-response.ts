import { Memory } from './memory';

/** One page of the user's memories, newest first (`MemoryListResponse`). */
export interface MemoryListResponse {
  items: Memory[];
  /** How many memories the user has in all. */
  total: number;
  limit: number;
  offset: number;
}

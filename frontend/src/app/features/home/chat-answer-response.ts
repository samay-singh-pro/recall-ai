import { Memory } from './memory';

/** What the backend returns for a question (`ChatAnswerResponse`). */
export interface ChatAnswerResponse {
  answer: string;
  /** The memories the answer was written from, best match first. */
  memories: Memory[];
}

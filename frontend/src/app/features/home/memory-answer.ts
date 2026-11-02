/** The answer to a question asked about one memory; never stored unless the user saves it. */
export interface MemoryAnswer {
  question: string;
  text: string;
  /** False when the memory doesn't contain the answer (then `text` says so and can't be saved). */
  found: boolean;
}

import { Injectable } from '@angular/core';
import { Observable, delay, of, switchMap, throwError, timer } from 'rxjs';

import { Attachment, AttachmentKind } from './attachment';
import { Memory, MemoryType } from './memory';
import { MemoryAnswer } from './memory-answer';
import { MemoryDraft } from './memory-draft';
import { MemoryUpdate } from './memory-update';
import { createSampleMemories } from './sample-memories';
import { SearchAnswer, SearchResult } from './search-result';

// Pretend network delays so loading states are visible before the backend exists.
const FAKE_LATENCY_MS = 200;
const FAKE_THINKING_MS = 900;
const TITLE_MAX_LENGTH = 60;
const MAX_RESULTS = 5;
const MIN_KEYWORD_LENGTH = 3;
const URL_PATTERN = /^https?:\/\/\S+$/i;
const MAP_URL_PATTERN = /^https?:\/\/(maps\.app\.goo\.gl|(www\.)?google\.[a-z.]+\/maps)/i;
// Words that say how the user asks, not what they ask about.
const QUESTION_WORDS = new Set([
  'what',
  'which',
  'when',
  'where',
  'who',
  'how',
  'was',
  'were',
  'the',
  'that',
  'this',
  'did',
  'does',
  'and',
  'for',
  'from',
  'about',
  'stored',
  'saved',
  'save',
  'store',
  'added',
  'few',
  'days',
  'back',
  'ago',
  'some',
  'name',
  'remember',
  'you',
  'your',
  'have',
  'had',
  'its',
  'ok',
  'okay',
  'much',
  'many',
  'are',
  'can',
  'there',
]);
// Rough word endings to drop so "parking" also finds "parked" (the backend will use embeddings).
const WORD_ENDINGS = /(ing|ed|es|s)$/;
// Where a passage ends: after a sentence or at a line break.
const PASSAGE_BREAK = /(?<=[.!?])\s+|\n+/;

/**
 * Saves, lists, deletes and answers questions about the user's memories.
 * Temporary in-browser version: it starts with sample memories, data and files reset on refresh,
 * uploads are served from local `blob:` links, and answers are simple keyword matches standing in
 * for the backend AI agent.
 */
@Injectable({
  providedIn: 'root',
})
export class MemoriesApi {
  private memories: Memory[] = createSampleMemories();

  /** Save the typed text and all attached files together as one memory. */
  createMemory(draft: MemoryDraft): Observable<Memory> {
    const text = draft.text.trim();
    const attachments = draft.files.map((file) => this.attach(file));
    const memory: Memory = {
      id: crypto.randomUUID(),
      type: text ? this.detectTextType(text) : attachments[0].kind,
      title: this.makeTitle(text, attachments),
      raw_text: text || null,
      attachments,
      // The backend AI writes summaries and reads link pages; the stand-in can't.
      summary: null,
      link_preview: null,
      source_memory: null,
      created_at: new Date().toISOString(),
    };
    this.memories = [memory, ...this.memories];
    return of(memory).pipe(delay(FAKE_LATENCY_MS));
  }

  /** Delete a memory and free its files. */
  deleteMemory(memoryId: string): Observable<void> {
    const memory = this.memories.find((candidate) => candidate.id === memoryId);
    memory?.attachments
      .filter((attachment) => attachment.file_url.startsWith('blob:'))
      .forEach((attachment) => URL.revokeObjectURL(attachment.file_url));
    this.memories = this.memories.filter((candidate) => candidate.id !== memoryId);
    return of(undefined).pipe(delay(FAKE_LATENCY_MS));
  }

  /** List memories newest first. */
  listMemories(): Observable<Memory[]> {
    return of(this.memories).pipe(delay(FAKE_LATENCY_MS));
  }

  /** Get one memory; fails when it doesn't exist (the backend answers 404). */
  getMemory(memoryId: string): Observable<Memory> {
    const memory = this.memories.find((candidate) => candidate.id === memoryId);
    if (!memory) return failLater('Memory not found');
    return of(memory).pipe(delay(FAKE_LATENCY_MS));
  }

  /** Change a memory's title and return the updated memory. */
  updateMemory(memoryId: string, changes: MemoryUpdate): Observable<Memory> {
    const memory = this.memories.find((candidate) => candidate.id === memoryId);
    if (!memory) return failLater('Memory not found');
    const updated = { ...memory, title: changes.title.trim() };
    this.memories = this.memories.map((candidate) =>
      candidate.id === memoryId ? updated : candidate,
    );
    return of(updated).pipe(delay(FAKE_LATENCY_MS));
  }

  /**
   * Answer a question using only this one memory. When the memory doesn't contain the answer,
   * say so rather than guess (`found: false`).
   */
  askMemory(memoryId: string, question: string): Observable<MemoryAnswer> {
    const memory = this.memories.find((candidate) => candidate.id === memoryId);
    if (!memory) return failLater('Memory not found');
    const passage = bestPassage(memory, keywordsOf(question));
    const answer: MemoryAnswer = passage
      ? { question, text: passage, found: true }
      : { question, text: "This memory doesn't say anything about that.", found: false };
    return of(answer).pipe(delay(FAKE_THINKING_MS));
  }

  /** Keep an answer as a new text memory that points back to the memory it was asked about. */
  saveAnswer(memoryId: string, answer: MemoryAnswer): Observable<Memory> {
    const source = this.memories.find((candidate) => candidate.id === memoryId);
    if (!source) return failLater('Memory not found');
    const memory: Memory = {
      id: crypto.randomUUID(),
      type: 'text',
      title: answer.question.trim().slice(0, TITLE_MAX_LENGTH),
      raw_text: answer.text,
      attachments: [],
      summary: null,
      link_preview: null,
      source_memory: { id: source.id, title: source.title },
      created_at: new Date().toISOString(),
    };
    this.memories = [memory, ...this.memories];
    return of(memory).pipe(delay(FAKE_LATENCY_MS));
  }

  /**
   * Find memories described in plain words, with a short answer drawn only from them.
   * When several memories match equally well, the answer asks which one instead of guessing.
   */
  searchMemories(query: string): Observable<SearchResult> {
    const keywords = keywordsOf(query);
    const ranked = this.memories
      .map((memory) => ({ memory, score: scoreOf(memory, keywords) }))
      .filter((match) => match.score > 0)
      // Stable sort: equally good matches stay newest first.
      .sort((first, second) => second.score - first.score)
      .slice(0, MAX_RESULTS);
    const result: SearchResult = {
      answer: answerFrom(ranked, keywords),
      memories: ranked.map((match) => match.memory),
    };
    return of(result).pipe(delay(FAKE_THINKING_MS));
  }

  // The backend will own titles, type detection and file storage; this mimics them for now.
  private makeTitle(text: string, attachments: Attachment[]): string {
    if (text) return text.slice(0, TITLE_MAX_LENGTH);
    const [first, ...others] = attachments;
    return others.length > 0 ? `${first.file_name} + ${others.length} more` : first.file_name;
  }

  private attach(file: File): Attachment {
    return {
      id: crypto.randomUUID(),
      kind: this.detectFileKind(file),
      file_name: file.name,
      file_url: URL.createObjectURL(file),
      file_size: file.size,
      // The backend will read the first rows of spreadsheets; the stand-in can't.
      preview_rows: null,
    };
  }

  private detectTextType(text: string): MemoryType {
    if (MAP_URL_PATTERN.test(text)) return 'map';
    if (URL_PATTERN.test(text)) return 'link';
    return 'text';
  }

  private detectFileKind(file: File): AttachmentKind {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    return 'excel';
  }
}

/** The words of a question that say what it's about, with rough word endings removed. */
function keywordsOf(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= MIN_KEYWORD_LENGTH && !QUESTION_WORDS.has(word))
    .map((word) => {
      const stem = word.replace(WORD_ENDINGS, '');
      return stem.length >= MIN_KEYWORD_LENGTH ? stem : word;
    });
}

/**
 * The sentence or line of a memory that best answers the keywords, or null if none mentions
 * them. A bare web address isn't an answer, nor is a heading line that only repeats the title
 * (unless it's the whole note).
 */
function bestPassage(memory: Memory, keywords: string[]): string | null {
  const title = memory.title.toLowerCase();
  const wholeNote = memory.raw_text?.trim();
  let best: string | null = null;
  let bestHits = 0;
  for (const passage of passagesOf(memory)) {
    const text = passage.toLowerCase();
    if (URL_PATTERN.test(passage)) continue;
    if (title.includes(text) && passage !== wholeNote) continue;
    const hits = keywords.filter((keyword) => text.includes(keyword)).length;
    if (hits > bestHits) {
      best = passage;
      bestHits = hits;
    }
  }
  return best;
}

/** Everything the stand-in can read in a memory, cut into sentences, lines and table rows. */
function passagesOf(memory: Memory): string[] {
  const texts = [memory.raw_text, memory.summary, memory.link_preview?.description ?? null];
  const sentences = texts
    .filter((text): text is string => !!text)
    .flatMap((text) => text.split(PASSAGE_BREAK))
    .map((passage) => passage.trim())
    .filter(Boolean);
  const rows = memory.attachments.flatMap((attachment) => describeRows(attachment.preview_rows));
  return [...sentences, ...rows];
}

/** "Hotel Shinjuku, 5 nights: Category Stay, Cost (USD) 960, Booked Yes" for each table row. */
function describeRows(rows: string[][] | null): string[] {
  if (!rows) return [];
  const [headers, ...body] = rows;
  return body.map(([name, ...cells]) => {
    const details = cells
      .map((cell, index) => (cell && cell !== '-' ? `${headers[index + 1]} ${cell}` : ''))
      .filter(Boolean);
    return details.length > 0 ? `${name}: ${details.join(', ')}` : name;
  });
}

// `delay` only holds back values, so a pretend failure waits on a timer instead.
function failLater(message: string): Observable<never> {
  return timer(FAKE_LATENCY_MS).pipe(switchMap(() => throwError(() => new Error(message))));
}

/** How many of the keywords a memory mentions anywhere (title, text, files, table rows). */
function scoreOf(memory: Memory, keywords: string[]): number {
  const searchable = [
    memory.title,
    ...passagesOf(memory),
    ...memory.attachments.map((attachment) => attachment.file_name),
  ]
    .join(' ')
    .toLowerCase();
  return keywords.filter((keyword) => searchable.includes(keyword)).length;
}

/** One clear best match gets a short answer from it; a tie asks the user to pick. */
function answerFrom(
  ranked: { memory: Memory; score: number }[],
  keywords: string[],
): SearchAnswer | null {
  const [best, second] = ranked;
  if (!best) return null;
  if (second && second.score === best.score) {
    const count = ranked.filter((match) => match.score === best.score).length;
    return { text: `${count} memories could match. Which one do you mean?`, sources: [] };
  }
  const memory = best.memory;
  const text =
    bestPassage(memory, keywords) ?? memory.summary ?? `"${memory.title}" looks like the one.`;
  return { text, sources: [{ id: memory.id, title: memory.title }] };
}

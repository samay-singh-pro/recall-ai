import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, map, of, switchMap, tap, throwError, timer } from 'rxjs';

import { API_BASE_URL } from '../../core/config/api-config';
import { Memory } from './memory';
import { MemoryAnswer } from './memory-answer';
import { MemoryDraft } from './memory-draft';
import { MemoryListResponse } from './memory-list-response';
import { MemorySearchResponse } from './memory-search-response';
import { MemoryUpdate } from './memory-update';
import { SearchResult } from './search-result';

const MEMORIES_URL = `${API_BASE_URL}/memories`;
// The backend allows at most 100 per page; paging in the UI comes later.
const LIST_LIMIT = 100;

// Pretend network delays so loading states are visible before the backend exists.
const FAKE_LATENCY_MS = 200;
const FAKE_THINKING_MS = 900;
const TITLE_MAX_LENGTH = 60;
const SEARCH_LIMIT = 5;
const MIN_KEYWORD_LENGTH = 3;
const URL_PATTERN = /^https?:\/\/\S+$/i;
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
 * Saves, lists, reads and deletes the user's memories on the backend. Renaming, asking and
 * searching are still an in-browser stand-in (simple keyword matches) until the backend has them;
 * they work on `memories`, a copy of the memories loaded from the backend so far.
 */
@Injectable({
  providedIn: 'root',
})
export class MemoriesApi {
  private readonly http = inject(HttpClient);
  private memories: Memory[] = [];

  /** Save the typed text and all attached files together as one memory. */
  createMemory(draft: MemoryDraft): Observable<Memory> {
    // The backend expects a form (not JSON) because files travel with the text.
    const form = new FormData();
    const text = draft.text.trim();
    if (text) form.append('text', text);
    draft.files.forEach((file) => form.append('files', file));

    return this.http
      .post<Memory>(MEMORIES_URL, form)
      .pipe(tap((memory) => (this.memories = [memory, ...this.memories])));
  }

  /** Delete a memory and its files. */
  deleteMemory(memoryId: string): Observable<void> {
    return this.http
      .delete<void>(`${MEMORIES_URL}/${memoryId}`)
      .pipe(tap(() => (this.memories = this.memories.filter((memory) => memory.id !== memoryId))));
  }

  /** List memories newest first (the first 100 for now). */
  listMemories(): Observable<Memory[]> {
    return this.http.get<MemoryListResponse>(MEMORIES_URL, { params: { limit: LIST_LIMIT } }).pipe(
      map((page) => page.items),
      tap((memories) => (this.memories = memories)),
    );
  }

  /** Get one memory; fails with a 404 when it doesn't exist or isn't the user's. */
  getMemory(memoryId: string): Observable<Memory> {
    return this.http.get<Memory>(`${MEMORIES_URL}/${memoryId}`).pipe(
      tap((loaded) => {
        const isKnown = this.memories.some((memory) => memory.id === loaded.id);
        this.memories = isKnown
          ? this.memories.map((memory) => (memory.id === loaded.id ? loaded : memory))
          : [...this.memories, loaded];
      }),
    );
  }

  /** Change a memory's title and return the updated memory. */
  updateMemory(memoryId: string, changes: MemoryUpdate): Observable<Memory> {
    return this.http
      .patch<Memory>(`${MEMORIES_URL}/${memoryId}`, { title: changes.title.trim() })
      .pipe(
        tap((updated) => {
          this.memories = this.memories.map((memory) =>
            memory.id === memoryId ? updated : memory,
          );
        }),
      );
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

  /** Find the memories closest in meaning to the words. There is no written answer yet. */
  searchMemories(query: string): Observable<SearchResult> {
    return this.http
      .get<MemorySearchResponse>(`${MEMORIES_URL}/search`, {
        params: { q: query, limit: SEARCH_LIMIT },
      })
      .pipe(map((response) => ({ answer: null, memories: response.items })));
  }

  // The backend will own titles, type detection and file storage; this mimics them for now.
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

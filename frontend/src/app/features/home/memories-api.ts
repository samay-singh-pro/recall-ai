import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, map, of, switchMap, tap, throwError, timer } from 'rxjs';

import { API_BASE_URL } from '../../core/config/api-config';
import { ChatAnswerResponse } from './chat-answer-response';
import { Memory } from './memory';
import { MemoryAnswer } from './memory-answer';
import { MemoryAnswerResponse } from './memory-answer-response';
import { MemoryDraft } from './memory-draft';
import { MemoryListResponse } from './memory-list-response';
import { MemorySearchResponse } from './memory-search-response';
import { MemoryUpdate } from './memory-update';
import { SearchAnswer, SearchResult } from './search-result';

const MEMORIES_URL = `${API_BASE_URL}/memories`;
const CHAT_MESSAGES_URL = `${API_BASE_URL}/chat/messages`;
// The backend allows at most 100 per page; paging in the UI comes later.
const LIST_LIMIT = 100;

// Pretend network delays so loading states are visible before the backend exists.
const FAKE_LATENCY_MS = 200;
const TITLE_MAX_LENGTH = 60;
const SEARCH_LIMIT = 5;

/**
 * Saves, lists, reads, renames, searches and deletes the user's memories on the backend, and asks
 * the AI questions about them. Only saving an answer as a memory is still an in-browser stand-in
 * until the backend has it; it works on `memories`, a copy of the memories loaded so far.
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

  /** Ask the AI a question about one memory; it starts from that memory and may add general help. */
  askMemory(memoryId: string, question: string): Observable<MemoryAnswer> {
    return this.http
      .post<MemoryAnswerResponse>(`${MEMORIES_URL}/${memoryId}/answers`, { question })
      .pipe(map((response) => ({ question, text: response.answer })));
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

  /** Find the memories closest in meaning to the words; `askQuestion` writes the answer. */
  searchMemories(query: string): Observable<SearchResult> {
    return this.http
      .get<MemorySearchResponse>(`${MEMORIES_URL}/search`, {
        params: { q: query, limit: SEARCH_LIMIT },
      })
      .pipe(map((response) => ({ answer: null, memories: response.items })));
  }

  /** Ask the AI to write a short answer to the question from the user's own memories. */
  askQuestion(question: string): Observable<SearchAnswer> {
    return this.http.post<ChatAnswerResponse>(CHAT_MESSAGES_URL, { question }).pipe(
      map((response) => ({
        text: response.answer,
        sources: response.memories.map((memory) => ({ id: memory.id, title: memory.title })),
      })),
    );
  }

  // The backend will own titles, type detection and file storage; this mimics them for now.
}

// `delay` only holds back values, so a pretend failure waits on a timer instead.
function failLater(message: string): Observable<never> {
  return timer(FAKE_LATENCY_MS).pipe(switchMap(() => throwError(() => new Error(message))));
}

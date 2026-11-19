# Roadmap

Status: [x] done, [ ] todo, [~] in progress

- [x] **Phase 0** — Project context: CLAUDE.md, architecture, roadmap
- [~] **Phase 1** — Backend skeleton: FastAPI app, config, SQLAlchemy + Alembic, auth (signup/login/JWT), LLM factories (LangChain), Dockerfile, health check, tests
  - [x] FastAPI app, config, health check
  - [x] Database foundation: SQLAlchemy (async), Alembic, shared table base
  - [x] Save a dump: `POST /memories` (form: text and/or files), `GET /memories` (paged list), `GET /memories/{id}`, `GET /memories/{id}/attachments/{id}/file` (download), `PATCH /memories/{id}` (rename), `DELETE /memories/{id}`, `GET /memories/search?q=` (closest in meaning, own memories only, with a relevance cut-off). The response has its final shape; files are kept by a swappable storage layer (local folder now). Still empty until the AI parts exist: `summary`, `link_preview`, `source_memory`, spreadsheet `preview_rows`. Todo: Supabase storage adapter, connect Home to the real API
  - [x] Auth backend (`users` table with a display `name` + migrations, schemas, repository, Argon2 hashing, JWT access/refresh tokens, service, `POST /auth/signup` and `POST /auth/login` (both return tokens + user), `POST /auth/refresh`, `GET /auth/me` and the `get_current_user` guard)
  - [x] Chat model factory (`create_chat_model`: Gemini or Groq chosen in `.env`) and embeddings factory (`create_embeddings`: Gemini only for now). Default models are the cheapest Gemini ones
  - [x] Vector store factory (`create_vector_store`: local Chroma folder behind LangChain's `VectorStore`; pgvector later). Saving a text memory now adds it to the store (`user_id` and `memory_id` stored with it) and deleting removes it. Todo: indexing file text
  - [x] Re-index command (`.venv/bin/python -m scripts.reindex` from `backend/`): empties the search index and re-adds every memory's text from the database, in batches. Run it after changing `EMBEDDING_MODEL`, then restart the API server
  - [x] Written answer: `POST /chat/messages` (new `chat` module) searches the user's memories, then the chat model writes a short answer from them only; with no close memory it says so and does not call the model. The chat model call has a time limit and retry count (`LLM_TIMEOUT_SECONDS`, `LLM_MAX_RETRIES`). The Home search bar uses it (answer card). Todo: a LangGraph agent for dates and tasks, ask-this-memory and save-answer on the backend
  - [x] Ask this memory (backend): `POST /memories/{memory_id}/answers` `{question}` -> `{answer}`. Starts from that one memory's text, may add general help, declines unrelated questions. The memory page's ask box uses it. Todo: save answer on the backend
  - [ ] Dockerfile
- [ ] **Phase 2** — Text dumps: memories CRUD, embeddings, LangChain VectorStore (Chroma), search, LangGraph chat agent (core learning loop)
- [ ] **Phase 3** — File/link ingestion: image (vision/OCR), PDF, Excel, URL, Maps link
- [ ] **Phase 4** — Tasks/timeline: extraction from dumps, reminders via APScheduler
- [~] **Phase 5** — Angular + PrimeNG UI: login, signup, home (add box + memories panel with search), timeline
  - [~] Home screen. `MemoriesApi` now calls the real backend for create, list, get one, rename (`PATCH`), search (`GET /memories/search` for the matches, then `POST /chat/messages` for the written answer) and delete; the memory page's ask box calls `POST /memories/{id}/answers`; only save answer is still an in-browser stand-in working on the memories loaded so far. Images, PDFs, Download and Open-in-new-tab all use the login token. Todo: paging
    - [x] Memory Detail page (original content per format, summary, rename, copy, download, delete)
    - [x] Ask this memory + Save answer
    - [x] Global Search screen (replaces the chat)
  - [~] Auth screens (dev server on port 4600): login and sign up pages (shared `AuthShell` layout), `AuthApi`, `AuthSession` (tokens + name in localStorage), `authGuard` / `guestGuard`, name asked at signup (shown in the header and greeting) and Log out in the header
    - [x] Auth interceptor: attaches the access token to backend requests and refreshes it on a 401 (needed once Home talks to the real backend)
- [ ] **Phase 6** — Tests, CI, Docker Compose, deploy to free host, pgvector switch

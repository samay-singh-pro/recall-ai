# Roadmap

Status: [x] done, [ ] todo, [~] in progress

- [x] **Phase 0** — Project context: CLAUDE.md, architecture, roadmap
- [~] **Phase 1** — Backend skeleton: FastAPI app, config, SQLAlchemy + Alembic, auth (signup/login/JWT), LLM factories (LangChain), Dockerfile, health check, tests
  - [x] FastAPI app, config, health check
  - [x] Database foundation: SQLAlchemy (async), Alembic, shared table base
  - [x] Save a dump: `POST /memories` (form: text and/or files), `GET /memories` (paged list), `GET /memories/{id}`, `GET /memories/{id}/attachments/{id}/file` (download), `PATCH /memories/{id}` (rename), `DELETE /memories/{id}`, `GET /memories/search?q=` (closest in meaning, own memories only, with a relevance cut-off). The response has its final shape; files are kept by a swappable storage layer (local folder now). Still empty until the AI parts exist: `summary`, `link_preview`, `source_memory`, spreadsheet `preview_rows`. Todo: Supabase storage adapter, connect Home to the real API
  - [x] Auth backend (`users` table with a display `name` + migrations, schemas, repository, Argon2 hashing, JWT access/refresh tokens, service, `POST /auth/signup` and `POST /auth/login` (both return tokens + user), `POST /auth/refresh`, `GET /auth/me` and the `get_current_user` guard)
  - [x] Chat model factory (`create_chat_model`: Gemini or Groq chosen in `.env`) and embeddings factory (`create_embeddings`: Gemini only for now). Default models are the cheapest Gemini ones
  - [x] Vector store factory (`create_vector_store`: local Chroma folder behind LangChain's `VectorStore`; pgvector later). Saving a text memory now adds it to the store (`user_id` and `memory_id` stored with it) and deleting removes it. Todo: a re-index command (needed whenever the embedding model or collection changes), indexing file text
  - [ ] Dockerfile
- [ ] **Phase 2** — Text dumps: memories CRUD, embeddings, LangChain VectorStore (Chroma), search, LangGraph chat agent (core learning loop)
- [ ] **Phase 3** — File/link ingestion: image (vision/OCR), PDF, Excel, URL, Maps link
- [ ] **Phase 4** — Tasks/timeline: extraction from dumps, reminders via APScheduler
- [~] **Phase 5** — Angular + PrimeNG UI: login, signup, home (add box + memories panel with search), timeline
  - [~] Home screen. `MemoriesApi` now calls the real backend for create, list, get one, rename (`PATCH`), search (`GET /memories/search`, no written answer yet) and delete; ask and save answer are still an in-browser stand-in working on the memories loaded so far. Images, PDFs, Download and Open-in-new-tab all use the login token. Todo: paging
    - [x] Memory Detail page (original content per format, summary, rename, copy, download, delete)
    - [x] Ask this memory + Save answer
    - [x] Global Search screen (replaces the chat)
  - [~] Auth screens (dev server on port 4600): login and sign up pages (shared `AuthShell` layout), `AuthApi`, `AuthSession` (tokens + name in localStorage), `authGuard` / `guestGuard`, name asked at signup (shown in the header and greeting) and Log out in the header
    - [x] Auth interceptor: attaches the access token to backend requests and refreshes it on a 401 (needed once Home talks to the real backend)
- [ ] **Phase 6** — Tests, CI, Docker Compose, deploy to free host, pgvector switch

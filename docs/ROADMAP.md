# Roadmap

Status: [x] done, [ ] todo, [~] in progress

- [x] **Phase 0** — Project context: CLAUDE.md, architecture, roadmap
- [~] **Phase 1** — Backend skeleton: FastAPI app, config, SQLAlchemy + Alembic, auth (signup/login/JWT), LLM factories (LangChain), Dockerfile, health check, tests
  - [x] FastAPI app, config, health check
  - [x] Database foundation: SQLAlchemy (async), Alembic, shared table base
  - [~] Save a dump: text memories are done: `POST /memories`, `GET /memories` (paged list), `GET /memories/{id}`, `DELETE /memories/{id}`; still todo: files to Supabase Storage, rename
  - [x] Auth backend (`users` table with a display `name` + migrations, schemas, repository, Argon2 hashing, JWT access/refresh tokens, service, `POST /auth/signup` and `POST /auth/login` (both return tokens + user), `POST /auth/refresh`, `GET /auth/me` and the `get_current_user` guard)
  - [ ] LLM factories, Dockerfile
- [ ] **Phase 2** — Text dumps: memories CRUD, embeddings, LangChain VectorStore (Chroma), search, LangGraph chat agent (core learning loop)
- [ ] **Phase 3** — File/link ingestion: image (vision/OCR), PDF, Excel, URL, Maps link
- [ ] **Phase 4** — Tasks/timeline: extraction from dumps, reminders via APScheduler
- [~] **Phase 5** — Angular + PrimeNG UI: login, signup, home (add box + memories panel with search), timeline
  - [~] Home screen, built ahead of the backend against an in-browser stand-in `memories-api.ts`
    - [x] Memory Detail page (original content per format, summary, rename, copy, download, delete)
    - [x] Ask this memory + Save answer
    - [x] Global Search screen (replaces the chat)
  - [~] Auth screens (dev server on port 4600): login and sign up pages (shared `AuthShell` layout), `AuthApi`, `AuthSession` (tokens + name in localStorage), `authGuard` / `guestGuard`, name asked at signup (shown in the header and greeting) and Log out in the header
    - [x] Auth interceptor: attaches the access token to backend requests and refreshes it on a 401 (needed once Home talks to the real backend)
- [ ] **Phase 6** — Tests, CI, Docker Compose, deploy to free host, pgvector switch

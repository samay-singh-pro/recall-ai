# Architecture

## High-level
```
Angular (PrimeNG)  --HTTPS/JSON-->  FastAPI
                                      |-- auth (JWT)
                                      |-- ingestion pipeline  --> extractors --> LLM (tags/title/tasks) --> embed --> store
                                      |-- query agent (tool-calling loop) --> tools --> stores
                                      |-- scheduler (reminders)
                                      v
                        SQL DB (SQLite -> Postgres)   VectorStore (local -> pgvector)
                        File storage (local dir -> object storage later)
```

## Backend layout (planned)
One folder per feature; rules in `.claude/skills/backend-conventions/SKILL.md`.
```
backend/app/
  main.py            app factory, router registration only
  core/              config (pydantic-settings), security (JWT, hashing), logging, errors
  db/                base model, session, alembic migrations
  integrations/
    llm/             get_chat_model(), get_embeddings() via LangChain init_chat_model/init_embeddings
    vector/          get_vector_store() returning a LangChain VectorStore (Chroma -> PGVector)
    file_storage/    local dir -> object storage later
  modules/           each has router, service, repository, models, schemas, errors
    auth/            signup, login, refresh
    memories/        dumps + ingestion extractors (text, image, pdf, excel, link, maps)
    chat/            LangGraph query agent, @tool definitions, prompts
    tasks/           tasks, timeline, APScheduler reminders
  tests/             mirrors modules/
```

## Frontend layout (planned)
Angular standalone components + PrimeNG; rules in `.claude/skills/frontend-conventions/SKILL.md`.
```
frontend/src/app/
  app.config.ts / app.routes.ts   providers and lazy-loaded feature routes
  core/                           auth (service, guards), http (interceptors), config
  layout/                         app shell (navbar, menu)
  shared/                         reusable UI used by 2+ features
  features/                       auth, dump, memories, timeline, chat
    memory-list/ ...              routed screens, one folder each (Angular CLI naming, no suffixes)
    components/                   small pieces used by that feature's screens
    memories-api.ts               only place that calls the backend
    memory.ts                     type mirroring a backend schema
```

## Data model (v1)
- `users`: id, email, password_hash, created_at
- `memories`: id, user_id, type (text|image|pdf|excel|link|map), title, raw_text, extracted_text, source_url,
  file_path, tags(json), created_at
- `chunks`: id, memory_id, user_id, content, embedding (stored via LangChain VectorStore; metadata carries user_id, memory_id, created_at for filtering), created_at
- `tasks`: id, user_id, memory_id?, title, due_at, status (open|done), remind_at, created_at

All user-owned rows carry `user_id`; every query filters on it.

## Ingestion pipeline
1. Receive dump (text / file upload / URL).
2. Detect type -> pick extractor: text as-is; image -> vision LLM (caption + OCR); PDF -> pypdf; Excel -> openpyxl/pandas;
   link -> fetch + readability clean; maps link -> parse place/coords from URL (no Maps API).
3. LLM enrichment (structured output): title, tags, summary, detected tasks/dates (relative dates resolved using user "now"/timezone).
4. Chunk -> embed -> `VectorStore.upsert`.
5. Persist memory + tasks.

## Query agent
LangGraph prebuilt ReAct tool-calling agent (LLM picks tools, tools run, results fed back, until final answer). Tools are LangChain `@tool` functions:
- `search_memories(query, date_from?, date_to?, type?)` — semantic search + metadata filter
- `list_tasks(range, status?)`
- `create_task(title, due_at)`
- `summarize(memory_ids)`
Date phrases ("yesterday", "few days back") are resolved by the LLM into date ranges given the current date in the system prompt.
Answers must cite the memory they came from.

## Swappability
- LangChain chat models, embeddings and `VectorStore` are the interfaces; thin factories in `app/integrations/llm` and `app/integrations/vector` pick the implementation from config.
- DB via `DATABASE_URL` (sqlite+aiosqlite -> postgresql+asyncpg). Avoid DB-specific SQL outside the vector layer.

## Auth
Email+password (argon2/bcrypt), short-lived JWT access token + refresh token. Angular uses an HTTP interceptor and route guards.

## Decisions
- 2026-10-31: Python/FastAPI backend; Angular + PrimeNG frontend.
- 2026-10-31: Gemini/Groq free tiers; model chosen by env.
- 2026-10-31: LangChain + LangGraph for all agentic/LLM plumbing (replaces earlier LiteLLM and custom VectorStore interface idea).
- 2026-10-31: SQLite + local vector in dev; design for pgvector swap.
- 2026-10-31: Google Maps handled by parsing pasted links only (no Maps API / billing).
- 2026-10-31: Feature-based module layout (router/service/repository per module); see backend-conventions skill.
- 2026-10-31: Frontend mirrors backend: feature folders, one api service per feature, no cross-feature imports; file names follow Angular's official style guide (CLI defaults, no .component/.service suffixes). See frontend-conventions skill.
- 2026-10-31: Reminders are in-app for the demo; email/push is a later option.

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
  features/                       auth, home, timeline
    home-page/ ...                routed screens, one folder each (Angular CLI naming, no suffixes)
    components/                   small pieces used by that feature's screens
    memories-api.ts               only place that calls the backend
    memory.ts                     type mirroring a backend schema
```

## Data model (v1)
- `users`: id, email, password_hash, created_at
- `memories`: id, user_id, type (text|image|pdf|excel|link|map), title (editable), raw_text, extracted_text, summary,
  link_title, link_description, source_url, source_memory_id (a saved answer's original memory), tags(json), created_at. One memory = everything in the add box when
  Remember is pressed (text and/or files). `summary` is a 1-3 line AI summary, null when it adds nothing.
- `attachments`: id, memory_id, user_id, kind (image|pdf|excel), file_name, file_path, file_size, content_type,
  extracted_text, preview_rows(json, spreadsheets only), created_at. A memory has zero or more attachments.
- `chunks`: id, memory_id, user_id, content, embedding (stored via LangChain VectorStore; metadata carries user_id, memory_id, created_at for filtering), created_at
- `tasks`: id, user_id, memory_id?, title, due_at, status (open|done), remind_at, created_at

All user-owned rows carry `user_id`; every query filters on it.

## Ingestion pipeline
1. Receive one memory: optional text plus zero or more files (multipart), saved together.
2. Detect type per part -> pick extractor: text as-is; image -> vision LLM (caption + OCR); PDF -> pypdf; Excel -> openpyxl/pandas;
   link -> fetch + readability clean; maps link -> parse place/coords from URL (no Maps API).
3. LLM enrichment (structured output): title, tags, summary, detected tasks/dates (relative dates resolved using user "now"/timezone).
   Links also store the page's title and description; spreadsheets store their first rows for the preview table.
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
- 2026-11-01: One main screen, `home`, replaces the separate Dump, Memories and Chat screens: a multi-format add box in the middle and a Memories side panel with a plain search box. Adding and searching stay separate actions (no AI guessing which one you meant).
- 2026-11-01: Home UI built before the backend against an in-browser stand-in `memories-api.ts`; only that file changes when the real endpoints exist. Each file becomes its own memory (matches one `file_path` per memory row).
- 2026-11-01: App header lives in `layout/` and knows nothing about memories; screens drop their own content (the home search box) into its slot. Light/dark is a `core/theme` service toggling PrimeNG's `darkModeSelector` class, remembered in localStorage, defaulting to the OS setting. Username is a placeholder ("Guest") until auth exists.
- 2026-11-01: Asking is now a conversation, replacing the plain search box: the header ask bar turns the main area into a chat thread with follow-ups; "New memory" returns to the add box. The client sends the conversation so far with each question (`askQuestion(question, history)`), so follow-ups keep context without server-side chat storage. Answers may add the model's general knowledge, always flagged (`uses_general_knowledge` -> "Not from your memories" label); web search is a possible later tool. Until the agent exists, a keyword-matching stand-in answers and the chat shows a "Preview" badge.
- 2026-11-01: Memories can be opened into the chat (from the sidebar or an answer's memory card) as a full preview: text, image (PrimeNG Image lightbox), inline PDF, link, or file with Download. The API returns `file_url` and `file_size` per memory; the backend will serve uploads from a download endpoint (the stand-in uses browser `blob:` URLs). An opened memory is a user message whose `sources` hold it, so follow-up questions have it as context. Memories can be deleted from the sidebar after a confirm popup; their cards leave the chat too.
- 2026-11-01: One memory = everything typed and attached before pressing Remember. Files become `attachments` rows linked to the memory (replaces the earlier "each file becomes its own memory" decision). Memory `type` comes from the typed text when present (note/link/map), otherwise from the first file; titles fall back to "<first file> + N more". The preview shows the text, then each attachment with its own preview and Download.
- 2026-11-01: Look: Aura preset with an indigo primary (`core/theme/app-preset.ts`), Inter font from Google Fonts, app colour roles as `--ra-*` CSS variables built from PrimeNG tokens. Component restyling goes in the preset too (e.g. toasts are neutral cards in every severity; only the icon is coloured).
- 2026-11-01: Memories, not conversations, are the main objects (UI spec "Global Search & Memory Detail"). Each memory has its own page, `/home/memories/:memoryId`, with one layout for every format: header (Back, editable title, type, date, actions menu), original content exactly as saved, a short AI summary (hidden when null), then "Ask this memory" (next step). No permanent chat history; only an answer the user explicitly saves becomes a memory. The header ask bar becomes Global Search (`/home/search`), replacing the chat thread. This supersedes the chat-thread and "open into the chat" decisions above.
- 2026-11-01: `home` is a frame (sidebar + header) with child routes for its pages; route params arrive as component inputs (`withComponentInputBinding`). The sidebar list lives in a small `MemoryLibrary` service provided by the home page, so any page can refresh it after a save, rename or delete (the first shared state, justified by three pages sharing one list).
- 2026-11-01: Previews need no extra libraries: PDFs use the browser's built-in viewer (it has page navigation), spreadsheets show `preview_rows` read by the backend in a PrimeNG table, links show the page title/description read by the backend. The stand-in API starts with realistic sample memories whose files live in `frontend/public/samples/`; both go away with the stand-in.
- 2026-11-01: The initial-bundle warning budget is 550 kB (Angular default 500 kB): the first download is Angular, the router and the PrimeNG theme engine (about 115 kB compressed); feature code is lazy-loaded.
- 2026-11-01: "Ask this memory" (`askMemory(memoryId, question)`) answers only from the open memory and says so when the memory doesn't contain the answer (`found: false`) instead of guessing. Nothing is stored and only the latest answer is shown. "Save answer" (`saveAnswer(memoryId, answer)`) creates a new text memory titled by the question, with `source_memory` pointing back to the original; its page links to it ("Answer saved from ...").
- 2026-11-01: The detail page's original content is one viewer with a stage of fixed height (`--ra-stage-height`) for every format, so notes, images, PDFs, sheets and links look consistent: a bar on top (name, type and size, Open/Download/Copy), the preview fitted inside, and a part switcher when a memory has text and files. On wide screens the AI summary and "Ask this memory" sit beside it as cards (CSS container query); on narrow screens they stack below.
- 2026-11-01: Global Search (`/home/search?q=`) replaces the chat; the chat thread, `ChatMessage` and `askQuestion(question, history)` are removed. `searchMemories(query)` returns a short answer drawn only from memories (`answer.sources` points to them) plus up to five matching memories; when several match equally well, the answer has no sources and asks the user to pick from "Possible matches". The header search bar shows the current search, × clears it, and the query lives in the URL so Back returns to the results. Result cards show a thumbnail (photos) or a coloured type tile, title, type, a two-line snippet and the date; each memory type has its own colour (`MEMORY_TYPE_COLORS`), also used on the detail page.
- 2026-11-02: The header's centre slot and the search results share one width rule (`--ra-center-width`, `--ra-center-side` in `styles.scss`): equal side columns in the header grid and a matching width on the search page keep the bar and the results the same width and centre. Below 44rem of page width both switch to filling the space. On phones the root font size is 15px so all rem-based text shrinks evenly; text boxes stay at 16px because iPhone Safari zooms into smaller ones.


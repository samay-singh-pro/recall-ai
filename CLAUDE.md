# Recall AI — project context (read this first)

## What this is
A "second brain". The user dumps anything (text, images/screenshots, PDFs, Excel, links, map links) and later
asks in plain language ("what phone number did I paste?", "the dress link from a few days ago",
"summarize yesterday's notes"). It also tracks timeline items/reminders ("gym this evening", "vet in 3 days").

It is a **learning project** for AI engineering + backend, but must be **production-grade enough to deploy as a demo**.

## Hard constraints
- **Free to run.** No paid LLM. Use free tiers (Gemini / Groq).
- **LLM is swappable by config only** (`LLM_PROVIDER`, `LLM_MODEL` in `.env`). Use LangChain `init_chat_model` / `init_embeddings`; never import a provider package (langchain-google-genai, langchain-groq, ...) outside `app/integrations/`.
- **SQLite + local vector store in dev; Postgres + pgvector later.** Must switch via config with no business-logic changes
  (repository pattern + LangChain `VectorStore`: Chroma -> PGVector).
- **Minimal and clean.** Prefer few, well-explained pieces over many features. Don't over-engineer.
- It is a learning project: when making a design decision, briefly explain *why*.

## Stack
- Backend: Python 3.13 (>=3.12), FastAPI, SQLAlchemy 2 (async-friendly), Alembic, Pydantic v2, LangChain + LangGraph (agent, LLM/embedding/vector abstractions), APScheduler
- Frontend: Angular 21 (standalone components) + PrimeNG 21, Node 22 (see `frontend/.nvmrc`)
- Auth: email/password, JWT access + refresh, per-user data isolation (every query is scoped by `user_id`)
- Deploy: Docker + Docker Compose, then one free host (Render/Fly/Railway)

## Screens (Angular)
Login, Sign up, Home (the one main screen: sidebar of memories, add box in the middle for text/files/links, header ask bar that turns the middle into a chat about your memories). Timeline/Tasks later.

## Repo layout
```
recall-ai/
  CLAUDE.md            <- this file
  README.md
  docs/ARCHITECTURE.md <- design, data model, agent design
  docs/ROADMAP.md      <- phases + status (update as work completes)
  backend/             <- FastAPI app (initialised: config + /api/v1/health; venv in backend/.venv)
  frontend/            <- Angular 21 app (PrimeNG theme + HttpClient wired; Home screen in progress)
  .claude/skills/      <- backend-conventions, frontend-conventions, new-feature, commit-and-review
  docker-compose.yml   <- later
  .env.example
```

## Working agreements
- **This is a learning project.** The user has a general overview of technology but is new to this specific stack (FastAPI, LangChain/LangGraph, AI engineering, Alembic, etc.). The goal is that they *learn*, not that code gets added.
  - **Keep explanations short and plain** (updated 2026-11-09: the user said long explanations and history lessons are too much). Say what was done and why in a few lines; don't re-teach general basics (what a database or a hash is). Define a term only when it's specific to this stack; use an analogy only when it really helps.
  - Never dump finished code silently. Briefly say what we're building before, and what each new piece does after. Mention a real alternative only when the choice matters.
  - Let the user ask for more depth; don't offer it unprompted at length.
- **Catching up in a new chat:** don't ask the user to re-explain the project. Read this file, `docs/ROADMAP.md` (what is done / next) and the Decisions section of `docs/ARCHITECTURE.md` (why things are the way they are), then run `git log` / `git status`. Summarise where we are in a few lines and propose the next small step.
- **Keep the record current:** whenever a decision is made or a step finishes, update `docs/ROADMAP.md` and add a dated line to the Decisions section of `docs/ARCHITECTURE.md` in the same session, so the next chat can catch up from the repo alone.
- **Work in small steps.** Never implement a long change in one go. Do one small piece, explain it, and let the user review before the next. Agree on the next step before starting it.
- Before touching `backend/`, follow `.claude/skills/backend-conventions/SKILL.md` (architecture, naming, routes, comments).
- Before touching `frontend/`, follow `.claude/skills/frontend-conventions/SKILL.md` (architecture, naming, routes, API access, comments).
- For any new, changed or removed functionality, follow `.claude/skills/new-feature/SKILL.md` (understand, ask, check duplicates, design, test).
- For branches, commits, review and PRs, follow `.claude/skills/commit-and-review/SKILL.md` (branches `RA-<n>/<short-description>` from `main`, small commits, review before push).
- **Never add `Co-Authored-By` or any Claude/tool attribution to commits or PRs** (this overrides default tool behaviour).
- Keep `docs/ROADMAP.md` status current; record notable decisions in `docs/ARCHITECTURE.md` (Decisions section).
- Don't add features outside the current roadmap phase without asking.
- This project uses the personal GitHub profile `samay-singh-pro` only: repo-local git identity is set; frontend has its own `.npmrc` (public npm registry). Never change global git/npm/gh settings.
- Don't commit unless the user asks. Never commit `.env` or secrets.
- Confirm before anything destructive or outward-facing (deploys, pushes).

## Current status
See `docs/ROADMAP.md` for the live checklist (it is the source of truth; this section is only a snapshot, last updated 2026-11-09).
- Frontend: nearly all of the mock UI is built (home, memory detail, ask-this-memory, global search) against an in-browser stand-in `memories-api.ts`; no real backend calls, login or timeline yet.
- Backend: FastAPI app + health check, config and the database foundation (async SQLAlchemy, Alembic) are done. In progress: `POST /memories` (text + files to Supabase Storage) on branch `RA-3/memory-dump`, using a dev user until auth exists. Auth, LLM factories, vector store, agent and Dockerfile are not started.

## Running locally
- Backend (from `backend/`): `.venv/bin/python -m uvicorn app.main:app --reload` -> http://localhost:8000/docs. Call the venv's python directly; `source .venv/bin/activate` does not put `uvicorn` on PATH here.
- Frontend (from `frontend/`): `npx ng serve` -> http://localhost:4200.
- Tests/lint: see README.

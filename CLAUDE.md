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
Login, Sign up, Dump (main), Memories (history), Timeline/Tasks, Chat.

## Repo layout
```
recall-ai/
  CLAUDE.md            <- this file
  README.md
  docs/ARCHITECTURE.md <- design, data model, agent design
  docs/ROADMAP.md      <- phases + status (update as work completes)
  backend/             <- FastAPI app (initialised: config + /api/v1/health; venv in backend/.venv)
  frontend/            <- Angular 21 app (initialised, PrimeNG theme + HttpClient wired; no screens yet)
  .claude/skills/      <- backend-conventions, frontend-conventions, new-feature, commit-and-review
  docker-compose.yml   <- later
  .env.example
```

## Working agreements
- **This is a learning project.** Explain every concept, library and design choice in plain layman's language (use everyday analogies, avoid jargon, or define it when unavoidable) so the user understands what they are learning, not just what was built.
- **Work in small steps.** Never implement a long change in one go. Do one small piece, explain it, and let the user review before the next. Agree on the next step before starting it.
- Before touching `backend/`, follow `.claude/skills/backend-conventions/SKILL.md` (architecture, naming, routes, comments).
- Before touching `frontend/`, follow `.claude/skills/frontend-conventions/SKILL.md` (architecture, naming, routes, API access, comments).
- For any new, changed or removed functionality, follow `.claude/skills/new-feature/SKILL.md` (understand, ask, check duplicates, design, test).
- For branches, commits, review and PRs, follow `.claude/skills/commit-and-review/SKILL.md` (branches `RA-<n>` from `main`, small commits, review before push).
- **Never add `Co-Authored-By` or any Claude/tool attribution to commits or PRs** (this overrides default tool behaviour).
- Keep `docs/ROADMAP.md` status current; record notable decisions in `docs/ARCHITECTURE.md` (Decisions section).
- Don't add features outside the current roadmap phase without asking.
- This project uses the personal GitHub profile `samay-singh-pro` only: repo-local git identity is set; frontend has its own `.npmrc` (public npm registry). Never change global git/npm/gh settings.
- Don't commit unless the user asks. Never commit `.env` or secrets.
- Confirm before anything destructive or outward-facing (deploys, pushes).

## Current status
See `docs/ROADMAP.md`. Phase 0 (docs/context) done; Phase 1 (backend skeleton) is next.

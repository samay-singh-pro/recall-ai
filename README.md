# Recall AI

A second brain: dump text, images, PDFs, Excel, links and locations, then ask for them back in plain language.
Also tracks tasks and reminders from what you write.

- Project context for AI assistants: [CLAUDE.md](CLAUDE.md)
- Design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Progress: [docs/ROADMAP.md](docs/ROADMAP.md)

## Run locally

Backend (Python 3.12+):
```
cd backend
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
cp ../.env.example ../.env                   # then fill in the keys (one .env at the repo root)
.venv/bin/python -m alembic upgrade head     # create/update the database tables
.venv/bin/uvicorn app.main:app --reload      # http://localhost:8000/docs
.venv/bin/pytest                             # tests
.venv/bin/ruff check . && .venv/bin/mypy app # lint and types
```

Frontend (Node 22, see `.nvmrc`):
```
cd frontend
nvm use && npm install
npm start                                    # http://localhost:4200
npm test
```

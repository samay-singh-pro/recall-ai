---
name: backend-conventions
description: Architecture, naming, route design, models, comments and logic rules for the Recall AI FastAPI backend. Load before creating or changing any file under backend/.
---

# Backend conventions

Goal: code a new reader can navigate in minutes, where adding, changing or deleting functionality touches one place.

## 1. Structure: one folder per module

```
backend/app/
  main.py                 app factory, router registration only
  core/                   config, security, logging, errors, shared dependencies
  db/                     base model, session, migrations
  integrations/           adapters to outside systems: llm/, vector/, file_storage/
  modules/
    auth/                 signup, login, refresh
    memories/             dumps and their retrieval
    chat/                 the query agent
    tasks/                tasks, timeline, reminders
      router.py           HTTP only
      service.py          business rules
      repository.py       database queries
      models.py           ORM tables
      schemas.py          request/response shapes
      errors.py           this module's domain exceptions
  tests/                  mirrors modules/
```

A module is a cohesive area of the product (memories, tasks), not a single endpoint. New endpoints usually go into an existing module.

### Dependency direction (never break)
`router -> service -> repository -> database`
- A router never touches the database or an integration directly.
- A repository never contains business rules.
- A module never imports another module's `repository` or `models`. It calls the other module's `service`.
- `core/` and `integrations/` never import from `modules/`.

## 2. SOLID, applied with restraint
- **Single responsibility:** router = parse and respond; service = decide; repository = read/write; integration = talk to the outside.
- **Dependency inversion only at real swap points:** LLM, embeddings, vector store, file storage. Services receive these through FastAPI `Depends`; they never construct them.
- **Open/closed:** a new ingestion type is a new extractor class registered in one list, not another `if type == ...` branch.
- No interface for its own sake. One implementation with no foreseeable second one stays a plain class.

## 3. Naming
- Any standard, conventional name is fine, including `utils` or `helpers` where they genuinely fit. The one requirement: **the name must say clearly what the thing represents or does.** Nothing random, vague or cryptic (`tmp`, `x`, `do_stuff`, `process_data`).
- Prefer the user's own vocabulary for domain things: `Memory`, `Task`, `Reminder`, `Dump`.
- Functions: verb + object (`save_memory`, `list_tasks`, `mark_task_done`).
- Avoid cryptic abbreviations (`memory`, not `mem`). Booleans read as questions: `is_done`, `has_attachment`.
- Repositories use `find_/list_/add_/update_/remove_`; services use the user's language (`create_`, `get_`, `complete_`).
- A file name that needs "and" probably should be two files.

## 4. Routes: one design language
- Base `/api/v1`. Plural nouns, kebab-case, lowercase. Resource ids are UUIDs.

| Action | Route | Success |
|---|---|---|
| Create | `POST /memories` | 201 + created resource |
| List | `GET /memories?limit=&offset=` | 200 `{items,total,limit,offset}` |
| Read one | `GET /memories/{memory_id}` | 200 |
| Change some fields | `PATCH /memories/{memory_id}` | 200 |
| Delete | `DELETE /memories/{memory_id}` | 204 |

- Nested only one level, only for ownership: `GET /memories/{memory_id}/tasks`.
- A non-CRUD action is a sub-resource noun, not a verb in the path: `POST /tasks/{task_id}/completion`, `POST /chat/messages`.
- Auth is the exception by nature: `POST /auth/signup`, `/auth/login`, `/auth/refresh`.
- Every route declares `response_model`, `status_code`, `tags`, and a one-line `summary`.
- One error shape everywhere: `{"error": {"code": "memory_not_found", "message": "..."}}`.
- Status codes: 400 invalid, 401 not logged in, 403 not allowed, 404 not found (also for another user's resource), 409 conflict, 422 validation.

## 5. Models and schemas
- **Three separate shapes:** ORM model (table), input schema (`MemoryCreate`, `MemoryUpdate`), output schema (`MemoryResponse`). Never return an ORM object, never accept one.
- Every table has `id` (UUID), `created_at`, `updated_at` from one shared base class. Every user-owned table has a non-null, indexed `user_id`.
- Table names plural snake_case (`memories`), columns snake_case, enums as real `Enum`s, not magic strings.
- **`user_id` is a required argument of every repository method on owned data** (`find_memory(user_id, memory_id)`), not an optional filter.
- Schema changes only through Alembic migrations. Keep SQL portable (SQLAlchemy constructs, no raw SQLite- or Postgres-only SQL outside `integrations/vector/`).

## 6. Comments: short, uniform, useful
- Every module-level class and every public function gets a **one-line docstring** saying what it is for: `"""Return the user's memories, newest first."""`
- Add a second line only for a surprising rule or side effect. No paragraphs, no restating the code, no commented-out code.
- Inline `#` comments explain **why** something non-obvious is done, not what.
- Full type hints on every function signature.
- Route and schema fields use `Field(description=...)` so the OpenAPI docs are the API reference.

## 7. Writing readable logic
- One function, one job. There is no hard line limit: a 50-line function with a single job is fine.
- A long function that has several steps must be **partitioned with blank lines and a short comment per step**, e.g. `# 1. Extract text`, `# 2. Enrich with LLM`, `# 3. Store`. If the steps are independently reusable or testable, split them into functions instead.
- **Guard clauses, early return;** avoid nesting deeper than two levels.
- No magic numbers or strings: constants in the module, or settings if deployment-tunable.
- Explicit over clever: no dense comprehension chains, metaprogramming or dynamic attribute tricks.
- Business rules raise **domain exceptions** (`MemoryNotFoundError`) defined in the module's `errors.py`, translated to HTTP responses in **one** place (`core/errors.py`). Services never raise `HTTPException`.
- Never swallow exceptions. Catch only what you can handle, and log with context.
- LLM-dependent code returns validated structured output (Pydantic) and never trusts raw model text.

## 8. Keeping it debuggable as it grows
- All config through one typed `Settings` object (`core/config.py`); nobody reads `os.environ` elsewhere.
- No hidden global state, no module-level clients. Create things in the app factory and inject.
- Structured logs with a request id on every line; log at module boundaries (service entry, integration calls), not in loops.
- No circular imports; if one appears, the dependency direction in section 1 was broken, so fix the design.
- A bug should be traceable by walking `router -> service -> repository` in order.

## Do not
- Put logic in routers, models, or `main.py`.
- Add a new top-level folder or module without asking.
- Import a provider package (Gemini, Groq, Chroma, ...) outside `integrations/`.
- Skip `user_id` scoping, response models, or migrations "just for now".

For the workflow of adding an endpoint or functionality (planning, trade-offs, tests, docs), see the `new-feature` skill.

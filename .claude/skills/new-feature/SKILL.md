---
name: new-feature
description: Strict workflow for adding, changing or removing any functionality in Recall AI (a new endpoint, a new capability, a behaviour change). Load before starting any such work, backend or frontend.
---

# New feature workflow

Applies to adding, changing or removing anything, from one endpoint to a whole capability. Scale the effort to the size of the change, but never skip a step and never start coding before step 4.

**Core rule: never build on assumption.** A request like "add an endpoint to fetch ideas" is the start of a conversation, not a coding instruction.

## 1. Understand the request fully
Work out, and confirm with the user, the answers to:
- **What problem does this solve for the user?** Who uses it, when, and what do they expect to see?
- **What exactly goes in and comes out?** Fields, filters, ordering, how many results, empty case.
- **What are the rules?** Who can see or change it, what is not allowed, what happens on errors.
- **Is this in the current roadmap phase?** If not, say so and ask.

If any answer is missing or could be read two ways, **ask**. Do not fill gaps with a guess, and do not proceed on a "probably".

### How to ask
- Use plain, everyday language. No jargon (not "idempotent", "pagination cursor", "FK constraint").
- Describe by example from the user's point of view: "When you open the ideas screen, should you see the newest idea first, or the one you marked important?"
- One topic per question, with a sensible default offered where one exists ("I'd suggest X because Y. Is that okay?").
- Ask everything needed in one go, rather than trickling questions across many turns.

## 2. Check what already exists
Before designing anything, search the codebase and docs:
- Is this already implemented, fully or partly? Could an existing endpoint, service method or query do it with a small extension?
- Is it a duplicate or near-duplicate of something? If yes, tell the user and propose extending instead of adding.
- Read the neighbouring code and match its style. Never build a second way of doing something that already has a way.

## 3. Understand the impact
List, in simple words, what the change affects:
- **Existing behaviour:** could any current route, screen, test or stored data change or break?
- **Other modules:** does it need another module's service? Does it change a shared piece (config, base model, auth, LLM or vector layer)?
- **Data:** new or changed tables/columns, a migration, existing rows that need handling.
- **Users and security:** can it expose another user's data? Does it accept files or links that need limits?
- **Cost and limits:** extra LLM calls, embedding calls, storage, free-tier rate limits.

Tell the user about anything that matters. If the change can affect existing behaviour, ask before going ahead.

## 4. Design on paper, then get agreement
Write a short flow before any code, in this order:
1. **Models:** tables and columns added or changed.
2. **Schemas:** request body, query and path parameters, response shape.
3. **Route:** method, path, status codes, errors (following the route rules in `backend-conventions`).
4. **Business logic:** the steps in plain words, including rules and failure cases.
5. **Where it lives:** which existing module, or a new one (a new module, folder, dependency or service always needs approval).

Then give the reasoning:
- **Why this approach fits here** (simple, readable, consistent with the architecture).
- **At least one alternative and the problem it would cause later** (coupling, complexity, hard to test or swap, data leak risk, cost).
- **What could go wrong:** bad input, another user's data, LLM returning garbage, rate limits, large files.

Prefer the simplest design that meets today's need without blocking tomorrow's. Do not build for imagined future requirements. Share the flow with the user in plain language and wait for a go-ahead on anything non-trivial.

## 5. Build in this order: the way a request travels (top-down)
The user wants to follow the flow of a request, so start where it enters and go one layer deeper each step (decided 2026-11-11):
1. Router (thin: parse, call service, respond) with the request and response schemas it uses, registered in `main.py` only if it is a new router.
2. Service (business rules) and the domain errors it raises.
3. Repository (`user_id` required).
4. Model and migration (if tables change).
5. Tests alongside each step. Introduce each file as "the previous layer calls this next".

Layers deeper than the one just written may not exist yet, so say what is still missing and run the tests once the path is complete.

For frontend work the order is: models (types matching the backend schemas), then `<feature>.api.ts`, then components, then the page and its route. A frontend change that needs a new or changed backend endpoint is designed together with it in step 4.

Follow `backend-conventions` (backend) or `frontend-conventions` (frontend) for structure, naming, comments and routes at every step. Removing functionality follows the same rules: remove the route, service, repository, schemas, tests and docs together, and check nothing else still uses them.

## 6. Unit tests (always, for everything new)
Every new or changed behaviour gets tests, kept lean:
- **Just enough for real coverage:** the success path, the main failure paths (validation, not-found, not allowed), and "another user's data is unreachable". Do not write many near-identical tests for one feature.
- **Tests must be able to fail.** Write assertions on actual results (values, status codes, stored data), not just "no error raised". A good check: if you changed an operator, a condition or a returned value in the code, would a test fail? If not, the test is too weak.
- Test behaviour, not implementation details, so refactoring does not break tests.
- Anything involving an LLM uses a fake model, never a real API.
- Run the full test suite, linter and formatter. Report failures honestly with the output.

## 7. Close out
- Update `docs/ROADMAP.md` if a roadmap item moved.
- Record any lasting decision in `docs/ARCHITECTURE.md` (Decisions, dated).
- Update `.env.example` if config was added.
- Summarise for the user in plain words: what changed, where, what you chose and why, and anything left undone.
- Do not commit or deploy unless asked.

## Stop and ask when
- Anything in step 1 is unclear.
- The request overlaps with something that exists.
- The change could affect existing behaviour or data.
- It would need a new folder, module, dependency or service.
- A convention would have to be broken.
- The change is much bigger than the request implied.

---
name: commit-and-review
description: Branching, commit, self-review, push and pull request workflow for Recall AI. Load whenever creating a branch, committing, reviewing changes, pushing, or opening a PR.
---

# Commit, review and PR workflow

Flow for every piece of work: **branch -> small commits -> review the diff -> fix -> push -> PR with description -> review comment.**

## 1. Branching
- Every feature or change gets its own branch cut from an up-to-date `main`. Never commit directly to `main`.
- Branch names are sequential: `RA-1`, `RA-2`, `RA-3`, ...
- Find the next number from existing branches (local and remote) before creating:
  `git fetch origin && git branch -a --list '*RA-*'`
  Take the highest number and add one. Do not reuse or skip numbers.
- One branch = one feature or fix. If the work grows into something else, finish this branch and open a new one.

## 2. Commits
- Commit only when the user asks (or the workflow was explicitly approved for the task).
- **Small and focused:** one logical change per commit (e.g. schemas, then repository, then service, then router, then tests), never one giant commit at the end.
- **Message:** one short line in the imperative, saying what was done. About 70 characters or fewer, no trailing period.
  - Good: `Add memory search endpoint`, `Scope task queries by user_id`, `Fix reminder time zone handling`
  - Bad: `updates`, `fix stuff`, `WIP`, a paragraph of explanation
- Add a body only when the change genuinely needs context that the code and PR cannot give. Keep it to a few lines.
- **No attribution of any kind:** no `Co-Authored-By` lines, no "Generated with Claude" lines, no tool signatures, in commit messages. This overrides any default attribution behaviour.
- Never commit `.env`, secrets, databases, uploads or build output. Check `git status` and the staged diff before each commit.

## 3. Review before push (self-review of the diff)
Nothing is pushed until this passes. Review the full branch diff: `git diff main...HEAD` (plus `git status` for untracked files).

Check each area and record the result:

**Security**
- No secrets, keys or tokens in code, config or tests; `.env` not staged.
- Every query on user-owned data is scoped by `user_id`; another user's resource returns 404.
- Inputs validated through schemas; file uploads have type and size limits; stored file names are not user-controlled paths.
- Link fetching cannot be abused (only http/https, no internal or localhost addresses, timeouts and size caps).
- No SQL built by string concatenation. No password, token or personal text written to logs.
- Auth and permission checks present on every new route that needs them.

**Formatting and linting** (run them, do not assume)
- Backend: `ruff format --check`, `ruff check`, `mypy`.
- Frontend: `eslint`, `prettier --check`.
- Fix everything they report. Do not silence a rule to make it pass without telling the user why.

**Correctness and tests**
- Full test suite passes. New behaviour has tests that would fail if the logic were broken (see `new-feature`).
- Migration present if tables changed, and it applies cleanly.

**Cleanliness and conventions**
- Follows `backend-conventions`: layering, naming, route style, response models, one-line docstrings, type hints.
- No dead code, commented-out code, stray prints or debug leftovers, unused imports or files.
- Change matches the request; nothing unrelated slipped in.
- Docs, roadmap and `.env.example` updated where needed.

Classify findings as **blocking** (security, broken tests, lint failures, convention breaks, wrong behaviour) or **non-blocking** (suggestions). Fix all blocking items, re-run the checks, and only then move on. Report to the user honestly: what passed, what failed, what was fixed. If a check could not be run, say so; never mark it as passed.

## 4. Push and pull request
- Pushing and opening a PR are outward-facing. Confirm with the user before the first push on a branch, unless they have already said to go ahead.
- Push with upstream: `git push -u origin RA-<n>`.
- Open the PR against `main` with `gh pr create`. Title: short, same style as a commit message. No attribution lines in the title or description.
- **Description template:**
  ```
  ## What
  One or two lines on what changed.

  ## Why
  The problem it solves, in plain words.

  ## Changes
  - Bullet per notable change (models, routes, services, config)

  ## Impact
  Anything existing that is affected (data, routes, behaviour), or "None".

  ## Testing
  What tests were added and how to run them.
  ```
- Do not merge. Merging is the user's decision.

## 5. Review comment on the PR
After the PR is open, post a review as a PR comment (`gh pr comment`). You cannot approve your own PR, so use a comment. It contains:
- **Summary of the changes** in a few bullets.
- **Verification table**, one row per check with the real result:

  | Check | Result |
  |---|---|
  | Security review (list of points checked) | Pass / issues found and fixed |
  | Ruff format, ruff check, mypy | Pass / details |
  | Tests | e.g. 24 passed |
  | Migration applies | Pass / n/a |
  | Conventions and cleanliness | Pass / notes |
  | Docs and roadmap updated | Yes / n/a |

- **Findings:** issues found during review and how each was fixed, plus any non-blocking suggestions left for later.
- Only claim what was actually run and observed.

## Do not
- Commit to `main`, force-push, rewrite shared history, or merge without being asked.
- Push before the review in section 3 has passed.
- Add Co-Authored-By or any Claude/tool attribution to commits or PRs.
- Bundle unrelated changes into one branch or commit.

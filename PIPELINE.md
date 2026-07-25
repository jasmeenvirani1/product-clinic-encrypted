# Agent Pipeline — Full Documentation

## Overview

A 6-agent automated development pipeline that receives user requests, builds features or fixes bugs, tests against acceptance criteria, reviews code, and creates pull requests — all while tracking progress through GitHub Issues.

---

## Pipeline Flow

### Two Routes — Smart Routing

The Task Distributor automatically decides which path a task takes:

**ARCHITECT PATH** — for tasks that need new structure:

```
User Request
  → Task Distributor (creates GitHub Issue)
    → Architect Agent (designs architecture)
      → Backend Dev + Frontend Dev (implement in parallel)
        → QA Tester (verify acceptance criteria)
          → PR Reviewer (security + quality review)
            → Branch created → PR created → Issue closed
```

**DIRECT PATH** — for bug fixes and small changes:

```
User Request
  → Task Distributor (creates GitHub Issue, scans code for file:line)
    → Backend Dev OR Frontend Dev (fix directly, no architect needed)
      → QA Tester (verify acceptance criteria)
        → PR Reviewer (security + quality review)
          → Branch created → PR created → Issue closed
```

---

## Routing Decision

### Goes to Architect (new structure needed)

- New feature or new module
- New database table or new column
- New API endpoint that needs design
- New page or new component hierarchy
- T3/T4 complexity (4+ files)

### Skips Architect (existing structure is enough)

- Bug fix — something is broken, fix it
- Small improvement — tweak existing behavior
- Styling or CSS change
- Text or copy change
- Config or environment change
- Refactor — restructure without new architecture
- T1/T2 complexity (1-3 files)

---

## Agent Details

### 1. Task Distributor Agent

**Role:** Entry point. Receives every user request.

**What it does:**
- Analyzes and classifies the request (feature, bug, improvement, refactor)
- Determines complexity tier (T1-T4) and scope (backend, frontend, fullstack)
- Decides routing: Architect Path or Direct Path
- Creates `.ai/brain.md` by auto-scanning the codebase (first run only)
- Creates `.ai/sessions/[date]-[task].md` with task brief and acceptance criteria
- Creates GitHub Issue with labels
- Routes to the correct next agent

**Writes code:** No

**GitHub activity:** Creates issue, adds labels (`type:*`, `tier:*`, `scope:*`, `route:direct`)

**First run bootstrap:**
- Creates `.ai/` folder, `.ai/sessions/`, `.ai/brain.md`, `.ai/token-log.md`
- Creates `CLAUDE.md` at project root
- Creates all pipeline labels in GitHub

---

### 2. Architect Agent

**Role:** Technical designer. Only activated on Architect Path.

**What it does:**
- Reads the task brief from task-distributor
- Scans existing codebase to understand current patterns
- Designs API contracts (method, endpoint, request/response shapes, status codes)
- Designs data model changes (tables, columns, constraints)
- Creates file plans for backend and frontend (exact paths, purposes, pattern references)
- Defines component hierarchy for frontend
- Defines shared contracts between backend and frontend
- Auto-creates `.claude/rules/` files if missing (api.md, frontend.md, database.md)
- Updates `.ai/brain.md` with new discoveries

**Writes code:** No — only designs

**GitHub activity:** Comments architecture summary, relabels to `pipeline:backend-dev` + `pipeline:frontend-dev`

**Skipped when:** Bug fixes, small improvements, T1/T2 tasks, refactors

---

### 3. Backend Dev Agent

**Role:** Backend developer. Works in two modes.

**Architect Mode (Route: ARCHITECT):**
- Reads architecture plan from session file
- Implements APIs, database layer, server logic in exact order from plan
- Follows API contracts precisely
- Matches existing code style by reading pattern reference files

**Direct Mode (Route: DIRECT):**
- Reads bug location (file:line) from session file
- Goes directly to the file, reads context
- Fixes surgically — no scope creep
- If fix needs architecture, stops and escalates

**What it does in both modes:**
- Auto-detects backend framework, ORM, validation library
- Installs dependencies if needed
- Updates `.ai/brain.md` with backend patterns
- Comments progress on GitHub Issue

**Writes code:** Yes

**GitHub activity:** Comments start, progress updates, completion summary, bug fix confirmations

---

### 4. Frontend Dev Agent

**Role:** Frontend developer. Works in two modes.

**Architect Mode (Route: ARCHITECT):**
- Reads architecture plan from session file
- Builds components per hierarchy designed by architect
- Integrates with API contracts
- Handles all UI states (loading, error, success, empty)

**Direct Mode (Route: DIRECT):**
- Reads bug location (file:line) from session file
- Goes directly to the component, reads context
- Fixes surgically — no scope creep
- If fix needs architecture, stops and escalates

**What it does in both modes:**
- Auto-detects UI framework, styling approach, state management, component library
- Installs dependencies if needed
- Updates `.ai/brain.md` with frontend patterns
- Comments progress on GitHub Issue

**Writes code:** Yes

**GitHub activity:** Comments start, progress updates, completion summary, bug fix confirmations

---

### 5. QA Tester Agent

**Role:** Quality gate. Verifies the implementation meets user requirements.

**What it does:**
- Reads original user requirement and acceptance criteria from session file
- Auto-detects test framework (Jest, Vitest, Pytest, Playwright, etc.)
- Runs targeted tests only — never the full test suite
- Verifies EACH acceptance criterion with evidence (file:line or test output)
- Creates smoke tests if no test framework exists
- If bugs found: writes exact bug report with file, line, expected, actual, fix hint
- Routes backend bugs to backend-dev, frontend bugs to frontend-dev
- Max 3 fix loops before escalating to human
- When all pass: generates completion report

**Writes code:** Tests only

**GitHub activity:** Comments test results, adds `bug:backend`/`bug:frontend` labels when bugs found, relabels to `pipeline:pr-review` when passed

**Bug report format:**

| Priority | File | Line | Bug | Expected | Actual | Fix Hint |
|---|---|---|---|---|---|---|
| Critical | path/file.ts | 42 | Description | Expected behavior | Actual behavior | Suggested fix |

---

### 6. PR Reviewer Agent

**Role:** Final code review gate. Last stop before merge.

**What it does:**

**Security Scan (blockers):**
- SQL injection — string concatenation in queries
- XSS — dangerouslySetInnerHTML, unsanitized input
- Hardcoded secrets — API keys, tokens in code
- Auth bypass — missing auth on protected routes
- Sensitive data — PII in logs or responses

**Performance Scan:**
- N+1 queries, unbounded queries, blocking operations
- Unnecessary re-renders, large bundles, missing loading states

**Code Quality Scan:**
- TypeScript `any` types, `as` casts, `@ts-ignore`
- Missing error handling, console.logs, dead code

**Contract Compliance:**
- Backend matches architect spec
- Frontend matches architect spec
- Integration verified (request/response shapes match)

**Three Verdicts:**

| Verdict | What Happens |
|---|---|
| APPROVE | Creates git branch, commits, pushes, creates PR linked to issue, closes issue |
| REQUEST_CHANGES | Routes issues back to backend-dev or frontend-dev (max 2 loops) |
| BLOCK | Security vulnerability found — escalates to human, never creates PR |

**Writes code:** No

**GitHub activity:** Comments review verdict. On approve: creates PR, closes issue, adds `pipeline:done` label

---

## GitHub Issue Lifecycle

### Example 1: Bug Fix (Direct Path)

```
ISSUE #42 — [BUG] Login button not responding
Labels: type:bug, tier:T1, scope:frontend, route:direct

Comment 1 — Task Distributor:
  "Task classified — Route: DIRECT, Scope: frontend"
  Labels updated: pipeline:task-distributed → pipeline:frontend-dev

Comment 2 — Frontend Dev:
  "Started (Direct Fix) — File: LoginButton.tsx:15"

Comment 3 — Frontend Dev:
  "Complete — Fixed onClick handler binding"

Comment 4 — QA Tester:
  "Testing 2 acceptance criteria..."
  Labels updated: pipeline:frontend-dev → pipeline:qa-testing

Comment 5 — QA Tester:
  "ALL PASSED — 2/2 criteria met"
  Labels updated: pipeline:qa-testing → pipeline:pr-review

Comment 6 — PR Reviewer:
  "APPROVED — PR #43 created"
  Labels updated: pipeline:pr-review → pipeline:done

ISSUE CLOSED — "Completed. PR: #43"
```

### Example 2: New Feature (Architect Path)

```
ISSUE #44 — [FEATURE] User registration with email verification
Labels: type:feature, tier:T3, scope:fullstack

Comment 1 — Task Distributor:
  "Task classified — Route: ARCHITECT, Scope: fullstack"
  Labels updated: pipeline:task-distributed

Comment 2 — Architect:
  "Started — scanning codebase..."
  Labels updated: → pipeline:architecture

Comment 3 — Architect:
  "Complete — 3 backend files, 4 frontend files, 2 API endpoints designed"
  Labels updated: → pipeline:backend-dev, pipeline:frontend-dev

Comment 4 — Backend Dev:
  "Started (Architect Path) — 3 files to implement"

Comment 5 — Frontend Dev:
  "Started (Architect Path) — 4 components to build"

Comment 6 — Backend Dev:
  "Complete — POST /api/auth/register, POST /api/auth/verify implemented"

Comment 7 — Frontend Dev:
  "Complete — RegisterForm, VerifyEmail, AuthLayout, SuccessPage built"

Comment 8 — QA Tester:
  "Testing 5 acceptance criteria..."
  Labels updated: → pipeline:qa-testing

Comment 9 — QA Tester:
  "Bugs Found — 1 backend (missing try/catch), 1 frontend (no error state)"
  Labels added: bug:backend, bug:frontend

Comment 10 — Backend Dev:
  "Bug fix applied — added try/catch on register endpoint"

Comment 11 — Frontend Dev:
  "Bug fix applied — added error state to RegisterForm"

Comment 12 — QA Tester:
  "Re-testing (Loop 2)... ALL PASSED — 5/5 criteria met"
  Labels updated: → pipeline:pr-review

Comment 13 — PR Reviewer:
  "APPROVED — PR #45 created"
  Labels updated: → pipeline:done

ISSUE CLOSED — "Completed. PR: #45"
```

### Example 3: Bug Found by QA — Fix Loop

```
QA Tester finds bugs:
  Labels added: bug:backend

QA posts bug report:
  | File | Line | Bug | Fix Hint |
  | register.ts | 42 | Returns 500 on valid input | Missing try/catch |

Backend Dev fixes:
  "Bug fix applied — added try/catch around DB call"
  Labels removed: bug:backend

QA re-tests:
  "ALL PASSED"
  (Loop 2 of max 3)

If still failing after 3 loops:
  Labels added: needs-human-review
  "ESCALATED TO HUMAN — 3/3 loops exhausted"
```

---

## GitHub Labels Reference

### Pipeline Stage Labels

| Label | Color | Meaning |
|---|---|---|
| `pipeline:task-distributed` | Green | Task classified, brief written |
| `pipeline:architecture` | Blue | Architect designing |
| `pipeline:backend-dev` | Red | Backend dev working |
| `pipeline:frontend-dev` | Yellow | Frontend dev working |
| `pipeline:qa-testing` | Light Blue | QA testing |
| `pipeline:pr-review` | Light Green | Code review in progress |
| `pipeline:done` | Green | Completed and merged |

### Task Type Labels

| Label | Color | Meaning |
|---|---|---|
| `type:feature` | Teal | New feature — needs architect |
| `type:bug` | Red | Bug fix — direct to dev |
| `type:improvement` | Violet | Enhancement to existing feature |
| `type:refactor` | Yellow | Code restructure |

### Complexity Tier Labels

| Label | Color | Meaning |
|---|---|---|
| `tier:T1` | Light Blue | 1 file — quick fix |
| `tier:T2` | Blue | 2-3 files — small task |
| `tier:T3` | Medium Blue | 4-7 files — medium task |
| `tier:T4` | Dark Blue | 8+ files — large task |

### Scope Labels

| Label | Color | Meaning |
|---|---|---|
| `scope:backend` | Light Yellow | Backend only |
| `scope:frontend` | Light Purple | Frontend only |
| `scope:fullstack` | Light Red | Both backend and frontend |

### Status Labels

| Label | Color | Meaning |
|---|---|---|
| `route:direct` | Purple | Architect was skipped |
| `bug:backend` | Red | QA found backend bug |
| `bug:frontend` | Yellow | QA found frontend bug |
| `risk:high` | Dark Red | Touches auth/payments/security |
| `needs-human-review` | Dark Red | Escalated — human must review |

---

## Agent Summary Table

| # | Agent | Writes Code | GitHub Activity | Skipped When |
|---|---|---|---|---|
| 1 | Task Distributor | No | Creates issue + labels | Never |
| 2 | Architect | No | Comments architecture | Bug fixes, T1/T2, refactors |
| 3 | Backend Dev | Yes | Progress comments | Frontend-only tasks |
| 4 | Frontend Dev | Yes | Progress comments | Backend-only tasks |
| 5 | QA Tester | Tests only | Test results, bug labels | Never |
| 6 | PR Reviewer | No | Review, creates PR, closes issue | Never |

---

## Files Created by Pipeline

| File/Folder | Created By | Purpose |
|---|---|---|
| `.ai/brain.md` | Task Distributor (first run) | Project tech stack, patterns, conventions |
| `.ai/sessions/[date]-[task].md` | Task Distributor | Task brief, architecture, QA reports, completion report |
| `.ai/token-log.md` | Task Distributor (first run) | Task completion tracking |
| `CLAUDE.md` | Task Distributor (first run) | Project quick-start for Claude |
| `.claude/rules/api.md` | Architect | API guardrails scoped to API files |
| `.claude/rules/frontend.md` | Architect | Frontend guardrails scoped to components |
| `.claude/rules/database.md` | Architect | Database guardrails scoped to schema files |

---

## Self-Bootstrapping

Every agent auto-discovers what it needs on first run. No manual setup required.

| Agent | What It Discovers |
|---|---|
| Task Distributor | Tech stack, folder structure, commands, coding conventions, API patterns, component patterns |
| Architect | Existing codebase architecture, file organization, naming conventions, data layer |
| Backend Dev | Backend framework, ORM, validation library, middleware patterns, existing API patterns |
| Frontend Dev | UI framework, styling approach, state management, component library, existing component patterns |
| QA Tester | Test framework, test scripts, existing test patterns |
| PR Reviewer | Linting config, TypeScript strictness, coding conventions |

All discoveries are written back to `.ai/brain.md` so future agents benefit immediately.

---

## Escalation Rules

| Situation | What Happens |
|---|---|
| QA finds bugs (loop 1-3) | Routes back to responsible dev agent |
| QA fails 3 loops | Escalates to human with `needs-human-review` label |
| PR reviewer finds quality issues (loop 1-2) | Routes back to responsible dev agent |
| PR reviewer fails 2 loops | Escalates to human |
| PR reviewer finds security vulnerability | Immediately blocks — `needs-human-review` + `security-vulnerability` labels |
| Direct fix needs architecture | Dev agent stops and flags — user re-routes through architect |
| Vague user request | Task distributor asks ONE clarifying question and stops |

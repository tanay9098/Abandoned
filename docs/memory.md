
# Abandonment — Engineering Memory and Decision Log

**Purpose:** Maintain an auditable record of project decisions, implementation changes, rationale, tests, and commits.

**Owner:** Project contributors and coding agents  
**Update policy:** Update this document after each meaningful implementation change.

---

## 1. Rules for This Document

1. Record actual changes, not planned changes presented as completed work.
2. Explain why a change was made and which requirement it supports.
3. Record relevant files and modules.
4. Record tests actually executed and their results.
5. Record actual Git commit hashes only when the commits exist.
6. Never invent test results, commits, or implementation details.
7. Keep historical entries. Append corrections instead of silently rewriting history.
8. Record rejected approaches when they explain an important technical decision.
9. Link related entries to `PRD.md`, `Architecture.md`, `Design.md`, `Rules.md`, and `Tracker.md`.
10. Do not store secrets, access tokens, passwords, or private user data here.

Git history remains the authoritative source for code changes. This file explains the reasoning behind those changes.

---

## 2. Project Baseline

### Product

Abandonment is a paranormal-themed to-do application. Incomplete commitments can become interactive ghosts after deadlines pass.

### Core functionality

- Native task management.
- Google Calendar integration.
- Deadline detection.
- Midnight review.
- Ghost animations.
- Contextual ghost dialogue.
- Sound effects.
- Task completion, rescheduling, and release.
- User preferences and accessibility controls.

### Initial architectural decisions

| ID | Decision | Rationale |
|---|---|---|
| ADR-001 | Next.js and TypeScript | Shared application framework for UI and server APIs |
| ADR-002 | PostgreSQL persistence | Reliable task state and durable haunting history |
| ADR-003 | Deterministic deadline engine | AI must not determine whether tasks are overdue |
| ADR-004 | Google Calendar read-only MVP | Minimize permissions and prevent unintended external changes |
| ADR-005 | Motion for React | Interface transitions and event-driven animation |
| ADR-006 | Rive ghost character | Reusable character animation states |
| ADR-007 | Howler.js | Centralized audio playback and sound settings |
| ADR-008 | Optional AI dialogue | Core task management must work without model availability |
| ADR-009 | Idempotent scheduled jobs | Prevent duplicate hauntings and midnight reviews |
| ADR-010 | Accessible, skippable effects | Preserve usability and user control |

These decisions describe the intended baseline. Verify actual implementation before marking any decision as implemented.

---

## 3. Current Project State

Update this section when implementation changes materially.

### Repository

- Repository location: `/home/user/Abandoned` (remote `origin` = `https://github.com/tanay9098/Abandoned`).
- Current branch: `claude/jolly-planck-yml8nu` (also `main`; identical at session start).
- Base commit: `2577531` ("docs:initialised repo with initial work mentioned in .md files").
- Package manager: none yet (no `package.json`, no lockfile) — npm 10.9.4 on Node v22.22.0 is available.
- Existing framework and dependencies: none. The repository contained only `docs/*.md` (six files) at baseline.
- Current test framework: none.
- Deployment environment: none recorded.
- External tooling verified available: npm registry reachable; Playwright 1.63.0 + pre-installed Chromium at `/opt/pw-browsers`; `psql` client only (no Postgres server); no Supabase / Google / AI credentials.

### Implementation status

Updated 2026-10-30 after the first full implementation session. Evidence is in §8 and `Tracker.md`.

- [x] Existing repository inspected (docs-only, greenfield).
- [x] Project baseline documented.
- [x] Core task management implemented (CRUD, complete/reopen/release, reschedule, filter/sort, daily/weekly/monthly recurrence).
- [x] Database schema and migrations implemented (`supabase/migrations/0001_initial_schema.sql`, verified on PGlite incl. RLS).
- [x] Deadline processing implemented (deterministic, idempotent, scheduler + open-time reconcile).
- [x] Google Calendar integration implemented — **verified against mocked HTTP and the demo provider only; no live Google account was available**.
- [x] Ghost animations implemented (inline SVG + Motion; Rive intentionally not used, ADR-014).
- [x] Sound design implemented (Howler; original synthesised assets). Policy/manager unit-tested with a fake Howl; **audible playback in a real browser was not verified** (headless sandbox).
- [x] Midnight review implemented.
- [~] Accessibility and preferences implemented — preferences, reduced motion, labels, focus, live regions done; **no screen-reader or full manual keyboard audit performed**.
- [x] Tests passing (see §8).
- [x] README and demo instructions complete.
- [ ] Demo video / DEV submission write-up — not started.
- [ ] Live Supabase project and live Google OAuth verification — blocked on credentials.

Do not mark a box complete without evidence.

---

## 4. Change Log

Append one entry for every meaningful change.

### Change entry template

#### CHANGE-YYYYMMDD-NNN — Short description

- **Date:** YYYY-MM-DD
- **Author:** Human contributor or AI agent
- **Status:** Proposed / Implemented / Reverted
- **Related requirement:** PRD section or requirement ID
- **Reason:** Why this change was needed.
- **Previous behavior:** What happened before.
- **New behavior:** What changed.
- **Files changed:** List relevant paths.
- **Dependencies added or removed:** Include versions and justification.
- **Database/API impact:** Describe migrations or contract changes.
- **Tests executed:** Exact commands and actual results.
- **Manual verification:** What was checked, if applicable.
- **Known limitations:** Outstanding issues.
- **Commit:** Actual hash, or `Not committed`.
- **Follow-up:** Next action, if any.


### CHANGE-20261030-001 — Greenfield implementation of the Abandonment MVP

- **Date:** 2026-10-30
- **Author:** AI agent (Claude Code), at the project owner's request to implement all phases in one session
- **Status:** Implemented (see limitations)
- **Related requirement:** PRD FR-01 … FR-10; Tracker phases 0–10
- **Reason:** Repository contained only `docs/*.md`.
- **Previous behavior:** No application code, `package.json`, tests or CI.
- **New behavior:** Next.js 16 App Router + strict TypeScript application with: task manager; deterministic deadline engine; idempotent midnight review; Google Calendar read-only integration (+ demo provider); ghost character + event-driven sound; optional AI dialogue with deterministic fallback; preferences; guest-session auth; PostgreSQL schema with RLS; scheduler endpoints; Vitest + Playwright suites; README and CI workflows.
- **Files changed:** `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`, `.env.example`, `.gitignore`, `README.md`, `.github/workflows/*`, `supabase/migrations/0001_initial_schema.sql`, `scripts/*`, `public/sounds/*`, `src/**` (≈ 8.8k lines incl. tests), `tests/**`; docs updated (`memory`, `Tracker`, `Architecture` §12, `Design` §16).
- **Dependencies added:** see §6.
- **Database/API impact:** new; see §7 and `Architecture.md` §12.
- **Tests executed:** see §8 (all actually run; results recorded there).
- **Manual verification:** screenshots of dashboard, midnight review, calendar, settings and a 390 px mobile viewport were inspected; one visual defect (cramped mobile task rows) was found and fixed. Zero-config dev mode (`.data/pglite`) verified to persist across a server restart. Production boot without `SESSION_SECRET`/`CRON_SECRET` verified to refuse requests.
- **Known limitations:** see README “Known limitations” and Tracker.
- **Commit:** `78d0df6` (see §9).
- **Follow-up:** live Supabase + Google verification; screen-reader audit; demo recording.

#### Defects found by verification during this session (recorded, not hidden)

1. **Selection jump** — acknowledging a ghost re-sorted the queue and the panel switched to a different ghost; completing the selected ghost left an empty panel. Found by the Playwright journey test. Fixed in `WorkspaceProvider` (pin on acknowledge; selection valid only while still a live haunting).
2. **On-disk demo DB failed to start** — PGlite does not create missing parent directories (`.data/`). Found only by running zero-config dev mode manually (e2e uses in-memory). Fixed in `server/db/adapters.ts`; regression test `tests/integration/persistence.test.ts` added.
3. **Mobile task-row layout** — action buttons crushed the title at 390 px. Found by screenshot review. Fixed in `TaskRow.tsx`.
4. **Test-only mistakes** (not product bugs): an RLS test deadlocked by querying outside an open PGlite transaction; e2e selectors collided with Next’s `role=alert` route announcer; e2e raced the auto-opening midnight review; a production-env test lacked required secrets (the guard was correct). Tests were corrected, assertions were not weakened.
5. **Type error in a test fake** surfaced by `npm run typecheck` (not by vitest) — fixed with a typed `FakeHowl` class.

---

## 5. Decision Records

### ADR template

#### ADR-NNN — Decision title

- **Date:**
- **Status:** Proposed / Accepted / Superseded
- **Context:** What problem must be solved?
- **Decision:** What was selected?
- **Alternatives considered:** What else was evaluated?
- **Rationale:** Why is the chosen approach preferable?
- **Consequences:** Benefits, trade-offs, and limitations.
- **Affected modules:** Relevant file paths.
- **Related decisions:** ADR identifiers.
- **Supersedes:** Previous ADR, if applicable.

Never silently change an accepted architectural decision. Add a new ADR explaining why the previous decision is superseded.


### ADR-011 — Guest-session authentication behind a single seam
- **Date:** 2026-10-30 · **Status:** Accepted
- **Context:** Architecture allows “Supabase Auth or another explicitly selected mechanism”. No Supabase project/credentials exist; the app must run with zero configuration and be testable.
- **Decision:** Signed (`HMAC-SHA256`), `httpOnly`, `SameSite=Lax` session cookie bound to a server-side `profiles` row. All access flows through `getSessionUserId`-style verification in `server/auth/session.ts` and `server/http.ts`.
- **Alternatives:** Supabase Auth (untestable here; would force credentials for any run); Auth.js (heavy, same credential problem).
- **Consequences:** Private archive per browser; sign-out is irreversible; no cross-device login. Swapping providers touches one module and maps `auth.uid()` → `profiles.id`. Documented in README limitations.
- **Modules:** `src/server/auth/session.ts`, `src/server/http.ts`, `src/app/api/auth/*`.

### ADR-012 — One SQL implementation; PGlite for demo/tests, `pg` for Supabase/PostgreSQL
- **Context:** Needed real Postgres semantics (unique constraints, `ON CONFLICT`, `FOR UPDATE`, RLS, TIMESTAMPTZ) in tests and zero-config demos, with a production path to Supabase.
- **Decision:** Hand-written SQL repositories over a tiny `Db` interface; adapters for PGlite (`@electric-sql/pglite`) and `pg`. Migrations are plain SQL in `supabase/migrations`, applied by a ~30-line runner (`schema_migrations`).
- **Alternatives:** `@supabase/supabase-js` (needs a live PostgREST; untestable offline); an ORM (extra dependency, hides locking semantics we must control); an in-memory fake store (would not prove the constraints).
- **Consequences:** The identical SQL is verified on real Postgres semantics. **The `pg`/Supabase connection itself is unverified live.** The server connects as a privileged role and scopes every query by `user_id`; RLS is defence in depth and is tested by switching to a non-privileged role.
- **Modules:** `src/server/db/*`, `src/server/repositories/*`, `supabase/migrations/0001_initial_schema.sql`.

### ADR-013 — Overdue stays derived; dedupe key embeds the deadline
- **Decision:** No overdue column. `deadline_missed` dedupe key = `deadline_missed:<taskId>:<due_at epoch ms>`, unique per user. Rescheduling to a new deadline yields a new key (a genuine new haunting if missed again); retries of the same deadline cannot duplicate. The engine locks the row and re-checks status + deadline before inserting. `occurred_at` = the deadline instant; `created_at` = detection time.
- **Rationale:** PRD FR-03, Rules §6. **Consequence:** concurrency is proven with an injected `beforeRecheck` hook and DB uniqueness; PGlite is single-connection so true multi-connection lock contention was not exercised.

### ADR-014 — Rive not adopted; inline SVG + Motion state machine
- **Context:** Design/Architecture allow Rive “if the selected asset requires it”. Authoring a `.riv` requires the Rive editor; none is available, and shipping a third-party asset would raise licensing risk.
- **Decision:** Original inline SVG ghost animated by Motion through seven explicit states, with an error-boundary static fallback and reduced-motion variants. `GhostCharacter` takes a `state` prop so a Rive artboard can replace it later. No Rive runtime was installed (Architecture: “do not install multiple runtimes”).

### ADR-015 — Google Calendar via REST + `fetch`, scope `calendar.events.readonly`
- **Decision:** No `googleapis` SDK. OAuth 2.0 code flow with PKCE and a signed, single-use, session-bound state cookie; tokens AES-256-GCM encrypted (`node:crypto`); `events.list` with `singleEvents=true`, `showDeleted=true` and a `fields` mask that excludes descriptions/attendees. Scope narrower than the doc’s example `calendar.readonly`.
- **Alternatives:** `googleapis` (very large dependency for one endpoint). **Consequence:** only mocked-HTTP verification.

### ADR-016 — Optional AI via an open-weight model (Gemma) over an OpenAI-compatible endpoint
- **Revision (2026-10-31):** Switched from the Anthropic Messages API to the OpenAI-compatible Chat Completions shape so the ghost runs on open-weight **Gemma** (the DEV challenge asks for open-source AI at the core). Configured by `AI_BASE_URL` / `AI_API_KEY` (optional) / `AI_MODEL` (default `gemma3:4b`) / `AI_TIMEOUT_MS`; works with local Ollama/llama.cpp/vLLM or hosted Google AI Studio / Hugging Face. Instructions are folded into the single user turn because Gemma has no system role. `render.yaml` deploys it on Render.
- **Decision:** Provider-agnostic `generateDialogue` returning validated text or `null`; no SDK, no tools, no autonomy. Sends title + coarse overdue duration only; AI is opt-in per user (disclosed in Settings), rate-limited, 4 s timeout, output validated (length, tone denylist, no URLs/markdown/emoji/injection echoes), cached once per haunting.

### ADR-017 — Reconciliation endpoint and test clock
- **Decision:** `POST /api/hauntings/reconcile` runs the same engine scoped to the caller when the app opens/polls/regains focus/passes the next deadline. `X-Test-Now` can override server time **only** when `ABANDONMENT_ALLOW_TEST_CLOCK=1` and `VERCEL_ENV!=production` (unit-tested), enabling deadline simulation without waiting.

### ADR-018 — Domain semantics chosen where the docs were silent
- Date-only deadline = end of that local day (first instant of next day); boundary inclusive (`due_at <= now`).
- DST: nonexistent wall times shift forward by the gap; ambiguous times take the first occurrence.
- Midnight review = the review for the user’s *current* local date, created idempotently by scheduler or on open; summarises tasks already overdue at that local midnight; `newlyOverdue` flags those that crossed since the previous midnight; empty reviews are stored but not presented.
- Calendar: stored `upcoming`/`past_pending_review` are recomputed against `now` on read (no stale derived state); decisions `confirmed_missed`/`not_missed` survive re-sync unless Google cancels the event.
- `text-muted` raised from `#737582` (3.92:1 on surface) to `#8A8C99` (5.37:1) to meet WCAG AA — see `Design.md` §16.

### ADR-019 — UI primitives and fonts
- Radix primitives (`dialog`, `switch`, `slider`, `checkbox`, `slot`) written shadcn-style by hand (the shadcn CLI needs a network registry); `class-variance-authority`/`clsx`/`tailwind-merge` as shadcn requires. Fonts via Fontsource packages (local, offline-reproducible builds) instead of `next/font/google`.

---

## 6. Dependency Ledger

Track meaningful dependency changes.

| Date | Package | Version | Action | Reason | Alternatives | Related change |
|---|---|---|---|---|---|---|
| 2026-10-30 | next / react / react-dom | 16.4.3 / 19.3.1 | add (runtime) | App framework (ADR-001) | — | CHANGE-20261030-001 |
| 2026-10-30 | typescript | 5.9.3 (pinned to 5.x) | add (dev) | Strict typing; TS 7 native port judged too new for Next/ESLint toolchain | TS 7.0.2 | CHANGE-20261030-001 |
| 2026-10-30 | tailwindcss, @tailwindcss/postcss, postcss | 4.3.x | add (dev) | Styling per Architecture | CSS modules | CHANGE-20261030-001 |
| 2026-10-30 | @radix-ui/react-{dialog,switch,slider,checkbox,slot} | 1.x | add (runtime) | Accessible primitives (focus trap, ARIA) for shadcn-style components | hand-rolled dialogs (a11y risk) | CHANGE-20261030-001 |
| 2026-10-30 | class-variance-authority, clsx, tailwind-merge | latest | add (runtime) | Variant/className utilities required by shadcn pattern | — | CHANGE-20261030-001 |
| 2026-10-30 | lucide-react | 1.65 | add (runtime) | Icons per Design | — | CHANGE-20261030-001 |
| 2026-10-30 | motion | 14.8 | add (runtime) | Interface + ghost animation (ADR-005) | CSS-only | CHANGE-20261030-001 |
| 2026-10-30 | howler | 2.2.4 (+ @types/howler) | add (runtime) | Sound playback (ADR-007), lazy-imported | WebAudio directly | CHANGE-20261030-001 |
| 2026-10-30 | zod | 4.6 | add (runtime) | Strict server-side input validation | hand-written validators | CHANGE-20261030-001 |
| 2026-10-30 | pg | 8.23 | add (runtime) | PostgreSQL/Supabase driver | supabase-js (needs PostgREST) | ADR-012 |
| 2026-10-30 | @electric-sql/pglite | 0.5.13 | add (runtime) | Zero-config demo DB + real-SQL integration tests | in-memory fake | ADR-012 |
| 2026-10-30 | @fontsource-variable/manrope, @fontsource/dm-mono, @fontsource-variable/lora | 5.3 | add (runtime) | Local fonts (Design §4) | next/font/google (build-time network) | ADR-019 |
| 2026-10-30 | vitest, jsdom, @testing-library/react, @testing-library/dom | 5.0.5 / 29 / 16 | add (dev) | Unit/integration/component tests | jest | CHANGE-20261030-001 |
| 2026-10-30 | @playwright/test | 1.63.0 (matches pre-installed browser) | add (dev) | E2E journeys | cypress | CHANGE-20261030-001 |
| 2026-10-30 | eslint, eslint-config-next | 9.39 / 16.4.3 (ESLint pinned to 9.x) | add (dev) | Lint | ESLint 10 (peer-range risk) | CHANGE-20261030-001 |
| 2026-10-30 | @types/node, @types/react, @types/react-dom, @types/pg | — | add (dev) | Types | — | CHANGE-20261030-001 |

**Deliberately not installed:** `@rive-app/*` (ADR-014); `googleapis` (ADR-015); `@supabase/supabase-js` / `@supabase/ssr` (ADR-011/012); any AI SDK (ADR-016); any date-time library (Intl suffices); an MCP server (no integration use case — Rules §8); a 3D engine (Rules §9). `@vitejs/plugin-react` was not needed (Vitest’s built-in JSX transform suffices).

Record:
- New runtime dependencies.
- New development dependencies.
- Removed dependencies.
- Major version changes.
- Security-related upgrades.
- Replacement of existing libraries.

Do not log every transitive dependency separately unless it is relevant to a security or compatibility decision.

---

## 7. API and Schema Change Ledger

Record changes to:

- HTTP endpoints.
- Request and response formats.
- Authentication requirements.
- Authorization rules.
- Database tables and columns.
- Indexes and constraints.
- Scheduled jobs.
- External integration behavior.

For every change, record whether it is backward-compatible and whether a migration is required.

Never claim an API is backward-compatible without checking its previous contract and callers.


| Date | Surface | Change | Backward-compatible | Migration |
|---|---|---|---|---|
| 2026-10-30 | DB schema | `0001_initial_schema.sql`: profiles, user_preferences, tasks, calendar_connections, calendar_events, ghost_events, daily_reviews + RLS + indexes. **Additive deltas vs `Architecture.md` §5:** `tasks.recurrence`, `tasks.version`; `user_preferences.midnight_presentation`, `.ai_dialogue_enabled`; `calendar_connections.is_demo` + partial unique index (one active connection/user); `calendar_events.all_day`, `.reviewed_at`, status value `not_missed`; `ghost_events.acknowledged_at`, type `task_rescheduled`, unique `(user_id, dedupe_key)`; `daily_reviews.presented_at/dismissed_at` | n/a (new) | Applied by `npm run db:migrate` / auto on PGlite |
| 2026-10-30 | HTTP | Implemented all endpoints in `Architecture.md` §6. **Additions:** `POST /api/auth/guest`, `POST /api/auth/logout`, `POST /api/hauntings/reconcile`, `POST /api/hauntings/:id/dialogue`, `POST /api/hauntings/midnight-review` (seen/dismiss), `GET /api/calendar/connection`; jobs also accept `GET` (Vercel Cron). `PATCH /api/tasks/:id` returns `{task, nextTask}`; tasks carry derived `isOverdue/overdueMs/ghostState/haunting`; `POST /api/tasks` also accepts `dueDate`/`dueTime` (zone-aware wall clock) and `recurrence`. | n/a (new) | none |

---

## 8. Test Evidence

Maintain a short record of meaningful verification.

| Date | Command or test | Result | Related change | Notes |
|---|---|---|---|---|
| 2026-10-30 | `npm run lint` | PASS (exit 0, no warnings) | CHANGE-20261030-001 | After fixing react-hooks `refs`/`set-state-in-effect` findings in `use-sound.ts`, `WorkspaceProvider.tsx`, `login/page.tsx` |
| 2026-10-30 | `npm run typecheck` | PASS (exit 0) | CHANGE-20261030-001 | An earlier run FAILED on a test fake (`sound.test.ts`); fixed and re-run |
| 2026-10-30 | `npm test` (Vitest) | PASS — 15 files, 174 tests | CHANGE-20261030-001 | Unit (zone/DST, task model, validation, hauntings, calendar model, OAuth/crypto/session, sound policy+manager, ghost component, misc) + integration on real Postgres semantics via PGlite (schema/RLS, deadline engine, tasks, midnight review, calendar service, dialogue, persistence) |
| 2026-10-30 | `npm run build` | PASS — compiled, 0 warnings | CHANGE-20261030-001 | An earlier build warned about dynamic fs tracing in `migrate.ts`; resolved with `turbopackIgnore` |
| 2026-10-30 | `npm run test:e2e` (Playwright, Chromium via `PW_CHROMIUM_PATH`) | PASS — 13/13 | CHANGE-20261030-001 | Run from a clean build. An earlier run FAILED 6/13 (selector collisions, a selection-jump product bug, a test race); fixed and re-run |
| 2026-10-30 | Manual: zero-config `next dev`, create guest, seed, restart, re-read | PASS | CHANGE-20261030-001 | Initially FAILED (missing `.data` dir) — fixed, regression test added |
| 2026-10-30 | Manual: `next start` without secrets | PASS (refuses requests, logs missing vars) | CHANGE-20261030-001 | |
| 2026-10-30 | Secret scan (`grep` for key patterns) | PASS (none found) | CHANGE-20261030-001 | Pattern-based only; not a substitute for a secret-scanning service |
| 2026-10-30 | Live Supabase connection / live Google OAuth / live AI provider / audible audio / screen reader | NOT RUN | — | Blocked: no credentials, no audio device, no AT in the sandbox |

Allowed results:
- PASS
- FAIL
- BLOCKED
- NOT RUN

If a command fails, record the failure and whether it was resolved. Do not replace a failed result with PASS unless the test is actually rerun successfully.

---

## 9. Commit Ledger

| Date | Commit hash | Summary | Related changes | Verification |
|---|---|---|---|---|
| 2026-10-31 | `78d0df6` | Implement Abandonment MVP (authorised by the owner; pushed to `origin/claude/jolly-planck-yml8nu`) | CHANGE-20261030-001 | lint, typecheck, 174 unit/integration tests, build, 13 e2e all run before the commit |

Rules:
- Read real Git history to recover commit hashes.
- Do not create commits unless explicitly authorized by the project owner.
- Do not invent hashes.
- Do not claim that a change was committed merely because code was edited.
- Link commits to the change entries they implement.

---

## 10. Recovery and Handoff

When resuming work:

1. Read `Rules.md`.
2. Read `Tracker.md`.
3. Read this document.
4. Inspect the current repository and Git status.
5. Compare the documented state with actual code.
6. Identify incomplete work and uncommitted changes.
7. Continue without duplicating completed work.
8. Update the tracker and memory after the change.

If this document conflicts with actual code, migrations, tests, or Git history, investigate and correct the documentation. Never assume the memory file is automatically correct.

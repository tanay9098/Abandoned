
# Abandonment — Implementation Tracker

**Purpose:** Track implementation progress, dependencies, verification, and outstanding work.

**Status:** MVP implemented and verified locally; live-credential verification and submission assets outstanding
**Last updated:** 2026-10-30

---

## 1. Status Definitions

- `NOT STARTED` — Work has not begun.
- `IN PROGRESS` — Work is actively being implemented.
- `BLOCKED` — Work cannot proceed because of a documented dependency or issue.
- `IN REVIEW` — Implementation is ready for review but not yet accepted.
- `DONE` — Implementation and required verification are complete.
- `DEFERRED` — Intentionally postponed with a recorded reason.

Never mark work `DONE` merely because files were created.

Legend used below: `[x]` DONE · `[~]` IN REVIEW (implemented; a stated part of the verification could not be performed) · `[ ]` NOT DONE (with reason). Evidence for every claim is in `memory.md` §8.

---

## 2. Phase 0 — Repository Inspection — DONE

- [x] Inspect the existing repository structure. (Docs only; no code, no `package.json`.)
- [x] Read existing project documentation.
- [x] Inspect `package.json` and lockfile. (None existed.)
- [x] Identify the package manager. (npm 10.9.4 / Node 22.22.)
- [x] Identify existing UI and styling conventions. (None.)
- [x] Identify existing APIs and integration contracts. (None.)
- [x] Identify database and authentication setup. (None.)
- [x] Inspect existing tests and scripts. (None.)
- [x] Inspect Git branch, status, and recent history. (`claude/jolly-planck-yml8nu`, base `2577531`, clean.)
- [x] Record baseline findings in `memory.md`.
- [x] Reconcile this tracker with the actual repository.

---

## 3. Phase 1 — Application Foundation — DONE

- [x] Establish the Next.js application (16.4.3, App Router, Turbopack).
- [x] Verify TypeScript configuration (`strict`, `noUncheckedIndexedAccess`).
- [x] Establish design tokens (`src/app/globals.css`).
- [x] Configure the shared application layout (`AppShell`, `Workspace`).
- [x] Implement responsive navigation (side rail ≥ lg, bottom bar below).
- [x] Configure accessible component primitives (Radix-based `components/ui`).
- [x] Establish environment variable validation (`lib/env.ts`; production refuses to run without secrets — verified).
- [x] Verify lint, type-check, test, and build scripts.
- [x] Write baseline tests.
- [x] Update documentation.

---

## 4. Phase 2 — Native Task Management — DONE (two notes)

- [x] Design and migrate the task schema.
- [x] Task creation · listing and filtering · editing · completion · rescheduling · release.
- [x] Task deletion (hard delete with confirmation; history preserved via `ON DELETE SET NULL` + title snapshot).
- [x] Server-side validation (Zod `.strict()`).
- [x] Ownership and authorization checks (user-scoped queries; foreign id ⇒ 404; verified in integration + e2e).
- [x] Add relevant database indexes.
- [x] Test tasks without deadlines.
- [x] Test exact deadline boundaries (1 ms before / at / after).
- [~] Test concurrent task updates — optimistic concurrency (`expectedVersion`) and interleaving via an injected hook are tested; **true multi-connection row-lock contention is untested** (PGlite is single-connection).
- [x] Verify API compatibility — no pre-existing API; contract documented in `Architecture.md` §12.
- [x] Update `memory.md` and `Architecture.md`.
- [x] Recurrence (daily/weekly/monthly) — implemented as the simple P1 subset; *advanced* recurrence is P2 → `DEFERRED`.
- [ ] Subtasks — `DEFERRED` (FR-08 makes them conditional: “if subtasks are implemented”).

---

## 5. Phase 3 — Deadline Engine — DONE (one note)

- [x] Deterministic overdue calculation (`features/tasks/model.ts`, inclusive boundary).
- [x] Background processing mechanism (`POST|GET /api/jobs/process-deadlines`, `.github/workflows/scheduler.yml`).
- [x] Secure scheduled-job execution (constant-time bearer check; 401 verified in e2e).
- [x] Stable haunting idempotency keys.
- [x] Prevent duplicate ghost events (unique key; repeated + overlapping runs tested).
- [x] Recheck task state before recording a haunting (locked row; tested for complete **and** reschedule in flight).
- [x] Completed and released tasks · tasks without deadlines.
- [x] Time-zone changes (deadlines are instants; review keyed by local date; history not rewritten — tested).
- [x] Daylight-saving transitions (spring-forward gap, fall-back overlap, 23h/25h days, midnight-gap zone, half-hour DST).
- [x] Application-open reconciliation (`POST /api/hauntings/reconcile` + poll/visibility/next-deadline timer).
- [x] Retries and duplicate job execution.
- [~] Simultaneous completion and deadline processing — tested via `beforeRecheck` hook (deterministic interleaving), not with parallel DB connections.

---

## 6. Phase 4 — Google Calendar Integration — IN REVIEW (live verification blocked)

- [ ] Configure Google Cloud project · enable Calendar API · configure OAuth consent and redirect URLs — **BLOCKED**: requires the owner’s Google account; steps documented in README.
- [x] Select minimum necessary scopes (`calendar.events.readonly`).
- [x] OAuth initiation and callback (PKCE + signed single-use state cookie).
- [x] Validate OAuth state (mismatch, missing, expired, other-user, forged cookie, provider error — unit + e2e).
- [x] Store credentials securely (AES-256-GCM; never returned to the browser).
- [x] Event retrieval (paged, read-only, field-masked).
- [x] Normalise dates and identifiers · recurring (single-event expansion) · all-day (zone-anchored, exclusive end) · cancelled events.
- [x] Handle revoked access / token refresh / provider outage.
- [x] Prevent duplicate synchronised events (unique `(connection_id, provider_event_id)`; re-sync tested).
- [x] Display events alongside native tasks (dashboard + Calendar page; source labelled; dashed “external” style).
- [x] Link events to their original Calendar pages (https + google.com hosts only).
- [x] Past-event review · explicit missed-event confirmation (never inferred; decision survives re-sync; changeable).
- [x] Disconnect and credential cleanup (revoke at provider, wipe tokens, delete event copies, keep history).
- [x] Unauthorized access and token failures tested.
- [~] **All of the above were verified against mocked HTTP and the labelled demo provider only. No live Google account/credentials were available.**

---

## 7. Phase 5 — Ghost Experience — DONE

- [x] Ghost visual specification (Design §7) · original ghost asset (inline SVG; no third-party art).
- [x] Rive runtime — **not required** for the chosen asset (ADR-014); intentionally not installed.
- [x] Idle · awakening · observing/confrontation · rescheduled · released · completed states (`GhostCharacter`).
- [x] Ghost dialogue UI · deterministic fallback dialogue (non-shaming; tested) · overdue duration metadata.
- [x] Haunting history (Graveyard + per-task sighting log).
- [x] Connect ghost states to application events (event bus).
- [x] Behaviour when animation fails (error boundary → static SVG; tested).
- [x] Reduced-motion behaviour (OS + in-app; unit + e2e).

---

## 8. Phase 6 — Sound Design — IN REVIEW (audibility unverified)

- [x] Source licensed assets — all six are **original, procedurally synthesised, CC0** (`scripts/generate-sounds.mjs`); wind, whoosh, midnight chimes ×3, whisper, completion, release.
- [x] Record asset sources and licences (`public/sounds/manifest.json`).
- [x] Centralised audio (`SoundManager`) · global toggle · volume · ambient control.
- [x] Prevent duplicate/overlapping playback · quiet-hour behaviour · autoplay restrictions (policy + manager unit-tested with a fake Howl).
- [x] Sound disabled: no sound file is even requested (e2e); failing audio assets don’t break the app (e2e).
- [~] **Not verified:** actual audible output/quality in a real browser (headless sandbox, no audio device). The synthesised sounds are functional placeholders.

---

## 9. Phase 7 — Midnight Review — DONE

- [x] Local-date calculation · user-specific midnight boundaries (DST-safe).
- [x] Daily review generation · duplicate prevention (unique `(user_id, local_date)`; concurrent/repeat tested).
- [x] Include eligible overdue tasks · Calendar events awaiting review.
- [x] Summary UI (skippable, Esc, replayable) · review actions (complete / reschedule / release).
- [x] Respect sound and motion preferences (e2e with reduced motion).
- [x] Users offline at midnight · retries · time-zone changes · DST boundaries (integration tests).

---

## 10. Phase 8 — AI Dialogue (Optional MVP Feature) — IN REVIEW (live provider unverified)

- [x] Provider: open-weight Gemma via any OpenAI-compatible endpoint over `fetch` (ADR-016, revised 2026-10-31); minimum context (title + coarse duration); disclosure in Settings; opt-in.
- [x] Output validation (length/tone/format/injection echo) · malformed and unsafe outputs tested.
- [x] Unavailable providers, timeouts, rate limits → deterministic fallback.
- [x] External event descriptions never requested, stored or sent.
- [x] Core functionality works without AI (default; e2e).
- [~] A real provider call was **not** made (no Gemma endpoint in the sandbox). Request shape follows the OpenAI Chat Completions API; response handling is tested with mocked HTTP.

---

## 11. Phase 9 — Accessibility and Reliability — IN REVIEW

- [~] Keyboard navigation — all controls are native/Radix and focusable, dialogs trap focus and close on Esc (e2e uses Esc); **no complete manual keyboard-only walkthrough** was done.
- [x] Focus visible everywhere (global `:focus-visible`).
- [x] Colour contrast — token ratios computed (`Design.md` §16); muted text lifted to meet 4.5:1. **No automated page-level audit (axe/Lighthouse) was run.**
- [x] Reduced motion · loading / error / empty / disconnected states (designed and exercised in e2e).
- [~] Screen-reader labels — roles, labels, `aria-live` announcements implemented and exercised through role-based selectors; **never tested with a real screen reader**.
- [~] Mobile layouts — a 390 px viewport was reviewed by screenshot (one defect fixed); other breakpoints/devices not reviewed.
- [x] Database authorization policies (RLS verified by role-switching on real Postgres semantics).
- [x] Scheduler authentication · secret handling (no secrets in repo; production refuses default secrets).
- [x] Task and haunting history integrity (history survives reschedule, release, delete).

---

## 12. Phase 10 — Submission Readiness — IN PROGRESS

- [x] Run the full test suite · type checking · linting · production build (all pass; see `memory.md` §8).
- [x] Resolve or document known failures (none open; defects found and fixed are listed in `memory.md`).
- [~] Verify a clean setup from documented instructions — zero-config `npm run dev` path verified (incl. restart persistence); a from-scratch clone + `npm ci` was not repeated.
- [x] Update README · architecture and design documentation.
- [x] Prepare demo data (“sample case files” seed + demo calendar).
- [ ] Record a complete user journey — **NOT DONE** (no screen recording possible in the sandbox).
- [x] Verify no secrets are committed (pattern scan; `.env*` git-ignored).
- [x] Verify asset licences and attribution (all original/CC0; fonts OFL).
- [~] Review Git history — one implementation commit (`78d0df6`) on top of `2577531`; history not otherwise reviewed.
- [ ] Verify the project meets the challenge requirements against the live DEV rules — not done.
- [ ] Prepare the submission write-up — **NOT STARTED** (README exists; the DEV post does not).

---

## 13. Current Sprint

### Sprint goal

Build the smallest complete and testable Abandonment experience. — **Achieved locally**; remaining items are credential-dependent or submission assets.

### Sprint tasks

- [x] Inspect the repository.
- [x] Establish the task data model.
- [x] Build the task dashboard.
- [x] Implement deterministic deadline processing.
- [x] Implement the first ghost awakening.
- [x] Add a minimal sound sequence.
- [x] Connect Google Calendar (demo provider + mocked-HTTP Google path).
- [x] Implement midnight review.
- [x] Verify the end-to-end demo (Playwright, controlled clock).

### Blockers

| # | Description | Phase | Impact | Needed | Status |
|---|---|---|---|---|---|
| B1 | No Google OAuth client/credentials | 4 | Live OAuth, token refresh/revoke unverified | Owner’s Google Cloud project; set `GOOGLE_*` + `TOKEN_ENCRYPTION_KEY` | Open |
| B2 | No Supabase project / `DATABASE_URL` | 2, 3 | `pg` driver + hosted migration path unverified live (SQL itself verified on PGlite) | Supabase project; `npm run db:migrate` | Open |
| B3 | No Gemma endpoint (Ollama / AI Studio key) | 8 | Live AI path unverified | `AI_BASE_URL` (+ `AI_API_KEY` if hosted) | Open (optional feature) |
| B4 | No audio device / assistive tech in sandbox | 6, 9 | Audible quality and screen-reader behaviour unverified | Manual pass in a real browser | Open |
| B5 | Commit not authorised | 10 | — | Owner authorised on 2026-10-31 | Resolved (`78d0df6`) |

---

## 14. Change Tracking Rules

After each meaningful implementation step, the coding agent must:

1. Update the status of affected tasks.
2. Add or update acceptance criteria.
3. Record actual tests and results.
4. Record unresolved failures.
5. Update `memory.md`.
6. Update architecture or design documents if needed.
7. Record a real commit hash only if a commit exists.

Do not mark future phases complete simply because earlier phases were completed.

---

## 15. Progress Summary

- **Current phase:** 10 — Submission readiness (Phases 0–9 implemented; see per-phase notes for unverified parts).
- **Last completed task:** Full verification run and documentation pass (2026-10-30).
- **Current task:** None in progress.
- **Next task (priority order):** (1) open a PR when ready (not created); (2) live Supabase + Google verification (B1/B2); (3) manual keyboard + screen-reader + audio pass (B4); (4) screen-record the demo journey; (5) write the DEV submission post; (6) consider swapping guest auth for Supabase Auth (ADR-011).
- **Tests passed:** `npm run lint` (exit 0) · `npm run typecheck` (exit 0) · `npm test` (15 files / 174 tests) · `npm run build` · `npm run test:e2e` (13/13).
- **Tests failed or not run:** None failing. Not run: anything needing live Supabase / Google / AI credentials, audible audio, screen readers (see blockers).
- **Current blockers:** B1–B5 above.
- **Files changed:** Entire application (greenfield): `src/**`, `tests/**`, `scripts/**`, `supabase/migrations/**`, `public/sounds/**`, config files, `.github/workflows/**`, `README.md`, and `docs/{memory,Tracker,Architecture,Design}.md`.
- **Latest commit:** `78d0df6` (pushed to `origin/claude/jolly-planck-yml8nu`; base `2577531`).
- **Documentation updated:** README, `memory.md`, `Tracker.md`, `Architecture.md` §12, `Design.md` §16. `PRD.md` unchanged (no requirement changed). `Rules.md` unchanged.

Use actual repository evidence. Do not invent progress.

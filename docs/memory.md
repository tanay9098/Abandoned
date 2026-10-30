
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

- Repository location: Not yet recorded.
- Current branch: Not yet recorded.
- Base commit: Not yet recorded.
- Package manager: Not yet verified.
- Existing framework and dependencies: Not yet verified.
- Current test framework: Not yet verified.
- Deployment environment: Not yet verified.

### Implementation status

- [ ] Existing repository inspected.
- [ ] Project baseline documented.
- [ ] Core task management implemented.
- [ ] Database schema and migrations implemented.
- [ ] Deadline processing implemented.
- [ ] Google Calendar integration implemented.
- [ ] Ghost animations implemented.
- [ ] Sound design implemented.
- [ ] Midnight review implemented.
- [ ] Accessibility and preferences implemented.
- [ ] Tests passing.
- [ ] README and demo instructions complete.

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

---

## 6. Dependency Ledger

Track meaningful dependency changes.

| Date | Package | Version | Action | Reason | Alternatives | Related change |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |

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

---

## 8. Test Evidence

Maintain a short record of meaningful verification.

| Date | Command or test | Result | Related change | Notes |
|---|---|---|---|---|
| — | — | Not run | — | Initial baseline |

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
| — | — | No commits recorded yet | — | — |

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

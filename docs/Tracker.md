
# Abandonment — Implementation Tracker

**Purpose:** Track implementation progress, dependencies, verification, and outstanding work.

**Status:** Initial planning  
**Last updated:** YYYY-MM-DD

---

## 1. Status Definitions

- `NOT STARTED` — Work has not begun.
- `IN PROGRESS` — Work is actively being implemented.
- `BLOCKED` — Work cannot proceed because of a documented dependency or issue.
- `IN REVIEW` — Implementation is ready for review but not yet accepted.
- `DONE` — Implementation and required verification are complete.
- `DEFERRED` — Intentionally postponed with a recorded reason.

Never mark work `DONE` merely because files were created.

---

## 2. Phase 0 — Repository Inspection

- [ ] Inspect the existing repository structure.
- [ ] Read existing project documentation.
- [ ] Inspect `package.json` and lockfile.
- [ ] Identify the package manager.
- [ ] Identify existing UI and styling conventions.
- [ ] Identify existing APIs and integration contracts.
- [ ] Identify database and authentication setup.
- [ ] Inspect existing tests and scripts.
- [ ] Inspect Git branch, status, and recent history.
- [ ] Record baseline findings in `memory.md`.
- [ ] Reconcile this tracker with the actual repository.

**Exit criteria:** The implementation plan reflects the existing repository rather than assumptions.

---

## 3. Phase 1 — Application Foundation

- [ ] Establish or verify the Next.js application.
- [ ] Verify TypeScript configuration.
- [ ] Establish design tokens.
- [ ] Configure the shared application layout.
- [ ] Implement responsive navigation.
- [ ] Configure accessible component primitives.
- [ ] Establish environment variable validation.
- [ ] Verify lint, type-check, test, and build scripts.
- [ ] Write baseline tests.
- [ ] Update documentation.

**Exit criteria:** The application starts successfully and the foundation passes relevant checks.

---

## 4. Phase 2 — Native Task Management

- [ ] Design and migrate the task schema.
- [ ] Implement task creation.
- [ ] Implement task listing and filtering.
- [ ] Implement task editing.
- [ ] Implement task completion.
- [ ] Implement task rescheduling.
- [ ] Implement task release.
- [ ] Implement task deletion or archival.
- [ ] Implement server-side validation.
- [ ] Implement ownership and authorization checks.
- [ ] Add relevant database indexes.
- [ ] Test tasks without deadlines.
- [ ] Test exact deadline boundaries.
- [ ] Test concurrent task updates.
- [ ] Verify API compatibility.
- [ ] Update `memory.md` and `Architecture.md`.

**Exit criteria:** Native tasks work reliably without Calendar or AI integrations.

---

## 5. Phase 3 — Deadline Engine

- [ ] Implement deterministic overdue calculation.
- [ ] Implement the background processing mechanism.
- [ ] Secure scheduled-job execution.
- [ ] Implement stable haunting idempotency keys.
- [ ] Prevent duplicate ghost events.
- [ ] Recheck task state before recording a haunting.
- [ ] Handle completed and released tasks correctly.
- [ ] Handle tasks without deadlines.
- [ ] Handle time-zone changes.
- [ ] Handle daylight-saving transitions.
- [ ] Implement application-open reconciliation.
- [ ] Test retries and duplicate job execution.
- [ ] Test simultaneous task completion and deadline processing.

**Exit criteria:** Deadline behavior is correct and independent of the browser's open state.

---

## 6. Phase 4 — Google Calendar Integration

- [ ] Configure Google Cloud project.
- [ ] Enable Google Calendar API.
- [ ] Configure OAuth consent and redirect URLs.
- [ ] Select minimum necessary scopes.
- [ ] Implement OAuth initiation and callback.
- [ ] Validate OAuth state.
- [ ] Store credentials securely.
- [ ] Implement Calendar event retrieval.
- [ ] Normalize event dates and identifiers.
- [ ] Handle recurring and all-day events.
- [ ] Handle cancelled events and revoked access.
- [ ] Prevent duplicate synchronized events.
- [ ] Display events alongside native tasks.
- [ ] Link events to their original Calendar pages.
- [ ] Implement past-event review.
- [ ] Implement explicit missed-event confirmation.
- [ ] Implement disconnect and credential cleanup.
- [ ] Test unauthorized access and token failures.

**Exit criteria:** Users can connect, view, review, and disconnect Calendar without unintended external changes.

---

## 7. Phase 5 — Ghost Experience

- [ ] Establish the ghost visual specification.
- [ ] Create or obtain a properly licensed original ghost asset.
- [ ] Implement the Rive runtime if required.
- [ ] Implement idle animation.
- [ ] Implement awakening animation.
- [ ] Implement confrontation animation.
- [ ] Implement rescheduled/dormant state.
- [ ] Implement completion and release animations.
- [ ] Implement ghost dialogue UI.
- [ ] Implement deterministic fallback dialogue.
- [ ] Implement overdue duration metadata.
- [ ] Implement haunting history.
- [ ] Connect ghost states to application events.
- [ ] Test behavior when animation assets fail to load.
- [ ] Verify reduced-motion behavior.

**Exit criteria:** Ghost behavior reflects actual task state and remains usable without animation.

---

## 8. Phase 6 — Sound Design

- [ ] Source licensed wind ambience.
- [ ] Source licensed ghost whoosh.
- [ ] Source licensed midnight chimes.
- [ ] Source licensed optional whisper.
- [ ] Source licensed completion chime.
- [ ] Record asset sources and license requirements.
- [ ] Implement centralized audio playback.
- [ ] Implement global sound toggle.
- [ ] Implement volume control.
- [ ] Implement ambient audio control.
- [ ] Prevent duplicate or overlapping playback.
- [ ] Implement quiet-hour behavior where applicable.
- [ ] Verify browser audio restrictions.
- [ ] Test behavior with sound disabled.

**Exit criteria:** Sound reinforces application events without interfering with normal use.

---

## 9. Phase 7 — Midnight Review

- [ ] Implement local-date calculation.
- [ ] Implement user-specific midnight boundaries.
- [ ] Implement daily review generation.
- [ ] Prevent duplicate daily reviews.
- [ ] Include eligible overdue tasks.
- [ ] Include relevant Calendar events awaiting review.
- [ ] Implement midnight summary UI.
- [ ] Implement review actions.
- [ ] Respect sound and motion preferences.
- [ ] Test users who are offline at midnight.
- [ ] Test retries and time-zone changes.
- [ ] Test daylight-saving boundaries.

**Exit criteria:** Midnight review is accurate, idempotent, skippable, and independent of an open browser tab.

---

## 10. Phase 8 — AI Dialogue (Optional MVP Feature)

- [ ] Select the AI provider or local model.
- [ ] Document the reason for the choice.
- [ ] Define the minimum input context.
- [ ] Implement the dialogue service.
- [ ] Validate output length and format.
- [ ] Handle unavailable providers and timeouts.
- [ ] Add deterministic fallback dialogue.
- [ ] Avoid exposing private information unnecessarily.
- [ ] Treat external event descriptions as untrusted data.
- [ ] Test malformed and unsafe outputs.
- [ ] Confirm core functionality works without AI.

**Exit criteria:** AI enhances ghost personality without controlling deadlines or blocking core workflows.

---

## 11. Phase 9 — Accessibility and Reliability

- [ ] Verify keyboard navigation.
- [ ] Verify focus management.
- [ ] Verify color contrast.
- [ ] Verify reduced-motion support.
- [ ] Verify screen-reader labels.
- [ ] Verify mobile layouts.
- [ ] Verify loading and error states.
- [ ] Verify disconnected Calendar behavior.
- [ ] Verify database authorization policies.
- [ ] Verify scheduler authentication.
- [ ] Verify secret handling.
- [ ] Verify task and haunting history integrity.

**Exit criteria:** The application remains usable, secure, and understandable when optional features fail or are disabled.

---

## 12. Phase 10 — Submission Readiness

- [ ] Run the full test suite.
- [ ] Run type checking.
- [ ] Run linting.
- [ ] Run the production build.
- [ ] Resolve or document known failures.
- [ ] Verify a clean setup from documented instructions.
- [ ] Update README.
- [ ] Update architecture and design documentation.
- [ ] Prepare demo data.
- [ ] Record a complete user journey.
- [ ] Verify no secrets are committed.
- [ ] Verify asset licenses and attribution.
- [ ] Review Git history.
- [ ] Verify the project meets the challenge requirements.
- [ ] Prepare the submission write-up.

**Exit criteria:** The app can be demonstrated reliably and another developer can reproduce the setup.

---

## 13. Current Sprint

### Sprint goal

Build the smallest complete and testable Abandonment experience.

### Sprint tasks

- [ ] Inspect the repository.
- [ ] Establish the task data model.
- [ ] Build the task dashboard.
- [ ] Implement deterministic deadline processing.
- [ ] Implement the first ghost awakening.
- [ ] Add a minimal sound sequence.
- [ ] Connect Google Calendar.
- [ ] Implement midnight review.
- [ ] Verify the end-to-end demo.

### Blockers

Record each blocker with:
- Description.
- Affected phase.
- Impact.
- Required decision or dependency.
- Resolution status.

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

Update this section after every implementation session.

- **Current phase:**
- **Last completed task:**
- **Current task:**
- **Next task:**
- **Tests passed:**
- **Tests failed or not run:**
- **Current blockers:**
- **Files changed:**
- **Latest commit:**
- **Documentation updated:**

Use actual repository evidence. Do not invent progress.

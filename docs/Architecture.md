
# Abandonment — Architecture

**Status:** Initial technical specification  
**Architecture style:** Modular monolith  
**Frontend/backend framework:** Next.js with TypeScript  
**Database:** PostgreSQL through Supabase  
**External integration:** Google Calendar API

---

## 1. Technology Stack

### Application

- Next.js App Router.
- React.
- TypeScript with strict type checking.
- Tailwind CSS.
- shadcn/ui for accessible interface primitives.
- Lucide React for interface icons.

### Animation and Sound

- Motion for React (`motion`) for interface transitions.
- Rive (`@rive-app/react-webgl2` or another compatible official React runtime) for interactive ghost characters.
- Howler.js (`howler`) for sound playback.
- CSS animations and SVG filters for lightweight environmental effects.

Select one compatible Rive runtime after confirming the chosen asset and rendering requirements. Do not install multiple Rive runtimes.

### Backend and Persistence

- Next.js Route Handlers for HTTP APIs.
- Supabase PostgreSQL for persistent data.
- Supabase Auth or another explicitly selected authentication mechanism.
- Supabase Row Level Security (RLS) for user-data isolation.
- A server-side scheduled worker or managed scheduler for deadline processing.

### Google Calendar

- Google OAuth 2.0.
- Google Calendar API.
- Official Google API client libraries where needed.
- Read-only Calendar scope for the initial MVP, such as `calendar.readonly`, where appropriate for the selected API operations.

### Testing

- Vitest for unit tests, if no existing test framework is established.
- React Testing Library for component tests.
- Playwright for essential end-to-end flows.
- Mock Google API responses in automated tests.

### Deployment

- A Next.js-compatible hosting platform.
- Supabase-managed PostgreSQL.
- A scheduler or background worker that can run independently of browser sessions.

Choose deployment infrastructure only after checking the project's existing hosting setup.

---

## 2. Architecture Principles

1. Task status and deadlines are authoritative application data.
2. Overdue status is derived from task state and deadline.
3. AI must not determine whether a task is overdue.
4. Ghost animations respond to application events.
5. Sound effects respond to the same event system.
6. Google Calendar data is handled separately from native tasks.
7. External integrations must not silently modify user data.
8. Deadline jobs must be idempotent.
9. Every user-owned record must be isolated by authorization and database policy.
10. The app must remain usable when Google Calendar, AI, sound, or animation features are unavailable.
11. All date calculations must respect the user's configured time zone.
12. Existing repository conventions and APIs take precedence over speculative restructuring.

---

## 3. System Architecture

```text
Browser
  |
  v
Next.js App Router
  |
  +-- UI Components
  |     +-- Task List
  |     +-- Calendar View
  |     +-- Ghost Character
  |     +-- Haunted Dashboard
  |     +-- Sound Manager
  |
  +-- Application Services
  |     +-- Task Service
  |     +-- Deadline Service
  |     +-- Ghost Event Service
  |     +-- Calendar Service
  |     +-- Preference Service
  |
  +-- Route Handlers
  |     +-- /api/tasks
  |     +-- /api/calendar
  |     +-- /api/hauntings
  |     +-- /api/preferences
  |
  v
Supabase PostgreSQL
  |
  +-- Tasks
  +-- User Preferences
  +-- Calendar Connections
  +-- Ghost Events
  +-- Daily Reviews
  +-- Processing State

Background Scheduler / Worker
  |
  +-- Find newly overdue tasks
  +-- Create deduplicated haunting events
  +-- Generate midnight reviews
  +-- Queue eligible notifications

Google Calendar API
  |
  +-- OAuth-authorized event retrieval
  +-- Calendar synchronization
```

AI dialogue generation is an optional service connected to the Ghost Event Service. It must not be a dependency of the deadline engine.

---

## 4. Suggested Folder Structure

Adapt this structure to the existing repository instead of replacing existing directories blindly.

```text
abandonment/
├── docs/
│   ├── PRD.md
│   ├── Architecture.md
│   ├── Design.md
│   ├── memory.md
│   ├── Rules.md
│   └── Tracker.md
├── public/
│   ├── images/
│   ├── sounds/
│   └── rive/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── callback/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── tasks/
│   │   │   ├── calendar/
│   │   │   ├── graveyard/
│   │   │   └── settings/
│   │   ├── api/
│   │   │   ├── tasks/
│   │   │   ├── calendar/
│   │   │   ├── hauntings/
│   │   │   ├── preferences/
│   │   │   └── jobs/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── task/
│   │   ├── calendar/
│   │   ├── ghost/
│   │   ├── audio/
│   │   └── effects/
│   ├── features/
│   │   ├── tasks/
│   │   ├── calendar/
│   │   ├── hauntings/
│   │   ├── midnight-review/
│   │   └── preferences/
│   ├── lib/
│   │   ├── auth/
│   │   ├── database/
│   │   ├── datetime/
│   │   ├── validation/
│   │   ├── logging/
│   │   └── env.ts
│   ├── server/
│   │   ├── services/
│   │   │   ├── task.service.ts
│   │   │   ├── deadline.service.ts
│   │   │   ├── calendar.service.ts
│   │   │   ├── haunting.service.ts
│   │   │   └── midnight-review.service.ts
│   │   ├── repositories/
│   │   ├── integrations/
│   │   │   └── google-calendar/
│   │   ├── jobs/
│   │   └── ai/
│   └── types/
├── supabase/
│   └── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── package.json
├── README.md
└── ...
```

Only create files and folders as implementation requires. Do not generate empty files simply to match the diagram.

---

## 5. Database Design

Use PostgreSQL as the source of truth.

### 5.1 `profiles`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Matches the authenticated user's ID |
| `timezone` | TEXT | IANA time zone |
| `created_at` | TIMESTAMPTZ | Creation time |
| `updated_at` | TIMESTAMPTZ | Last update |

Example timezone: `Asia/Kolkata`.

### 5.2 `tasks`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Task identifier |
| `user_id` | UUID FK | Owner |
| `title` | TEXT | Task title |
| `description` | TEXT nullable | Optional description |
| `status` | TEXT | `pending`, `completed`, `released` |
| `due_at` | TIMESTAMPTZ nullable | Exact deadline instant |
| `due_timezone` | TEXT nullable | Time zone used when setting the deadline |
| `source_type` | TEXT | `native` or `calendar` |
| `source_ref` | TEXT nullable | External source identifier |
| `completed_at` | TIMESTAMPTZ nullable | Completion time |
| `released_at` | TIMESTAMPTZ nullable | Release time |
| `created_at` | TIMESTAMPTZ | Creation time |
| `updated_at` | TIMESTAMPTZ | Last update |

Rules:

- A task without `due_at` is not overdue.
- A task is overdue when `status = 'pending'`, `due_at IS NOT NULL`, and `due_at <= current instant`.
- Do not store an independent overdue boolean.
- Validate source identifiers and ownership.
- Do not treat imported Calendar events as editable native tasks unless explicitly modeled as a separate task.

### 5.3 `calendar_connections`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Connection ID |
| `user_id` | UUID FK | Owner |
| `provider` | TEXT | `google` |
| `provider_account_id` | TEXT nullable | Provider identity |
| `encrypted_tokens` | BYTEA/TEXT nullable | Encrypted credentials, if stored |
| `scopes` | TEXT[] | Granted scopes |
| `sync_cursor` | TEXT nullable | Sync state |
| `connected_at` | TIMESTAMPTZ | Connection time |
| `last_synced_at` | TIMESTAMPTZ nullable | Last successful sync |
| `revoked_at` | TIMESTAMPTZ nullable | Disconnection time |

Security requirements:

- Never expose OAuth refresh tokens to the browser.
- Encrypt persisted tokens using a managed secret or encryption key.
- Never store client secrets in public environment variables.
- Prefer provider-supported revocation and secure deletion of credentials on disconnect.

If the chosen authentication architecture handles provider tokens securely, avoid creating a second token store unnecessarily.

### 5.4 `calendar_events`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Local event ID |
| `user_id` | UUID FK | Owner |
| `connection_id` | UUID FK | Calendar connection |
| `provider_event_id` | TEXT | Google event ID |
| `title` | TEXT | Event title |
| `starts_at` | TIMESTAMPTZ | Start |
| `ends_at` | TIMESTAMPTZ | End |
| `status` | TEXT | `upcoming`, `past_pending_review`, `confirmed_missed`, `cancelled` |
| `html_link` | TEXT nullable | Link to source event |
| `last_synced_at` | TIMESTAMPTZ | Last sync |

Add a unique constraint on `(connection_id, provider_event_id)`.

Handle recurring events, cancelled events, all-day events, and changes from Google Calendar explicitly. Use the provider's identifiers rather than assuming titles are unique.

### 5.5 `ghost_events`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Event ID |
| `user_id` | UUID FK | Owner |
| `task_id` | UUID nullable FK | Related task |
| `calendar_event_id` | UUID nullable FK | Related event |
| `event_type` | TEXT | `deadline_missed`, `midnight_review`, `event_review`, `task_completed`, `task_released` |
| `dedupe_key` | TEXT | Stable idempotency key |
| `occurred_at` | TIMESTAMPTZ | Trigger time |
| `payload` | JSONB | Minimal contextual event data |
| `created_at` | TIMESTAMPTZ | Record creation |

Add a unique constraint on `dedupe_key`, scoped appropriately to the user if the key is not globally unique.

Ghost events are historical records. They must not be deleted simply because a task is rescheduled.

### 5.6 `daily_reviews`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Review ID |
| `user_id` | UUID FK | Owner |
| `local_date` | DATE | Review date in the user's time zone |
| `timezone` | TEXT | Time zone at review creation |
| `summary` | JSONB | Counts and task/event references |
| `created_at` | TIMESTAMPTZ | Creation time |

Add a unique constraint on `(user_id, local_date)`.

### 5.7 `user_preferences`

| Column | Type | Description |
|---|---|---|
| `user_id` | UUID PK/FK | Owner |
| `sound_enabled` | BOOLEAN | Global audio preference |
| `sound_volume` | REAL | Normalized volume, 0–1 |
| `ambient_enabled` | BOOLEAN | Ambient audio |
| `reduced_motion` | BOOLEAN | Motion preference |
| `quiet_hours_start` | TIME nullable | Quiet-hour start |
| `quiet_hours_end` | TIME nullable | Quiet-hour end |
| `updated_at` | TIMESTAMPTZ | Last update |

Validate all preferences server-side.

### Indexes

Create indexes based on actual query patterns:

- `tasks(user_id, due_at)` for active deadline queries.
- `tasks(user_id, status, created_at)` for task lists.
- `calendar_events(user_id, starts_at)` for event retrieval.
- `ghost_events(user_id, occurred_at DESC)` for history.
- `ghost_events(dedupe_key)` unique.
- `daily_reviews(user_id, local_date)` unique.

### Row Level Security

Enable RLS for all user-owned tables.

Policies must ensure:

- A user can access only their own records.
- Related task, event, and ghost-event ownership remains consistent.
- Browser clients cannot assign another user's ID to a record.
- Privileged service credentials are used only on the server.

Use migrations for schema changes. Never make undocumented production schema changes.

---

## 6. API Design

Follow existing API conventions if the repository already defines them.

### Tasks

`GET /api/tasks`

- Returns the authenticated user's tasks.
- Supports filters for status and date range.
- Never returns another user's records.

`POST /api/tasks`

Request:

```json
{
  "title": "Finish portfolio",
  "description": "Complete the project section",
  "dueAt": "2026-11-02T18:00:00+05:30",
  "dueTimezone": "Asia/Kolkata"
}
```

Creates a native task with `pending` status.

`GET /api/tasks/:id`

Returns one authorized task.

`PATCH /api/tasks/:id`

Updates editable fields, status, or deadline.

`DELETE /api/tasks/:id`

Deletes a task only after ownership validation. If history preservation is required, use an explicit archival approach rather than silently deleting historical records.

### Calendar

`GET /api/calendar/events?from=...&to=...`

Returns events for the authenticated user within a validated date range.

`POST /api/calendar/connect`

Initiates OAuth or starts the established provider connection flow.

`GET /api/calendar/callback`

Validates the OAuth state and exchanges the authorization code securely.

`POST /api/calendar/sync`

Starts or requests an authorized synchronization.

`POST /api/calendar/events/:id/review`

Accepts an explicit user decision, such as `confirmed_missed` or `not_missed`.

`DELETE /api/calendar/connection`

Disconnects the provider and securely removes or revokes credentials according to the implementation.

### Hauntings

`GET /api/hauntings`

Returns recent ghost events for the authenticated user.

`POST /api/hauntings/:id/acknowledge`

Records that the user viewed or acknowledged a haunting, if that interaction is implemented.

`GET /api/hauntings/midnight-review`

Returns the relevant daily review. It should not create duplicate reviews as a side effect of repeated reads.

### Preferences

`GET /api/preferences`

Returns the user's preferences.

`PATCH /api/preferences`

Validates and saves sound, animation, time-zone, and quiet-hour settings.

### Scheduled jobs

`POST /api/jobs/process-deadlines`

Protected internal endpoint or worker entry point. Processes newly overdue tasks and inserts deduplicated ghost events.

`POST /api/jobs/midnight-review`

Creates daily reviews for eligible users and local dates. Must be idempotent and protected against unauthorized requests.

Never expose scheduler secrets in client bundles.

---

## 7. API and Processing Flows

### 7.1 Create a task

1. Client validates the title and deadline format.
2. Server authenticates the user.
3. Server validates all inputs.
4. Server creates the task.
5. Server returns the canonical task.
6. UI updates its local view.
7. Animation effects run only after the corresponding UI state change.

### 7.2 Deadline passes

1. A scheduled worker queries pending tasks whose deadlines have passed.
2. The worker checks task ownership and state.
3. The worker creates a `deadline_missed` ghost event using a stable dedupe key.
4. A unique database constraint prevents duplicates.
5. The UI retrieves the event and displays the ghost.
6. Optional AI dialogue is generated or retrieved.
7. A fallback message is used if AI is unavailable.

The worker must recheck task state immediately before creating the event. A task completed concurrently must not generate a new overdue event.

### 7.3 Midnight review

1. Determine the current local date for each user.
2. Determine the relevant midnight boundary in that user's IANA time zone.
3. Query tasks overdue by that boundary.
4. Query eligible unresolved Calendar events.
5. Insert a daily review with a unique `(user_id, local_date)` key.
6. Insert any required ghost events with stable dedupe keys.
7. Present the review when the user next opens the application.
8. Respect quiet hours and notification preferences.

The process must handle retries, daylight-saving transitions, timezone changes, and users who do not open the app at midnight.

### 7.4 Google Calendar synchronization

1. User begins OAuth authorization.
2. Server validates OAuth state and requested scopes.
3. Server securely handles the authorization response.
4. Server fetches relevant events.
5. Events are normalized into the application's internal representation.
6. Provider event IDs prevent duplicates.
7. The synchronization cursor or time window is updated.
8. UI shows the synchronized events.
9. Ended events enter review where appropriate; they are not automatically marked missed.

### 7.5 Resolve a haunted task

1. User selects complete, reschedule, or release.
2. Server verifies ownership and current state.
3. Server validates the requested transition.
4. Database is updated.
5. Relevant history is recorded.
6. UI responds with the appropriate animation and optional sound.
7. Future deadline processing reflects the new task state.

---

## 8. Date and Time Rules

- Store actual instants in PostgreSQL as `TIMESTAMPTZ`.
- Store user time zones as IANA identifiers.
- Do not use browser-local date strings as authoritative server timestamps.
- For date-only tasks, define the deadline boundary in the selected time zone explicitly.
- Handle all-day Calendar events separately from timed events.
- Test daylight-saving transitions even if the primary demo uses `Asia/Kolkata`.
- Recompute future midnight boundaries using the current configured time zone.
- Changing a time zone must not silently rewrite historical event timestamps.

---

## 9. Security and Reliability

- Validate every API input.
- Authenticate every user-owned operation.
- Enforce ownership in database queries and RLS.
- Protect OAuth state and callback validation.
- Keep secrets on the server.
- Never log access tokens or sensitive task content.
- Rate-limit expensive AI endpoints.
- Restrict and authenticate scheduled-job endpoints.
- Avoid accepting arbitrary external URLs from users for server-side fetching.
- Use stable idempotency keys for retryable jobs.
- Handle API errors without corrupting task state.
- Use structured logs with request and job identifiers.
- Keep the core app usable when integrations are unavailable.

---

## 10. Testing Strategy

### Unit tests

- Deadline boundary conditions.
- Task state transitions.
- Time-zone conversion.
- Midnight calculations.
- Idempotency-key generation.
- Ghost event eligibility.
- Sound preference behavior.
- AI fallback messages.

### Integration tests

- Task persistence.
- RLS and ownership checks.
- Calendar event normalization.
- Duplicate synchronization.
- Deadline-worker retries.
- Midnight-review uniqueness.
- Concurrent completion and deadline processing.

### End-to-end tests

- Create and complete a task.
- Create a task and simulate a passed deadline.
- Trigger and resolve a haunting.
- Connect a mocked Calendar account.
- Display a past event awaiting review.
- Open the midnight review.
- Disable sound and enable reduced motion.
- Verify behavior when AI or Calendar access fails.

---

## 11. Architecture Decision Records

Record major changes in `docs/memory.md`.

Each record should contain:

- Decision ID.
- Date.
- Context.
- Decision.
- Alternatives considered.
- Rationale.
- Consequences.
- Files affected.
- Tests performed.
- Related commit hash, when available.

Do not treat this document as a substitute for actual migrations, tests, or commit history.

---

## 12. As-Built Notes (2026-10-30)

This section records where the implementation refines or extends the sections above. Sections 1–11 remain the specification; where they differ, this section describes what exists.

### 12.1 Authentication and database access

* **Auth:** signed `httpOnly` session cookie → `profiles` row (ADR-011). Only `server/auth/session.ts` and `server/http.ts` know about it. The browser never supplies a user id.
* **DB:** hand-written SQL repositories over `Db`/`SqlExecutor`; `pg` for `DATABASE_URL` (Supabase/PostgreSQL), PGlite otherwise (ADR-012). The server connects with a privileged role and scopes every query by `user_id`; RLS (`auth.uid()`) is defence in depth for direct client access. `auth.uid()` is shimmed from `request.jwt.claim.sub` on non-Supabase Postgres.
* **Migrations:** `supabase/migrations/NNNN_*.sql`, applied in order by `server/db/migrate.ts` (`schema_migrations`). `npm run db:migrate` for hosted DBs; PGlite self-migrates.

### 12.2 Schema deltas relative to §5 (all additive)

| Table | Addition | Why |
|---|---|---|
| `tasks` | `recurrence` (`daily|weekly|monthly`), `version` (int) | Simple recurrence (P1 subset); optimistic concurrency |
| `tasks` | CHECK: timestamps must agree with `status`; CHECK: recurrence needs a deadline | Make inconsistent states unrepresentable |
| `user_preferences` | `midnight_presentation` (`ritual|banner|off`), `ai_dialogue_enabled` | Design §12 “midnight review presentation”; AI opt-in/disclosure |
| `calendar_connections` | `is_demo`; partial unique index `(user_id, provider) WHERE revoked_at IS NULL` | Label the demo provider; one active connection |
| `calendar_events` | `all_day`, `reviewed_at`; status value `not_missed` | All-day handling; explicit “I was there” decision |
| `ghost_events` | `acknowledged_at`; type `task_rescheduled`; unique `(user_id, dedupe_key)` | Acknowledge endpoint; reschedule history; scoped uniqueness |
| `daily_reviews` | `presented_at`, `dismissed_at` | Present once, skippable, replayable |

`calendar_connections` has **no** RLS policy for browser roles (default deny): it holds encrypted tokens. `ghost_events` has select/insert policies only (history is not editable through RLS-governed access); inserts must reference the caller’s own task/event rows.

### 12.3 Idempotency keys

| Event | Key |
|---|---|
| `deadline_missed` | `deadline_missed:<taskId>:<due_at epoch ms>` |
| `midnight_review` | `midnight_review:<userId>:<localDate>` |
| `task_completed` / `task_released` | `task_*:<taskId>:<timestamp ms>` |
| `task_rescheduled` | `task_rescheduled:<taskId>:v<version>` |
| `event_review` | `event_review:<calendarEventId>:<decision timestamp ms>` (a user may change their answer; each decision is history) |

`deadline_missed.occurred_at` is the **deadline instant** (when the task became overdue); `created_at` is detection time. The payload carries a title snapshot so history stays readable after the task is deleted.

### 12.4 API additions (see `memory.md` §7 for the ledger)

`POST /api/auth/guest|logout` · `POST /api/hauntings/reconcile` · `POST /api/hauntings/:id/dialogue` · `POST /api/hauntings/midnight-review` (`{reviewId, action: seen|dismiss}`) · `GET /api/calendar/connection`. Job routes also accept `GET`. Task writes accept `dueDate` + `dueTime` (+ `dueTimezone`) as zone-aware wall-clock input in addition to `dueAt`; `PATCH` accepts `expectedVersion` and responds `{task, nextTask}`. Error shape: `{error:{code,message,details?,requestId}}`.

### 12.5 Processing refinements

* **Deadline engine:** candidate select → per-task transaction → `SELECT … FOR UPDATE` → recheck status + `due_at` equality + overdue → `INSERT … ON CONFLICT DO NOTHING`. Entry points: scheduler and per-user reconcile.
* **Midnight review:** `reviewTargetFor(now, tz)` yields `(localDate, boundary, previousBoundary)`. Population = pending tasks with `due_at <= boundary` + calendar events that ended by the boundary and are undecided and non-cancelled. Reads never create reviews (`GET` is side-effect free).
* **Calendar sync:** ±30-day window, `singleEvents=true` (recurring events arrive as instances with distinct ids), `showDeleted=true`, `fields` mask excludes description/attendees; one transaction per sync; decisions preserved across re-sync unless Google cancels. Derived statuses (`upcoming`/`past_pending_review`) are recomputed on read.
* **Dialogue:** deterministic fallback is canonical; AI text, when valid, is cached once on the event payload.

### 12.6 Folder structure actually used

`src/app` (routes + `api`) · `src/components/{ui,layout,task,calendar,ghost,audio,midnight,workspace}` · `src/features/{tasks,hauntings,midnight-review,calendar,preferences}` (pure domain logic, no IO) · `src/lib/{datetime,client,logging}` · `src/server/{db,repositories,services,integrations/google-calendar,ai,auth}` · `supabase/migrations` · `tests/{unit,integration,e2e}` · `scripts`. No `src/types` folder was needed.

### 12.7 Test-only seam

`X-Test-Now` overrides the server clock only when `ABANDONMENT_ALLOW_TEST_CLOCK=1` and `VERCEL_ENV!=production` (`server/clock.ts`; unit-tested). It exists so end-to-end tests can simulate a passed deadline without waiting. It must never be enabled in a real deployment.


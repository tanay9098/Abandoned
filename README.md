# Abandonment

> **Your unfinished business has come back to haunt you.**

Abandonment is a real task manager (deadlines, filters, Google Calendar, a midnight review) with a ghost on top.
When a deadline passes with the task unfinished, a server-side engine records **one** haunting and a ghost wakes with
a short, humane monologue. You can **complete**, **reschedule**, or consciously **release** the commitment — nothing
is lost and nothing is shamed. Built for the DEV Hacktoberfest *Ghost in the Machine* challenge.

The haunting is a presentation layer over a deterministic system: overdue-ness is **derived** from
`status + due_at + now`, never from AI, never from an animation, and never from a browser timer.

## Quick start (zero configuration)

```bash
npm install
npm run dev          # http://localhost:3000
```

Click **Open the archive → Enter the archive**. With no environment variables the app uses a self-migrating local
**PGlite** database (real Postgres compiled to WASM, stored in `.data/pglite`) and a clearly-labelled **demo calendar**.
Leave *“Start with sample case files”* ticked to meet a ghost immediately and see the midnight review.

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js (App Router, Turbopack) |
| `npm run lint` · `npm run typecheck` | ESLint · `tsc --noEmit` (strict) |
| `npm test` | Vitest: unit + integration (integration runs the real SQL on PGlite) |
| `npm run test:e2e` | Playwright journey tests (builds and serves the app on :3100) |
| `npm run db:migrate` | Apply `supabase/migrations/*.sql` to `DATABASE_URL` |
| `npm run sounds:generate` | Re-synthesise the sound assets (deterministic) |

Playwright uses its own browser download; in restricted sandboxes set `PW_CHROMIUM_PATH` to a Chromium binary.

## Production setup

1. **Database (Supabase / any PostgreSQL):** set `DATABASE_URL`, then `npm run db:migrate`.
2. **Secrets:** `SESSION_SECRET` (≥ 32 chars) and `CRON_SECRET` (≥ 16 chars) are *required* in production — the app refuses to boot without them. See `.env.example`.
3. **Scheduler** (deadlines + midnight review while every browser is closed): call
   `POST /api/jobs/process-deadlines` and `POST /api/jobs/midnight-review` with `Authorization: Bearer $CRON_SECRET` every
   1–5 minutes. Ready-made options: `.github/workflows/scheduler.yml` (set repo secrets `APP_URL`, `CRON_SECRET` and variable
   `SCHEDULER_ENABLED=true`), Vercel Cron (it issues `GET`, which is supported with the same bearer check), Supabase `pg_cron`
   + `pg_net`, or Cloud Scheduler. Both jobs are idempotent: late, repeated or overlapping runs never duplicate anything.
4. **Hosting:** any Node host for Next.js 16 (Node ≥ 22.18). A ready-made Render Blueprint is included — see *Deploying on Render*.

### Google Calendar (read-only)

1. Google Cloud Console → enable **Google Calendar API** → OAuth consent screen → create an **OAuth client (Web)**.
2. Authorised redirect URI: `https://<your-host>/api/calendar/callback` (and `http://localhost:3000/api/calendar/callback` for dev).
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and `TOKEN_ENCRYPTION_KEY`
   (`openssl rand -base64 32`).

**Permissions requested:** one scope, `https://www.googleapis.com/auth/calendar.events.readonly` — the narrowest scope that can list
events. Abandonment *cannot* create, edit or delete Calendar data. Tokens are AES-256-GCM encrypted at rest and never reach the
browser; OAuth uses a signed single-use state cookie **and PKCE**. Disconnecting revokes the grant at Google, wipes stored credentials
and deletes imported event copies (your tasks and haunting history stay). Event descriptions and attendees are never requested or stored.

Without credentials the Calendar page offers a **demo calendar** (sample events, labelled everywhere as such). In production,
the demo provider is off unless `GOOGLE_CALENDAR_MOCK=1`.

### Optional AI ghost dialogue (open-weight Gemma)

Off by default (except demo archives) and never required. The ghost's lines can be written by Google's open-weight **Gemma** model through any
**OpenAI-compatible** Chat Completions endpoint, so the same code runs fully local or hosted:

| Where | `AI_BASE_URL` | `AI_MODEL` | `AI_API_KEY` |
|---|---|---|---|
| Local, [Ollama](https://ollama.com) (`ollama pull gemma3:4b`) | `http://localhost:11434/v1` | `gemma3:4b` | — |
| Google AI Studio | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemma-3-27b-it` | AI Studio key |
| Hugging Face Inference Providers | `https://router.huggingface.co/v1` | `google/gemma-3-27b-it` | HF token |

llama.cpp `llama-server` and vLLM work the same way. Archives started with *sample case files* have it switched on automatically (disclosed on the login page); everyone else turns it on in **Settings**. Local CPU inference is slower than the
default 4 s timeout, so set `AI_TIMEOUT_MS=15000` there. Gemma has no system role, so the instructions travel in the single user turn,
with the title fenced in `<task_title>` tags as untrusted data. Only the task *title* and a coarse overdue duration are sent —
never descriptions or Calendar content. Output is length/tone-validated; any failure, timeout, rate-limit or unsafe reply falls back
to built-in lines.

### Deploying on Render

`render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec): **New → Blueprint →** this repo. It creates a free
Node web service and a free Render Postgres database (private network only), generates `SESSION_SECRET` and `CRON_SECRET`, runs
migrations on start, enables the labelled demo calendar, and points the ghost at Gemma on Google AI Studio — paste your key into
`AI_API_KEY` when prompted (or leave it empty for built-in lines). Free web services sleep when idle, and free Render Postgres
expires after 30 days. For the scheduler, enable `.github/workflows/scheduler.yml` with `APP_URL` set to the `onrender.com` URL, or
uncomment the Render cron job in `render.yaml` (paid plan).

## How it works

```
Browser ──► Next.js route handlers ──► services ──► repositories ──► PostgreSQL (Supabase | PGlite)
                 ▲                         │
 Scheduler ──────┘ (Bearer CRON_SECRET)    ├─ deadline.service      deterministic engine, idempotent
                                           ├─ haunting.service      derived ghost state + dialogue
                                           ├─ midnight-review.service
                                           ├─ calendar.service ─► Google Calendar (read-only) | demo provider
                                           └─ task.service / preferences.service
```

* **Deadline engine** — selects pending tasks with `due_at <= now`, **locks the row and re-checks status + deadline**, then
  `INSERT … ON CONFLICT DO NOTHING` on the unique `dedupe_key` (`deadline_missed:<task>:<due_at ms>`). Completed/released/
  rescheduled-in-flight tasks are skipped; retries and overlapping runners cannot duplicate. The same function runs from the
  scheduler and, scoped to the user, whenever the app opens.
* **Midnight review** — keyed `(user_id, local_date)` in the user's IANA zone (DST-safe). Summarises tasks already overdue at the
  local midnight boundary; never marks anything. Reads never create reviews. Presented once on next open; skippable (button/Esc);
  replayable from the Graveyard.
* **Time zones** — `lib/datetime/zone.ts` (Intl only). Nonexistent local times shift forward past a DST gap; ambiguous times take the
  first occurrence; a date-only deadline means *end of that local day*.
* **Events vs tasks** — Calendar events live in their own table. An ended event is **“awaiting your review”**, never “missed”,
  until you say so.
* **Ghost & sound** — one event bus: animation and sound react to the same application events after the real state change.
  Ghost = original inline SVG + Motion states (idle, awakening, observing, confrontation, rescheduled, released, completed) with a static
  fallback. Sound = Howler, lazy-loaded, off by default, global mute, volume, ambient opt-in, quiet hours, autoplay-safe.
* **Accessibility** — keyboard operable, visible focus, labelled controls, live-region announcements, reduced motion (OS **and** in-app,
  independent of sound), nothing conveyed by colour/sound/animation alone.

See `docs/` for the full specification (`PRD`, `Architecture`, `Design`, `Rules`), the decision log (`memory.md`) and `Tracker.md`.

## Security model

* Sessions are signed, `httpOnly`, `SameSite=Lax` cookies bound to a server-side profile; the browser never supplies a user id.
* Every query is scoped by `user_id`; a foreign id is simply *not found*. RLS policies (migration `0001`) add defence in depth for
  direct Supabase-client access (verified in tests); `calendar_connections` has no browser-facing policy at all.
* Cross-origin state-changing requests are rejected (Origin check); inputs are validated with Zod (`.strict()`); scheduler
  endpoints use a constant-time bearer comparison; logs carry ids and counts only.

## Known limitations

* **Auth is a guest-session mechanism** (signed cookie ⇒ private archive per browser; sign-out is irreversible). It is isolated behind
  `server/auth/session.ts`; swapping in Supabase Auth/OAuth login is a one-function change plus mapping `auth.uid()` to `profiles.id`.
* **Rive is not used.** No authored `.riv` asset exists, and the original SVG + Motion meets the art direction. The ghost takes an
  explicit `state` prop, so a Rive artboard can be dropped in later.
* Sounds are original, procedurally synthesised placeholders (CC0). They are functional but a sound designer could improve them.
* The AI rate limiter is in-memory (single instance). Push notifications, Gmail/Notion/GitHub integrations and advanced recurrence
  are P2 and not built; recurrence supports daily/weekly/monthly only. Subtasks are not implemented (FR-08 marks them conditional).
* The Supabase-hosted path (`pg` driver + `DATABASE_URL`) is exercised only through the identical SQL on PGlite; it has **not** been run
  against a live Supabase project in this repository's CI.
* GitHub Actions cron is best-effort timing; use a dedicated scheduler if minute-accuracy matters.
* The Google OAuth live path (token exchange/refresh/revoke) is tested against mocked HTTP only; no real Google account was used.

## Licence & assets

Ghost artwork and all sounds are original to this project (`public/sounds/manifest.json`, CC0-1.0). Fonts: Manrope, DM Mono,
Lora via Fontsource (SIL OFL).

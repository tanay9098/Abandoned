-- Abandonment — initial schema.
-- Works on Supabase PostgreSQL and on plain PostgreSQL / PGlite (demo + tests).
-- Authorization model: the server connects with a privileged role and always scopes queries
-- by user_id; RLS below is defence-in-depth for any direct (Supabase client) access.

-- auth.uid() shim: Supabase already provides auth.uid(); elsewhere read the JWT-subject GUC.
create schema if not exists auth;
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute $f$
      create function auth.uid() returns uuid language sql stable as
      $b$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $b$
    $f$;
  end if;
end $$;

-- ---------------------------------------------------------------- profiles
create table profiles (
  id          uuid primary key default gen_random_uuid(),
  timezone    text not null default 'UTC',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_timezone_len check (char_length(timezone) between 1 and 64)
);

-- ---------------------------------------------------------------- user_preferences
create table user_preferences (
  user_id               uuid primary key references profiles(id) on delete cascade,
  sound_enabled         boolean not null default false,
  sound_volume          real    not null default 0.6,
  ambient_enabled       boolean not null default false,
  reduced_motion        boolean not null default false,
  quiet_hours_start     time,
  quiet_hours_end       time,
  midnight_presentation text    not null default 'ritual',
  ai_dialogue_enabled   boolean not null default false,
  updated_at            timestamptz not null default now(),
  constraint prefs_volume_range check (sound_volume >= 0 and sound_volume <= 1),
  constraint prefs_presentation check (midnight_presentation in ('ritual', 'banner', 'off')),
  constraint prefs_quiet_pair check ((quiet_hours_start is null) = (quiet_hours_end is null))
);

-- ---------------------------------------------------------------- tasks
create table tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  title         text not null,
  description   text,
  status        text not null default 'pending',
  due_at        timestamptz,
  due_timezone  text,
  source_type   text not null default 'native',
  source_ref    text,
  recurrence    text,
  completed_at  timestamptz,
  released_at   timestamptz,
  version       integer not null default 1,   -- optimistic concurrency token
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint tasks_title_len check (char_length(title) between 1 and 200),
  constraint tasks_description_len check (description is null or char_length(description) <= 2000),
  constraint tasks_status check (status in ('pending', 'completed', 'released')),
  constraint tasks_source check (source_type in ('native', 'calendar')),
  constraint tasks_recurrence check (recurrence is null or recurrence in ('daily', 'weekly', 'monthly')),
  constraint tasks_recurrence_needs_due check (recurrence is null or due_at is not null),
  -- timestamps must agree with status (no independent overdue flag exists by design)
  constraint tasks_status_timestamps check (
    (status = 'pending'   and completed_at is null     and released_at is null) or
    (status = 'completed' and completed_at is not null and released_at is null) or
    (status = 'released'  and released_at  is not null and completed_at is null)
  )
);
create index tasks_user_due_idx        on tasks (user_id, due_at);
create index tasks_user_status_created on tasks (user_id, status, created_at);
-- deadline worker scans across users for pending, deadlined tasks
create index tasks_pending_due_idx     on tasks (due_at) where status = 'pending' and due_at is not null;

-- ---------------------------------------------------------------- calendar_connections
create table calendar_connections (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references profiles(id) on delete cascade,
  provider             text not null default 'google',
  provider_account_id  text,
  encrypted_tokens     text,              -- AES-256-GCM envelope; never returned to the browser
  scopes               text[] not null default '{}',
  sync_cursor          text,
  connected_at         timestamptz not null default now(),
  last_synced_at       timestamptz,
  revoked_at           timestamptz,
  is_demo              boolean not null default false,
  constraint calendar_provider check (provider in ('google'))
);
create unique index calendar_connections_one_active on calendar_connections (user_id, provider) where revoked_at is null;

-- ---------------------------------------------------------------- calendar_events
create table calendar_events (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id) on delete cascade,
  connection_id      uuid not null references calendar_connections(id) on delete cascade,
  provider_event_id  text not null,
  title              text not null,
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  all_day            boolean not null default false,
  status             text not null default 'upcoming',
  html_link          text,
  reviewed_at        timestamptz,
  last_synced_at     timestamptz not null default now(),
  constraint calendar_events_status check (status in ('upcoming', 'past_pending_review', 'confirmed_missed', 'not_missed', 'cancelled')),
  constraint calendar_events_range check (ends_at >= starts_at),
  constraint calendar_events_unique unique (connection_id, provider_event_id)
);
create index calendar_events_user_starts on calendar_events (user_id, starts_at);

-- ---------------------------------------------------------------- ghost_events (historical, append-only)
create table ghost_events (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id) on delete cascade,
  task_id            uuid references tasks(id) on delete set null,
  calendar_event_id  uuid references calendar_events(id) on delete set null,
  event_type         text not null,
  dedupe_key         text not null,
  occurred_at        timestamptz not null,
  acknowledged_at    timestamptz,
  payload            jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  constraint ghost_events_type check (event_type in
    ('deadline_missed', 'midnight_review', 'event_review', 'task_completed', 'task_released', 'task_rescheduled')),
  constraint ghost_events_dedupe unique (user_id, dedupe_key)
);
create index ghost_events_user_occurred on ghost_events (user_id, occurred_at desc);
create index ghost_events_task on ghost_events (task_id) where task_id is not null;

-- ---------------------------------------------------------------- daily_reviews
create table daily_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  local_date    date not null,
  timezone      text not null,
  summary       jsonb not null,
  presented_at  timestamptz,
  dismissed_at  timestamptz,
  created_at    timestamptz not null default now(),
  constraint daily_reviews_unique unique (user_id, local_date)
);

-- ---------------------------------------------------------------- Row Level Security
alter table profiles              enable row level security;
alter table user_preferences      enable row level security;
alter table tasks                 enable row level security;
alter table calendar_connections  enable row level security;
alter table calendar_events       enable row level security;
alter table ghost_events          enable row level security;
alter table daily_reviews         enable row level security;

create policy profiles_own     on profiles         for all using (id = auth.uid())      with check (id = auth.uid());
create policy prefs_own        on user_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tasks_own        on tasks            for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy daily_reviews_own on daily_reviews   for select using (user_id = auth.uid());

-- calendar_connections holds encrypted tokens: deliberately NO browser-facing policy
-- (default deny for non-privileged roles); only the server reads it.

create policy calendar_events_select on calendar_events for select using (user_id = auth.uid());

-- ghost events: readable by owner; inserts must reference only the owner's own rows.
create policy ghost_events_select on ghost_events for select using (user_id = auth.uid());
create policy ghost_events_insert on ghost_events for insert with check (
  user_id = auth.uid()
  and (task_id is null or exists (select 1 from tasks t where t.id = task_id and t.user_id = auth.uid()))
  and (calendar_event_id is null or exists (select 1 from calendar_events c where c.id = calendar_event_id and c.user_id = auth.uid()))
);
-- no update/delete policy on ghost_events: history is not editable through RLS-governed access

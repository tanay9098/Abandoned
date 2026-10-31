import type { SqlExecutor } from "../db/types";
import type { StoredEventStatus, NormalizedEvent } from "@/features/calendar/model";

export interface CalendarConnection {
  id: string;
  userId: string;
  provider: "google";
  providerAccountId: string | null;
  encryptedTokens: string | null;
  scopes: string[];
  syncCursor: string | null;
  connectedAt: Date;
  lastSyncedAt: Date | null;
  revokedAt: Date | null;
  isDemo: boolean;
}

interface ConnRow {
  id: string;
  user_id: string;
  provider: "google";
  provider_account_id: string | null;
  encrypted_tokens: string | null;
  scopes: string[];
  sync_cursor: string | null;
  connected_at: Date;
  last_synced_at: Date | null;
  revoked_at: Date | null;
  is_demo: boolean;
}
const toConn = (r: ConnRow): CalendarConnection => ({
  id: r.id,
  userId: r.user_id,
  provider: r.provider,
  providerAccountId: r.provider_account_id,
  encryptedTokens: r.encrypted_tokens,
  scopes: r.scopes ?? [],
  syncCursor: r.sync_cursor,
  connectedAt: r.connected_at,
  lastSyncedAt: r.last_synced_at,
  revokedAt: r.revoked_at,
  isDemo: r.is_demo,
});

export async function getActiveConnection(ex: SqlExecutor, userId: string): Promise<CalendarConnection | null> {
  const [row] = await ex.query<ConnRow>(
    "select * from calendar_connections where user_id=$1 and provider='google' and revoked_at is null",
    [userId],
  );
  return row ? toConn(row) : null;
}

export async function upsertConnection(
  ex: SqlExecutor,
  c: { userId: string; providerAccountId: string | null; encryptedTokens: string | null; scopes: string[]; isDemo: boolean },
  now: Date,
): Promise<CalendarConnection> {
  const existing = await getActiveConnection(ex, c.userId);
  if (existing) {
    const [row] = await ex.query<ConnRow>(
      `update calendar_connections set provider_account_id=$2, encrypted_tokens=$3, scopes=string_to_array($4, ' '), is_demo=$5, connected_at=$6
        where id=$1 returning *`,
      [existing.id, c.providerAccountId, c.encryptedTokens, c.scopes.join(" "), c.isDemo, now],
    );
    return toConn(row!);
  }
  const [row] = await ex.query<ConnRow>(
    `insert into calendar_connections (user_id, provider_account_id, encrypted_tokens, scopes, is_demo, connected_at)
     values ($1,$2,$3,string_to_array($4, ' '),$5,$6) returning *`,
    [c.userId, c.providerAccountId, c.encryptedTokens, c.scopes.join(" "), c.isDemo, now],
  );
  return toConn(row!);
}

export async function updateTokens(ex: SqlExecutor, id: string, encryptedTokens: string): Promise<void> {
  await ex.query("update calendar_connections set encrypted_tokens=$2 where id=$1", [id, encryptedTokens]);
}

export async function markSynced(ex: SqlExecutor, id: string, cursor: string, now: Date): Promise<void> {
  await ex.query("update calendar_connections set sync_cursor=$2, last_synced_at=$3 where id=$1", [id, cursor, now]);
}

/** Revoke: wipe credentials, keep an audit row, drop synchronised event copies. */
export async function revokeConnection(ex: SqlExecutor, id: string, now: Date): Promise<void> {
  await ex.query("update calendar_connections set revoked_at=$2, encrypted_tokens=null, sync_cursor=null where id=$1", [id, now]);
  await ex.query("delete from calendar_events where connection_id=$1", [id]);
}

export interface CalendarEvent {
  id: string;
  userId: string;
  connectionId: string;
  providerEventId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  status: StoredEventStatus;
  htmlLink: string | null;
  reviewedAt: Date | null;
  lastSyncedAt: Date;
}
interface EvRow {
  id: string;
  user_id: string;
  connection_id: string;
  provider_event_id: string;
  title: string;
  starts_at: Date;
  ends_at: Date;
  all_day: boolean;
  status: StoredEventStatus;
  html_link: string | null;
  reviewed_at: Date | null;
  last_synced_at: Date;
}
export const toEvent = (r: EvRow): CalendarEvent => ({
  id: r.id,
  userId: r.user_id,
  connectionId: r.connection_id,
  providerEventId: r.provider_event_id,
  title: r.title,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  allDay: r.all_day,
  status: r.status,
  htmlLink: r.html_link,
  reviewedAt: r.reviewed_at,
  lastSyncedAt: r.last_synced_at,
});

/**
 * Upsert keyed by (connection_id, provider_event_id): re-syncing never duplicates.
 * An explicit user decision survives re-sync unless Google reports the event cancelled.
 */
export async function upsertEvent(
  ex: SqlExecutor,
  userId: string,
  connectionId: string,
  e: NormalizedEvent,
  now: Date,
): Promise<"inserted" | "updated" | "skipped"> {
  if (e.cancelled) {
    const rows = await ex.query(
      "update calendar_events set status='cancelled', last_synced_at=$3 where connection_id=$1 and provider_event_id=$2 returning id",
      [connectionId, e.providerEventId, now],
    );
    return rows.length ? "updated" : "skipped";
  }
  if (!e.startsAt || !e.endsAt) return "skipped";
  const initial: StoredEventStatus = e.endsAt.getTime() <= now.getTime() ? "past_pending_review" : "upcoming";
  const rows = await ex.query<{ inserted: boolean }>(
    `insert into calendar_events (user_id, connection_id, provider_event_id, title, starts_at, ends_at, all_day, status, html_link, last_synced_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (connection_id, provider_event_id) do update set
        title = excluded.title, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
        all_day = excluded.all_day, html_link = excluded.html_link, last_synced_at = excluded.last_synced_at,
        status = case
          when calendar_events.status in ('confirmed_missed', 'not_missed') then calendar_events.status
          else excluded.status end
     returning (xmax = 0) as inserted`,
    [userId, connectionId, e.providerEventId, e.title, e.startsAt, e.endsAt, e.allDay, initial, e.htmlLink, now],
  );
  return rows[0]?.inserted ? "inserted" : "updated";
}

export async function listEvents(ex: SqlExecutor, userId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
  const rows = await ex.query<EvRow>(
    "select * from calendar_events where user_id=$1 and ends_at >= $2 and starts_at < $3 order by starts_at, id limit 500",
    [userId, from, to],
  );
  return rows.map(toEvent);
}

export async function getEvent(ex: SqlExecutor, userId: string, id: string, forUpdate = false): Promise<CalendarEvent | null> {
  const [row] = await ex.query<EvRow>(`select * from calendar_events where user_id=$1 and id=$2 ${forUpdate ? "for update" : ""}`, [userId, id]);
  return row ? toEvent(row) : null;
}

export async function setReviewDecision(ex: SqlExecutor, id: string, status: "confirmed_missed" | "not_missed", now: Date): Promise<void> {
  await ex.query("update calendar_events set status=$2, reviewed_at=$3 where id=$1", [id, status, now]);
}

/** Ended, not-yet-decided, non-cancelled events (midnight-review population). */
export async function listAwaitingReview(ex: SqlExecutor, userId: string, boundary: Date): Promise<Pick<CalendarEvent, "id" | "title" | "endsAt" | "htmlLink">[]> {
  const rows = await ex.query<{ id: string; title: string; ends_at: Date; html_link: string | null }>(
    `select id, title, ends_at, html_link from calendar_events
      where user_id=$1 and status in ('upcoming','past_pending_review') and ends_at <= $2 order by ends_at, id`,
    [userId, boundary],
  );
  return rows.map((r) => ({ id: r.id, title: r.title, endsAt: r.ends_at, htmlLink: r.html_link }));
}

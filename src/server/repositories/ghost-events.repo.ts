import type { SqlExecutor } from "../db/types";
import type { GhostEvent, GhostEventType } from "@/features/hauntings/model";

interface Row {
  id: string;
  user_id: string;
  task_id: string | null;
  calendar_event_id: string | null;
  event_type: GhostEventType;
  dedupe_key: string;
  occurred_at: Date;
  acknowledged_at: Date | null;
  payload: Record<string, unknown>;
  created_at: Date;
}

export const toGhostEvent = (r: Row): GhostEvent => ({
  id: r.id,
  userId: r.user_id,
  taskId: r.task_id,
  calendarEventId: r.calendar_event_id,
  eventType: r.event_type,
  dedupeKey: r.dedupe_key,
  occurredAt: r.occurred_at,
  acknowledgedAt: r.acknowledged_at,
  payload: r.payload ?? {},
  createdAt: r.created_at,
});

export interface NewGhostEvent {
  userId: string;
  taskId?: string | null;
  calendarEventId?: string | null;
  eventType: GhostEventType;
  dedupeKey: string;
  occurredAt: Date;
  payload?: Record<string, unknown>;
}

/** Idempotent insert. Returns the new event, or null when the dedupe key already exists. */
export async function insertGhostEventOnce(ex: SqlExecutor, e: NewGhostEvent, now: Date): Promise<GhostEvent | null> {
  const [row] = await ex.query<Row>(
    `insert into ghost_events (user_id, task_id, calendar_event_id, event_type, dedupe_key, occurred_at, payload, created_at)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
     on conflict (user_id, dedupe_key) do nothing
     returning *`,
    [e.userId, e.taskId ?? null, e.calendarEventId ?? null, e.eventType, e.dedupeKey, e.occurredAt, JSON.stringify(e.payload ?? {}), now],
  );
  return row ? toGhostEvent(row) : null;
}

export async function getGhostEvent(ex: SqlExecutor, userId: string, id: string): Promise<GhostEvent | null> {
  const [row] = await ex.query<Row>("select * from ghost_events where id=$1 and user_id=$2", [id, userId]);
  return row ? toGhostEvent(row) : null;
}

export async function listGhostEvents(
  ex: SqlExecutor,
  userId: string,
  o: { limit?: number; types?: GhostEventType[]; taskId?: string } = {},
): Promise<GhostEvent[]> {
  const params: unknown[] = [userId];
  const where = ["user_id = $1"];
  if (o.types?.length) {
    params.push(o.types);
    where.push(`event_type = any($${params.length}::text[])`);
  }
  if (o.taskId) {
    params.push(o.taskId);
    where.push(`task_id = $${params.length}`);
  }
  params.push(Math.min(o.limit ?? 100, 500));
  const rows = await ex.query<Row>(
    `select * from ghost_events where ${where.join(" and ")} order by occurred_at desc, created_at desc limit $${params.length}`,
    params,
  );
  return rows.map(toGhostEvent);
}

export async function listMissedForTasks(ex: SqlExecutor, userId: string, taskIds: string[]): Promise<GhostEvent[]> {
  if (taskIds.length === 0) return [];
  const rows = await ex.query<Row>(
    `select * from ghost_events where user_id=$1 and event_type='deadline_missed' and task_id = any($2::uuid[]) order by occurred_at`,
    [userId, taskIds],
  );
  return rows.map(toGhostEvent);
}

export async function acknowledgeEvent(ex: SqlExecutor, userId: string, id: string, now: Date): Promise<GhostEvent | null> {
  const [row] = await ex.query<Row>(
    "update ghost_events set acknowledged_at = coalesce(acknowledged_at, $3) where id=$1 and user_id=$2 returning *",
    [id, userId, now],
  );
  return row ? toGhostEvent(row) : null;
}

/** Dialogue is cached on the event once; later calls never overwrite it. */
export async function setDialogueOnce(ex: SqlExecutor, userId: string, id: string, dialogue: { text: string; source: "ai" | "fallback" }): Promise<GhostEvent | null> {
  const [row] = await ex.query<Row>(
    `update ghost_events set payload = payload || jsonb_build_object('dialogue', $3::jsonb)
      where id=$1 and user_id=$2 and not (payload ? 'dialogue') returning *`,
    [id, userId, JSON.stringify(dialogue)],
  );
  return row ? toGhostEvent(row) : null;
}

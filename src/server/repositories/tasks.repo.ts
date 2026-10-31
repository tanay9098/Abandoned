import type { SqlExecutor } from "../db/types";
import type { Recurrence, Task, TaskFilter, TaskSort, TaskSource, TaskStatus } from "@/features/tasks/model";

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_at: Date | null;
  due_timezone: string | null;
  source_type: TaskSource;
  source_ref: string | null;
  recurrence: Recurrence | null;
  completed_at: Date | null;
  released_at: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export const toTask = (r: TaskRow): Task => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  description: r.description,
  status: r.status,
  dueAt: r.due_at,
  dueTimezone: r.due_timezone,
  sourceType: r.source_type,
  sourceRef: r.source_ref,
  recurrence: r.recurrence,
  completedAt: r.completed_at,
  releasedAt: r.released_at,
  version: Number(r.version),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface NewTask {
  userId: string;
  title: string;
  description: string | null;
  dueAt: Date | null;
  dueTimezone: string | null;
  recurrence: Recurrence | null;
}

export async function insertTask(ex: SqlExecutor, t: NewTask, now: Date): Promise<Task> {
  const [row] = await ex.query<TaskRow>(
    `insert into tasks (user_id, title, description, due_at, due_timezone, recurrence, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$7) returning *`,
    [t.userId, t.title, t.description, t.dueAt, t.dueTimezone, t.recurrence, now],
  );
  return toTask(row!);
}

/** Ownership is part of every query: a foreign id simply does not exist for the caller. */
export async function getTask(ex: SqlExecutor, userId: string, id: string, forUpdate = false): Promise<Task | null> {
  const [row] = await ex.query<TaskRow>(
    `select * from tasks where id = $1 and user_id = $2 ${forUpdate ? "for update" : ""}`,
    [id, userId],
  );
  return row ? toTask(row) : null;
}

export interface ListTasksOptions {
  filter?: TaskFilter;
  from?: Date;
  to?: Date;
  sort?: TaskSort;
  limit?: number;
}

export async function listTasks(ex: SqlExecutor, userId: string, now: Date, o: ListTasksOptions = {}): Promise<Task[]> {
  const where: string[] = ["user_id = $1"];
  const params: unknown[] = [userId];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  switch (o.filter ?? "all") {
    case "active":
      where.push("status = 'pending'");
      break;
    case "overdue":
      where.push(`status = 'pending' and due_at is not null and due_at <= ${add(now)}`);
      break;
    case "completed":
      where.push("status = 'completed'");
      break;
    case "released":
      where.push("status = 'released'");
      break;
  }
  if (o.from) where.push(`due_at >= ${add(o.from)}`);
  if (o.to) where.push(`due_at < ${add(o.to)}`);
  const order =
    o.sort === "title"
      ? "lower(title) asc, id"
      : o.sort === "created"
        ? "created_at desc, id"
        : "due_at asc nulls last, created_at desc, id";
  const rows = await ex.query<TaskRow>(
    `select * from tasks where ${where.join(" and ")} order by ${order} limit ${add(Math.min(o.limit ?? 500, 500))}`,
    params,
  );
  return rows.map(toTask);
}

export interface TaskPatchRow {
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: Date | null;
  dueTimezone: string | null;
  recurrence: Recurrence | null;
  completedAt: Date | null;
  releasedAt: Date | null;
}

export async function updateTaskRow(ex: SqlExecutor, userId: string, id: string, p: TaskPatchRow, now: Date): Promise<Task> {
  const [row] = await ex.query<TaskRow>(
    `update tasks set title=$3, description=$4, status=$5, due_at=$6, due_timezone=$7, recurrence=$8,
            completed_at=$9, released_at=$10, version = version + 1, updated_at = $11
      where id=$1 and user_id=$2 returning *`,
    [id, userId, p.title, p.description, p.status, p.dueAt, p.dueTimezone, p.recurrence, p.completedAt, p.releasedAt, now],
  );
  return toTask(row!);
}

export async function deleteTask(ex: SqlExecutor, userId: string, id: string): Promise<boolean> {
  const rows = await ex.query("delete from tasks where id=$1 and user_id=$2 returning id", [id, userId]);
  return rows.length > 0;
}

export interface OverdueCandidate {
  id: string;
  userId: string;
  dueAt: Date;
  title: string;
}

/**
 * Pending tasks whose deadline has been reached and which have no haunting recorded for that
 * exact deadline yet. The NOT EXISTS is an optimisation; the unique dedupe key is the guarantee.
 */
export async function findUnhauntedOverdue(
  ex: SqlExecutor,
  now: Date,
  limit: number,
  userId?: string,
): Promise<OverdueCandidate[]> {
  const rows = await ex.query<{ id: string; user_id: string; due_at: Date; title: string }>(
    `select t.id, t.user_id, t.due_at, t.title
       from tasks t
      where t.status = 'pending' and t.due_at is not null and t.due_at <= $1
        and ($3::uuid is null or t.user_id = $3::uuid)
        and not exists (
          select 1 from ghost_events g
           where g.user_id = t.user_id
             and g.dedupe_key = 'deadline_missed:' || t.id::text || ':' || floor(extract(epoch from t.due_at) * 1000)::bigint::text)
      order by t.due_at asc, t.id
      limit $2`,
    [now, limit, userId ?? null],
  );
  return rows.map((r) => ({ id: r.id, userId: r.user_id, dueAt: r.due_at, title: r.title }));
}

/** Pending tasks due at or before `boundary` (the midnight-review population). */
export async function listPendingDueBy(ex: SqlExecutor, userId: string, boundary: Date): Promise<Pick<Task, "id" | "title" | "dueAt">[]> {
  const rows = await ex.query<{ id: string; title: string; due_at: Date }>(
    "select id, title, due_at from tasks where user_id=$1 and status='pending' and due_at is not null and due_at <= $2 order by due_at, id",
    [userId, boundary],
  );
  return rows.map((r) => ({ id: r.id, title: r.title, dueAt: r.due_at }));
}

export async function getTasksByIds(ex: SqlExecutor, userId: string, ids: string[]): Promise<Task[]> {
  if (ids.length === 0) return [];
  const rows = await ex.query<TaskRow>("select * from tasks where user_id=$1 and id = any($2::uuid[])", [userId, ids]);
  return rows.map(toTask);
}

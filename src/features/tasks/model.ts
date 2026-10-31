/** Task domain model. Pure; no IO. Overdue is *derived*, never stored. */

export type TaskStatus = "pending" | "completed" | "released";
export type TaskSource = "native" | "calendar";
export type Recurrence = "daily" | "weekly" | "monthly";

export const TASK_STATUSES: readonly TaskStatus[] = ["pending", "completed", "released"];

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: Date | null;
  dueTimezone: string | null;
  sourceType: TaskSource;
  sourceRef: string | null;
  recurrence: Recurrence | null;
  completedAt: Date | null;
  releasedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

type Deadlined = { status: TaskStatus; dueAt: Date | string | null };

function toMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * A task is overdue when it is pending, has a deadline, and the deadline has been reached.
 * The boundary is inclusive: at exactly `dueAt` the task is overdue.
 */
export function isOverdue(task: Deadlined, now: Date | number): boolean {
  if (task.status !== "pending" || task.dueAt === null) return false;
  const nowMs = typeof now === "number" ? now : now.getTime();
  return toMs(task.dueAt) <= nowMs;
}

/** Milliseconds past the deadline; 0 when not overdue. */
export function overdueByMs(task: Deadlined, now: Date | number): number {
  if (!isOverdue(task, now)) return 0;
  const nowMs = typeof now === "number" ? now : now.getTime();
  return nowMs - toMs(task.dueAt!);
}

const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ["completed", "released"],
  completed: ["pending"], // reopen
  released: ["pending"], // resurrect
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: TaskStatus,
    readonly to: TaskStatus,
  ) {
    super(`Cannot move a task from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/** Timestamp columns implied by a status; keeps completed_at / released_at consistent. */
export function statusTimestamps(
  status: TaskStatus,
  now: Date,
  previous?: { completedAt: Date | null; releasedAt: Date | null; status: TaskStatus },
): { completedAt: Date | null; releasedAt: Date | null } {
  if (previous && previous.status === status) {
    return { completedAt: previous.completedAt, releasedAt: previous.releasedAt };
  }
  if (status === "completed") return { completedAt: now, releasedAt: null };
  if (status === "released") return { completedAt: null, releasedAt: now };
  return { completedAt: null, releasedAt: null };
}

export type TaskFilter = "active" | "overdue" | "completed" | "released" | "all";
export type TaskSort = "due" | "created" | "title";

/** In-memory filter/sort used by the UI and tests (the API applies the same semantics in SQL). */
export function matchesFilter(task: Deadlined, filter: TaskFilter, now: Date | number): boolean {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return task.status === "pending";
    case "overdue":
      return isOverdue(task, now);
    case "completed":
      return task.status === "completed";
    case "released":
      return task.status === "released";
  }
}

export type TimeGroup = "overdue" | "today" | "tomorrow" | "upcoming" | "someday" | "resolved";

/** Group labels for the dashboard; `dayOf` converts an instant to a local YYYY-MM-DD. */
export function groupTask(
  task: Deadlined,
  nowMs: number,
  dayOf: (ms: number) => string,
  todayStr: string,
  tomorrowStr: string,
): TimeGroup {
  if (task.status !== "pending") return "resolved";
  if (task.dueAt === null) return "someday";
  if (isOverdue(task, nowMs)) return "overdue";
  const d = dayOf(toMs(task.dueAt));
  if (d === todayStr) return "today";
  if (d === tomorrowStr) return "tomorrow";
  return "upcoming";
}

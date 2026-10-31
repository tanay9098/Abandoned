import { isOverdue, type Task } from "@/features/tasks/model";

export type GhostEventType =
  | "deadline_missed"
  | "midnight_review"
  | "event_review"
  | "task_completed"
  | "task_released"
  | "task_rescheduled";

export interface GhostEvent {
  id: string;
  userId: string;
  taskId: string | null;
  calendarEventId: string | null;
  eventType: GhostEventType;
  dedupeKey: string;
  occurredAt: Date;
  acknowledgedAt: Date | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

/** Stable idempotency keys. A new deadline for the same task yields a new key; a retry of the same deadline does not. */
export const dedupeKeys = {
  deadlineMissed: (taskId: string, dueAt: Date | number) =>
    `deadline_missed:${taskId}:${typeof dueAt === "number" ? dueAt : dueAt.getTime()}`,
  midnightReview: (userId: string, localDate: string) => `midnight_review:${userId}:${localDate}`,
  eventReview: (calendarEventId: string) => `event_review:${calendarEventId}`,
  taskCompleted: (taskId: string, completedAt: Date) => `task_completed:${taskId}:${completedAt.getTime()}`,
  taskReleased: (taskId: string, releasedAt: Date) => `task_released:${taskId}:${releasedAt.getTime()}`,
  taskRescheduled: (taskId: string, version: number) => `task_rescheduled:${taskId}:v${version}`,
};

/** Presentation state of a task's ghost. Derived; never replaces the task status. */
export type GhostPresentation = "dormant" | "awakened" | "acknowledged" | "resting";

export interface HauntRecord {
  /** deadline_missed.payload.dueAt (ms) */
  dueAtMs: number;
  acknowledged: boolean;
}

export function deriveGhostState(
  task: Pick<Task, "status" | "dueAt">,
  hauntings: readonly HauntRecord[],
  now: Date | number,
): GhostPresentation {
  if (task.status !== "pending") return hauntings.length > 0 ? "resting" : "dormant";
  const dueMs = task.dueAt?.getTime() ?? null;
  const current = dueMs === null ? undefined : hauntings.find((h) => h.dueAtMs === dueMs);
  if (isOverdue(task, now) && current) return current.acknowledged ? "acknowledged" : "awakened";
  if (hauntings.length > 0) return "resting"; // rescheduled: a previous deadline haunted, the new one has not
  return "dormant";
}

/** Visual states for the ghost character (Design.md §7). */
export type GhostVisualState =
  | "idle"
  | "awakening"
  | "observing"
  | "confrontation"
  | "rescheduled"
  | "released"
  | "completed";

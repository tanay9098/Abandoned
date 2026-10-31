import type { Db } from "../db/types";
import { badRequest, conflict, notFound } from "../errors";
import * as tasksRepo from "../repositories/tasks.repo";
import * as ghostRepo from "../repositories/ghost-events.repo";
import { getProfile } from "../repositories/profiles.repo";
import { dedupeKeys } from "@/features/hauntings/model";
import {
  InvalidTransitionError,
  canTransition,
  statusTimestamps,
  type Task,
  type TaskFilter,
  type TaskSort,
  type TaskStatus,
} from "@/features/tasks/model";
import {
  resolveDeadline,
  touchesDeadline,
  type CreateTaskInput,
  type PatchTaskInput,
} from "@/features/tasks/validation";
import { shiftLocalInstant } from "@/lib/datetime/zone";

async function timezoneOf(db: { query: Db["query"] }, userId: string): Promise<string> {
  const p = await getProfile(db, userId);
  if (!p) throw notFound("Profile");
  return p.timezone;
}

export async function createTask(db: Db, userId: string, input: CreateTaskInput, now: Date): Promise<Task> {
  const tz = await timezoneOf(db, userId);
  const deadline = resolveDeadline(input, tz);
  return tasksRepo.insertTask(
    db,
    {
      userId,
      title: input.title,
      description: input.description ? input.description : null,
      dueAt: deadline.dueAt,
      dueTimezone: deadline.dueTimezone,
      recurrence: deadline.dueAt ? (input.recurrence ?? null) : null,
    },
    now,
  );
}

export async function listTasks(
  db: Db,
  userId: string,
  now: Date,
  opts: { filter?: TaskFilter; from?: Date; to?: Date; sort?: TaskSort } = {},
): Promise<Task[]> {
  return tasksRepo.listTasks(db, userId, now, opts);
}

export async function getTask(db: Db, userId: string, id: string): Promise<Task> {
  const t = await tasksRepo.getTask(db, userId, id);
  if (!t) throw notFound("Task");
  return t;
}

export interface UpdateResult {
  task: Task;
  nextTask: Task | null;
}

/**
 * Applies a patch atomically. The row is locked (FOR UPDATE) so a concurrent completion and
 * deadline processing serialise; `expectedVersion` gives clients optimistic concurrency.
 * History (ghost events) is appended in the same transaction and never rewritten.
 */
export async function updateTask(db: Db, userId: string, id: string, patch: PatchTaskInput, now: Date): Promise<UpdateResult> {
  const tz = await timezoneOf(db, userId);
  return db.transaction(async (tx) => {
    const current = await tasksRepo.getTask(tx, userId, id, true);
    if (!current) throw notFound("Task");
    if (patch.expectedVersion !== undefined && patch.expectedVersion !== current.version) {
      throw conflict("This task changed since you loaded it. Reload and try again.", "version_conflict");
    }

    const nextStatus = (patch.status as TaskStatus | undefined) ?? current.status;
    if (!canTransition(current.status, nextStatus)) {
      const e = new InvalidTransitionError(current.status, nextStatus);
      throw conflict(e.message, "invalid_transition");
    }

    let dueAt = current.dueAt;
    let dueTimezone = current.dueTimezone;
    if (touchesDeadline(patch)) {
      const r = resolveDeadline(patch, tz);
      dueAt = r.dueAt;
      dueTimezone = r.dueTimezone;
    } else if (patch.dueTimezone !== undefined && patch.dueTimezone !== null) {
      dueTimezone = patch.dueTimezone;
    }

    // Editing the deadline of a finished task is a reschedule only via an explicit reopen.
    if (current.status !== "pending" && nextStatus !== "pending" && touchesDeadline(patch)) {
      throw conflict("Reopen the task before changing its deadline.", "invalid_transition");
    }

    const recurrence = dueAt ? (patch.recurrence !== undefined ? patch.recurrence : current.recurrence) : null;
    const stamps = statusTimestamps(nextStatus, now, current);
    const updated = await tasksRepo.updateTaskRow(
      tx,
      userId,
      id,
      {
        title: patch.title ?? current.title,
        description: patch.description !== undefined ? (patch.description ? patch.description : null) : current.description,
        status: nextStatus,
        dueAt,
        dueTimezone,
        recurrence,
        ...stamps,
      },
      now,
    );

    // --- history -----------------------------------------------------------
    const snapshot = { title: updated.title };
    if (current.status !== nextStatus) {
      if (nextStatus === "completed") {
        await ghostRepo.insertGhostEventOnce(
          tx,
          { userId, taskId: id, eventType: "task_completed", dedupeKey: dedupeKeys.taskCompleted(id, updated.completedAt!), occurredAt: now, payload: snapshot },
          now,
        );
      } else if (nextStatus === "released") {
        await ghostRepo.insertGhostEventOnce(
          tx,
          { userId, taskId: id, eventType: "task_released", dedupeKey: dedupeKeys.taskReleased(id, updated.releasedAt!), occurredAt: now, payload: snapshot },
          now,
        );
      }
    }
    const deadlineChanged = (current.dueAt?.getTime() ?? null) !== (updated.dueAt?.getTime() ?? null);
    if (deadlineChanged && updated.dueAt && updated.status === "pending" && current.dueAt) {
      await ghostRepo.insertGhostEventOnce(
        tx,
        {
          userId,
          taskId: id,
          eventType: "task_rescheduled",
          dedupeKey: dedupeKeys.taskRescheduled(id, updated.version),
          occurredAt: now,
          payload: { ...snapshot, from: current.dueAt.toISOString(), to: updated.dueAt.toISOString() },
        },
        now,
      );
    }

    // --- recurrence: completing a recurring task spawns the next occurrence ------
    let nextTask: Task | null = null;
    if (current.status === "pending" && nextStatus === "completed" && current.recurrence && current.dueAt) {
      const zone = current.dueTimezone ?? tz;
      const unit = current.recurrence === "daily" ? "day" : current.recurrence === "weekly" ? "week" : "month";
      let next = current.dueAt.getTime();
      for (let i = 0; i < 1000 && next <= now.getTime(); i++) next = shiftLocalInstant(next, zone, unit);
      nextTask = await tasksRepo.insertTask(
        tx,
        {
          userId,
          title: current.title,
          description: current.description,
          dueAt: new Date(next),
          dueTimezone: current.dueTimezone,
          recurrence: current.recurrence,
        },
        now,
      );
    }
    return { task: updated, nextTask };
  });
}

/** Hard delete. Ghost events survive (task_id is set null; payload keeps a title snapshot). */
export async function deleteTask(db: Db, userId: string, id: string): Promise<void> {
  const ok = await tasksRepo.deleteTask(db, userId, id);
  if (!ok) throw notFound("Task");
}

export function assertTitle(title: string | undefined): void {
  if (title !== undefined && title.trim() === "") throw badRequest("Title is required");
}

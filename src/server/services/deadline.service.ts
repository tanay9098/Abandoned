import type { Db } from "../db/types";
import * as tasksRepo from "../repositories/tasks.repo";
import * as ghostRepo from "../repositories/ghost-events.repo";
import { dedupeKeys } from "@/features/hauntings/model";
import { isOverdue } from "@/features/tasks/model";
import { logger } from "@/lib/logging/logger";

export interface DeadlineRunResult {
  scanned: number;
  created: number;
  skipped: number;
}

export interface ProcessOptions {
  now: Date;
  /** Restrict to one user (application-open reconciliation). */
  userId?: string;
  batchSize?: number;
  maxBatches?: number;
  jobId?: string;
  /** Test seam: runs between candidate selection and the locked recheck. */
  beforeRecheck?: (candidate: tasksRepo.OverdueCandidate) => Promise<void>;
}

/**
 * Deterministic deadline engine. Pure SQL + ordinary code — no AI, no browser timer.
 *
 * For every pending task whose deadline has been reached it records exactly one
 * `deadline_missed` ghost event per (task, deadline):
 *   1. select candidates;
 *   2. lock the task row and RECHECK status + deadline (a task completed, released or
 *      rescheduled in the meantime is skipped);
 *   3. INSERT .. ON CONFLICT DO NOTHING on the unique dedupe key, so retries and
 *      concurrent runners cannot create duplicates.
 */
export async function processDeadlines(db: Db, o: ProcessOptions): Promise<DeadlineRunResult> {
  const batchSize = o.batchSize ?? 200;
  const maxBatches = o.maxBatches ?? 10;
  const result: DeadlineRunResult = { scanned: 0, created: 0, skipped: 0 };
  const seen = new Set<string>();

  for (let b = 0; b < maxBatches; b++) {
    const candidates = (await tasksRepo.findUnhauntedOverdue(db, o.now, batchSize, o.userId)).filter((c) => !seen.has(c.id));
    if (candidates.length === 0) break;
    for (const c of candidates) {
      seen.add(c.id);
      result.scanned++;
      await o.beforeRecheck?.(c);
      const created = await db.transaction(async (tx) => {
        const task = await tasksRepo.getTask(tx, c.userId, c.id, true);
        if (!task || !task.dueAt) return false;
        if (task.dueAt.getTime() !== c.dueAt.getTime() || !isOverdue(task, o.now)) return false;
        const ev = await ghostRepo.insertGhostEventOnce(
          tx,
          {
            userId: task.userId,
            taskId: task.id,
            eventType: "deadline_missed",
            dedupeKey: dedupeKeys.deadlineMissed(task.id, task.dueAt),
            occurredAt: task.dueAt,
            payload: { title: task.title, dueAt: task.dueAt.toISOString(), dueTimezone: task.dueTimezone },
          },
          o.now,
        );
        return ev !== null;
      });
      if (created) result.created++;
      else result.skipped++;
    }
    if (candidates.length < batchSize) break;
  }
  logger.info("deadlines.processed", { jobId: o.jobId, ...result });
  return result;
}

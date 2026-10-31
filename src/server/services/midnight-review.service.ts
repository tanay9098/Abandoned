import type { Db } from "../db/types";
import { notFound } from "../errors";
import * as tasksRepo from "../repositories/tasks.repo";
import * as calendarRepo from "../repositories/calendar.repo";
import * as ghostRepo from "../repositories/ghost-events.repo";
import * as reviewsRepo from "../repositories/reviews.repo";
import { getProfile, listProfiles } from "../repositories/profiles.repo";
import { reviewTargetFor } from "@/features/midnight-review/boundary";
import { buildReviewSummary } from "@/features/midnight-review/summary";
import { dedupeKeys } from "@/features/hauntings/model";
import { logger } from "@/lib/logging/logger";

export interface GenerateResult {
  created: boolean;
  review: reviewsRepo.DailyReview;
}

/**
 * Idempotently creates the review for the user's *current* local date.
 * Safe to call from retries, concurrent runners and users who were offline at midnight:
 * the (user_id, local_date) unique key decides, and a lost race simply returns the existing row.
 * Summarises tasks that are already overdue as of the midnight boundary; it never changes task state.
 */
export async function generateReview(db: Db, userId: string, now: Date): Promise<GenerateResult> {
  const profile = await getProfile(db, userId);
  if (!profile) throw notFound("Profile");
  const target = reviewTargetFor(now, profile.timezone);

  const existing = await reviewsRepo.getReviewForDate(db, userId, target.localDate);
  if (existing) return { created: false, review: existing };

  return db.transaction(async (tx) => {
    const [tasks, events] = await Promise.all([
      tasksRepo.listPendingDueBy(tx, userId, target.boundary),
      calendarRepo.listAwaitingReview(tx, userId, target.boundary),
    ]);
    const summary = buildReviewSummary(
      target.boundary,
      target.previousBoundary,
      tasks.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt! })),
      events,
    );
    const inserted = await reviewsRepo.insertReviewOnce(tx, userId, target.localDate, profile.timezone, summary, now);
    if (!inserted) {
      const won = await reviewsRepo.getReviewForDate(tx, userId, target.localDate);
      return { created: false, review: won! };
    }
    await ghostRepo.insertGhostEventOnce(
      tx,
      {
        userId,
        eventType: "midnight_review",
        dedupeKey: dedupeKeys.midnightReview(userId, target.localDate),
        occurredAt: target.boundary,
        payload: { localDate: target.localDate, counts: summary.counts },
      },
      now,
    );
    return { created: true, review: inserted };
  });
}

export interface ReviewRunResult {
  users: number;
  created: number;
  failed: number;
}

/** Scheduler entry point: every user whose local date has no review yet gets one. */
export async function generateReviewsForAllUsers(db: Db, now: Date, jobId?: string, pageSize = 200): Promise<ReviewRunResult> {
  const out: ReviewRunResult = { users: 0, created: 0, failed: 0 };
  let after: string | null = null;
  for (;;) {
    const page = await listProfiles(db, after, pageSize);
    if (page.length === 0) break;
    for (const p of page) {
      out.users++;
      try {
        const r = await generateReview(db, p.id, now);
        if (r.created) out.created++;
      } catch (err) {
        out.failed++;
        logger.error("midnight_review.failed", { jobId, userId: p.id, error: (err as Error).message });
      }
    }
    after = page[page.length - 1]!.id;
    if (page.length < pageSize) break;
  }
  logger.info("midnight_review.processed", { jobId, ...out });
  return out;
}

export interface ReviewView {
  review: reviewsRepo.DailyReview;
  /** Live state of the tasks named in the summary (some may have been resolved since). */
  tasks: { id: string; title: string; status: string; dueAt: string | null; stillOverdue: boolean }[];
  /** Should the dashboard present the ritual now? */
  pending: boolean;
}

/** Read-only: never creates a review. Returns the latest review, flagged pending if not dismissed and non-empty. */
export async function getLatestReviewView(db: Db, userId: string, now: Date): Promise<ReviewView | null> {
  const review = await reviewsRepo.getLatestReview(db, userId);
  if (!review) return null;
  const live = await tasksRepo.getTasksByIds(db, userId, review.summary.tasks.map((t) => t.id));
  const tasks = live.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    dueAt: t.dueAt ? t.dueAt.toISOString() : null,
    stillOverdue: t.status === "pending" && !!t.dueAt && t.dueAt.getTime() <= now.getTime(),
  }));
  const total = review.summary.counts.overdueTasks + review.summary.counts.eventsAwaitingReview;
  return { review, tasks, pending: review.dismissedAt === null && total > 0 };
}

export async function markReview(db: Db, userId: string, reviewId: string, action: "seen" | "dismiss", now: Date) {
  const r = await reviewsRepo.markReview(db, userId, reviewId, action, now);
  if (!r) throw notFound("Review");
  return r;
}

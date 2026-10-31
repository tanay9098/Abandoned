export const SUMMARY_VERSION = 1;
export const SUMMARY_LIST_CAP = 50;

export interface ReviewTaskRef {
  id: string;
  title: string;
  dueAt: string;
  newlyOverdue: boolean;
  overdueMs: number;
}

export interface ReviewEventRef {
  id: string;
  title: string;
  endsAt: string;
  htmlLink: string | null;
}

export interface ReviewSummary {
  version: number;
  boundary: string;
  counts: { overdueTasks: number; newlyOverdue: number; eventsAwaitingReview: number };
  tasks: ReviewTaskRef[];
  events: ReviewEventRef[];
}

export interface SummaryTaskInput {
  id: string;
  title: string;
  dueAt: Date;
}
export interface SummaryEventInput {
  id: string;
  title: string;
  endsAt: Date;
  htmlLink: string | null;
}

/**
 * Pure summary builder. `tasks` must already be the pending tasks with dueAt <= boundary;
 * `events` the calendar events that ended by the boundary and still await review.
 * Does NOT mark anything overdue — it only summarises what is already overdue.
 */
export function buildReviewSummary(
  boundary: Date,
  previousBoundary: Date,
  tasks: readonly SummaryTaskInput[],
  events: readonly SummaryEventInput[],
): ReviewSummary {
  const sorted = [...tasks].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || a.id.localeCompare(b.id));
  const refs: ReviewTaskRef[] = sorted.map((t) => ({
    id: t.id,
    title: t.title,
    dueAt: t.dueAt.toISOString(),
    newlyOverdue: t.dueAt.getTime() > previousBoundary.getTime(),
    overdueMs: Math.max(0, boundary.getTime() - t.dueAt.getTime()),
  }));
  const evs: ReviewEventRef[] = [...events]
    .sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime() || a.id.localeCompare(b.id))
    .map((e) => ({ id: e.id, title: e.title, endsAt: e.endsAt.toISOString(), htmlLink: e.htmlLink }));
  return {
    version: SUMMARY_VERSION,
    boundary: boundary.toISOString(),
    counts: {
      overdueTasks: refs.length,
      newlyOverdue: refs.filter((r) => r.newlyOverdue).length,
      eventsAwaitingReview: evs.length,
    },
    tasks: refs.slice(0, SUMMARY_LIST_CAP),
    events: evs.slice(0, SUMMARY_LIST_CAP),
  };
}

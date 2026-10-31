import { addDaysToDate, localDateOf, startOfLocalDay } from "@/lib/datetime/zone";

export interface ReviewTarget {
  /** The local date that just began (the review's key). */
  localDate: string;
  /** First instant of that local date in the user's zone. Tasks due at/before it are overdue for the review. */
  boundary: Date;
  /** Boundary of the previous local day, used to flag tasks that became overdue since the last review. */
  previousBoundary: Date;
}

/** The review a user is entitled to at `now`: the one for their *current* local date. */
export function reviewTargetFor(now: Date | number, timezone: string): ReviewTarget {
  const nowMs = typeof now === "number" ? now : now.getTime();
  const localDate = localDateOf(nowMs, timezone);
  return {
    localDate,
    boundary: new Date(startOfLocalDay(localDate, timezone)),
    previousBoundary: new Date(startOfLocalDay(addDaysToDate(localDate, -1), timezone)),
  };
}

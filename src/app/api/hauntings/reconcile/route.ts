import { json, userRoute } from "@/server/http";
import { processDeadlines } from "@/server/services/deadline.service";
import { generateReview } from "@/server/services/midnight-review.service";

/**
 * Application-open reconciliation: runs the same idempotent engine as the scheduler,
 * scoped to the caller. Safe to call repeatedly.
 */
export const POST = userRoute(async ({ db, userId, now, requestId }) => {
  const deadlines = await processDeadlines(db, { now, userId, jobId: requestId });
  const review = await generateReview(db, userId, now);
  return json({ now: now.toISOString(), deadlines, review: { created: review.created, localDate: review.review.localDate } });
});

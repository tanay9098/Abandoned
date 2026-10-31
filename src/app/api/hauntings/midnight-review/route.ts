import { z } from "zod";
import { json, parseJson, userRoute } from "@/server/http";
import { getLatestReviewView, markReview } from "@/server/services/midnight-review.service";

/** Read-only: repeated GETs never create reviews. */
export const GET = userRoute(async ({ db, userId, now }) => {
  const view = await getLatestReviewView(db, userId, now);
  if (!view) return json({ review: null, pending: false, tasks: [] });
  const { review } = view;
  return json({
    review: { id: review.id, localDate: review.localDate, timezone: review.timezone, summary: review.summary, presentedAt: review.presentedAt?.toISOString() ?? null, dismissedAt: review.dismissedAt?.toISOString() ?? null },
    pending: view.pending,
    tasks: view.tasks,
  });
});

const schema = z.object({ reviewId: z.uuid(), action: z.enum(["seen", "dismiss"]) }).strict();

export const POST = userRoute(async ({ req, db, userId, now }) => {
  const { reviewId, action } = await parseJson(req, schema);
  const r = await markReview(db, userId, reviewId, action, now);
  return json({ ok: true, presentedAt: r.presentedAt?.toISOString() ?? null, dismissedAt: r.dismissedAt?.toISOString() ?? null });
});

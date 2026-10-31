import { json, jobRoute } from "@/server/http";
import { generateReviewsForAllUsers } from "@/server/services/midnight-review.service";

const run = jobRoute(async ({ db, now, requestId }) => json({ ok: true, ...(await generateReviewsForAllUsers(db, now, requestId)) }));

export const POST = run;
export const GET = run;

import { json, jobRoute } from "@/server/http";
import { processDeadlines } from "@/server/services/deadline.service";

const run = jobRoute(async ({ db, now, requestId }) => json({ ok: true, ...(await processDeadlines(db, { now, jobId: requestId })) }));

export const POST = run;
// Hosted cron services (e.g. Vercel Cron) can only issue GET. Same bearer protection applies.
export const GET = run;

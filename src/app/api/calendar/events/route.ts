import { json, queryParam, userRoute } from "@/server/http";
import { listCalendarEvents } from "@/server/services/calendar.service";
import { serializeEvent } from "@/server/serializers";
import { badRequest } from "@/server/errors";

function date(req: Request, name: string, fallback: Date): Date {
  const v = queryParam(req, name);
  if (!v) return fallback;
  const t = Date.parse(v);
  if (Number.isNaN(t)) throw badRequest(`${name} must be an ISO date`);
  return new Date(t);
}

export const GET = userRoute(async ({ req, db, userId, now }) => {
  const from = date(req, "from", new Date(now.getTime() - 14 * 86_400_000));
  const to = date(req, "to", new Date(now.getTime() + 30 * 86_400_000));
  const events = await listCalendarEvents(db, userId, from, to);
  return json({ events: events.map((e) => serializeEvent(e, now)) });
});

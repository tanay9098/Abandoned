import { json, userRoute } from "@/server/http";
import { syncCalendar } from "@/server/services/calendar.service";

export const POST = userRoute(async ({ db, userId, now }) => json({ ok: true, result: await syncCalendar(db, userId, now) }));

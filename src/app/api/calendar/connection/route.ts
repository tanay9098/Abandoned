import { json, userRoute } from "@/server/http";
import { connectionStatus, disconnect } from "@/server/services/calendar.service";

export const GET = userRoute(async ({ db, userId }) => json({ connection: await connectionStatus(db, userId) }));

export const DELETE = userRoute(async ({ db, userId, now }) => json({ ok: true, ...(await disconnect(db, userId, now)) }));

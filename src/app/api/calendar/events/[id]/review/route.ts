import { z } from "zod";
import { json, parseJson, userRoute } from "@/server/http";
import { reviewEvent } from "@/server/services/calendar.service";
import { serializeEvent } from "@/server/serializers";

const schema = z.object({ decision: z.enum(["confirmed_missed", "not_missed"]) }).strict();

export const POST = userRoute<{ id: string }>(async ({ req, db, userId, now, params }) => {
  const { decision } = await parseJson(req, schema);
  const ev = await reviewEvent(db, userId, params.id, decision, now);
  return json({ event: serializeEvent(ev, now) });
});

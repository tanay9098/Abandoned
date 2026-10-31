import { json, userRoute } from "@/server/http";
import { acknowledgeHaunting } from "@/server/services/haunting.service";
import { serializeGhostEvent } from "@/server/serializers";

export const POST = userRoute<{ id: string }>(async ({ db, userId, now, params }) => {
  return json({ haunting: serializeGhostEvent(await acknowledgeHaunting(db, userId, params.id, now)) });
});

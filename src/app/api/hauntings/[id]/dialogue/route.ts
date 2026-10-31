import { json, userRoute } from "@/server/http";
import { dialogueFor } from "@/server/services/haunting.service";

/** Optional AI wording for a haunting; always returns usable text (deterministic fallback). */
export const POST = userRoute<{ id: string }>(async ({ db, userId, now, params }) => json(await dialogueFor(db, userId, params.id, now)));

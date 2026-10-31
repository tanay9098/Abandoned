import { json, queryParam, userRoute } from "@/server/http";
import { listHauntings } from "@/server/services/haunting.service";
import { serializeGhostEvent } from "@/server/serializers";
import { badRequest } from "@/server/errors";
import type { GhostEventType } from "@/features/hauntings/model";

const TYPES: GhostEventType[] = ["deadline_missed", "midnight_review", "event_review", "task_completed", "task_released", "task_rescheduled"];

export const GET = userRoute(async ({ req, db, userId }) => {
  const raw = queryParam(req, "type");
  const types = raw ? raw.split(",") : undefined;
  if (types?.some((t) => !TYPES.includes(t as GhostEventType))) throw badRequest("Unknown event type");
  const limit = Math.min(Math.max(Number(queryParam(req, "limit") ?? 100) || 100, 1), 200);
  const events = await listHauntings(db, userId, { limit, types: types as GhostEventType[] | undefined });
  return json({ hauntings: events.map(serializeGhostEvent) });
});

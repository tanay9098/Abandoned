import { json, parseJson, userRoute } from "@/server/http";
import { patchPreferencesSchema } from "@/features/preferences/model";
import { readPreferences, updatePreferences } from "@/server/services/preferences.service";

export const GET = userRoute(async ({ db, userId }) => json({ preferences: await readPreferences(db, userId) }));

export const PATCH = userRoute(async ({ req, db, userId, now }) => {
  const patch = await parseJson(req, patchPreferencesSchema);
  return json({ preferences: await updatePreferences(db, userId, patch, now) });
});

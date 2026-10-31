import type { Db } from "../db/types";
import { badRequest, notFound } from "../errors";
import { getPreferences, getProfile, savePreferences, updateTimezone } from "../repositories/profiles.repo";
import { quietHoursConsistent, type PatchPreferences, type Preferences } from "@/features/preferences/model";

export async function readPreferences(db: Db, userId: string): Promise<Preferences> {
  const profile = await getProfile(db, userId);
  if (!profile) throw notFound("Profile");
  return getPreferences(db, userId, profile.timezone);
}

/**
 * Changing the time zone affects future boundaries only: stored instants, task deadlines and
 * historical events are never rewritten.
 */
export async function updatePreferences(db: Db, userId: string, patch: PatchPreferences, now: Date): Promise<Preferences> {
  const current = await readPreferences(db, userId);
  const next: Preferences = { ...current, ...patch } as Preferences;
  if (!quietHoursConsistent(next)) throw badRequest("Quiet hours need both a start and an end (or neither).");
  await db.transaction(async (tx) => {
    await savePreferences(tx, userId, next, now);
    if (next.timezone !== current.timezone) await updateTimezone(tx, userId, next.timezone, now);
  });
  return next;
}

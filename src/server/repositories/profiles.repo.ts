import type { SqlExecutor } from "../db/types";
import { DEFAULT_PREFERENCES, type Preferences, type MidnightPresentation } from "@/features/preferences/model";

export interface Profile {
  id: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProfileRow {
  id: string;
  timezone: string;
  created_at: Date;
  updated_at: Date;
}
const toProfile = (r: ProfileRow): Profile => ({ id: r.id, timezone: r.timezone, createdAt: r.created_at, updatedAt: r.updated_at });

export async function createProfile(ex: SqlExecutor, timezone: string, now: Date): Promise<Profile> {
  const [row] = await ex.query<ProfileRow>(
    "insert into profiles (timezone, created_at, updated_at) values ($1, $2, $2) returning *",
    [timezone, now],
  );
  await ex.query("insert into user_preferences (user_id, updated_at) values ($1, $2)", [row!.id, now]);
  return toProfile(row!);
}

export async function getProfile(ex: SqlExecutor, id: string): Promise<Profile | null> {
  const [row] = await ex.query<ProfileRow>("select * from profiles where id = $1", [id]);
  return row ? toProfile(row) : null;
}

/** Page through profiles for scheduled jobs (keyset pagination on id). */
export async function listProfiles(ex: SqlExecutor, afterId: string | null, limit: number): Promise<Profile[]> {
  const rows = await ex.query<ProfileRow>(
    "select * from profiles where ($1::uuid is null or id > $1::uuid) order by id limit $2",
    [afterId, limit],
  );
  return rows.map(toProfile);
}

interface PrefRow {
  sound_enabled: boolean;
  sound_volume: number;
  ambient_enabled: boolean;
  reduced_motion: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  midnight_presentation: MidnightPresentation;
  ai_dialogue_enabled: boolean;
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

export async function getPreferences(ex: SqlExecutor, userId: string, timezone: string): Promise<Preferences> {
  const [r] = await ex.query<PrefRow>(
    `select sound_enabled, sound_volume, ambient_enabled, reduced_motion,
            quiet_hours_start::text as quiet_hours_start, quiet_hours_end::text as quiet_hours_end,
            midnight_presentation, ai_dialogue_enabled
       from user_preferences where user_id = $1`,
    [userId],
  );
  if (!r) return { timezone, ...DEFAULT_PREFERENCES };
  return {
    timezone,
    soundEnabled: r.sound_enabled,
    soundVolume: Number(r.sound_volume),
    ambientEnabled: r.ambient_enabled,
    reducedMotion: r.reduced_motion,
    quietHoursStart: hhmm(r.quiet_hours_start),
    quietHoursEnd: hhmm(r.quiet_hours_end),
    midnightPresentation: r.midnight_presentation,
    aiDialogueEnabled: r.ai_dialogue_enabled,
  };
}

export async function savePreferences(ex: SqlExecutor, userId: string, p: Preferences, now: Date): Promise<void> {
  await ex.query(
    `insert into user_preferences (user_id, sound_enabled, sound_volume, ambient_enabled, reduced_motion,
        quiet_hours_start, quiet_hours_end, midnight_presentation, ai_dialogue_enabled, updated_at)
     values ($1,$2,$3,$4,$5,$6::time,$7::time,$8,$9,$10)
     on conflict (user_id) do update set
        sound_enabled = excluded.sound_enabled, sound_volume = excluded.sound_volume,
        ambient_enabled = excluded.ambient_enabled, reduced_motion = excluded.reduced_motion,
        quiet_hours_start = excluded.quiet_hours_start, quiet_hours_end = excluded.quiet_hours_end,
        midnight_presentation = excluded.midnight_presentation, ai_dialogue_enabled = excluded.ai_dialogue_enabled,
        updated_at = excluded.updated_at`,
    [
      userId,
      p.soundEnabled,
      p.soundVolume,
      p.ambientEnabled,
      p.reducedMotion,
      p.quietHoursStart,
      p.quietHoursEnd,
      p.midnightPresentation,
      p.aiDialogueEnabled,
      now,
    ],
  );
}

export async function updateTimezone(ex: SqlExecutor, userId: string, timezone: string, now: Date): Promise<void> {
  await ex.query("update profiles set timezone = $2, updated_at = $3 where id = $1", [userId, timezone, now]);
}

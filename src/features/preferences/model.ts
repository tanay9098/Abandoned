import { z } from "zod";
import { isValidTimeZone, parseTimeString } from "@/lib/datetime/zone";

export type MidnightPresentation = "ritual" | "banner" | "off";

export interface Preferences {
  timezone: string;
  soundEnabled: boolean;
  soundVolume: number;
  ambientEnabled: boolean;
  reducedMotion: boolean;
  quietHoursStart: string | null; // HH:mm
  quietHoursEnd: string | null; // HH:mm
  midnightPresentation: MidnightPresentation;
  aiDialogueEnabled: boolean;
}

/** Safe defaults: silent until the user opts in, AI off, full midnight ritual (skippable). */
export const DEFAULT_PREFERENCES: Omit<Preferences, "timezone"> = {
  soundEnabled: false,
  soundVolume: 0.6,
  ambientEnabled: false,
  reducedMotion: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  midnightPresentation: "ritual",
  aiDialogueEnabled: false,
};

const hhmm = z
  .string()
  .refine((v) => parseTimeString(v) !== null, "Use HH:mm")
  .transform((v) => v.slice(0, 5));

export const patchPreferencesSchema = z
  .object({
    timezone: z.string().refine(isValidTimeZone, "Unknown IANA time zone"),
    soundEnabled: z.boolean(),
    soundVolume: z.number().min(0).max(1),
    ambientEnabled: z.boolean(),
    reducedMotion: z.boolean(),
    quietHoursStart: hhmm.nullable(),
    quietHoursEnd: hhmm.nullable(),
    midnightPresentation: z.enum(["ritual", "banner", "off"]),
    aiDialogueEnabled: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export type PatchPreferences = z.infer<typeof patchPreferencesSchema>;

/** Both quiet-hour bounds must be set together (or both cleared). */
export function quietHoursConsistent(p: Pick<Preferences, "quietHoursStart" | "quietHoursEnd">): boolean {
  return (p.quietHoursStart === null) === (p.quietHoursEnd === null);
}

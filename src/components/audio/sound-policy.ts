/**
 * Pure sound-decision logic (Design §9, PRD FR-07). Sound is a narrative layer: this function is the
 * single place that decides whether a cue may play, so mute / quiet hours / autoplay rules cannot drift.
 */
export type SoundEvent = "ambient" | "ghost-awakens" | "midnight-review" | "ghost-interaction" | "task-completed" | "task-released";

export interface SoundContext {
  soundEnabled: boolean;
  soundVolume: number; // 0..1
  ambientEnabled: boolean;
  inQuietHours: boolean;
  /** The user has interacted with the page (browser autoplay policy). */
  hasInteracted: boolean;
  /** Triggered directly by a user action (vs. automatically by an incoming event). */
  userInitiated: boolean;
}

export interface SoundDecision {
  play: boolean;
  volume: number;
  reason?: "muted" | "quiet-hours" | "autoplay-blocked" | "ambient-off" | "zero-volume";
}

const GAIN: Record<SoundEvent, number> = {
  ambient: 0.35,
  "ghost-awakens": 0.8,
  "midnight-review": 0.55, // never loud at midnight
  "ghost-interaction": 0.6,
  "task-completed": 0.9,
  "task-released": 0.8,
};

export const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function decideSound(event: SoundEvent, c: SoundContext): SoundDecision {
  if (!c.soundEnabled) return { play: false, volume: 0, reason: "muted" };
  if (!c.hasInteracted) return { play: false, volume: 0, reason: "autoplay-blocked" };
  if (event === "ambient") {
    if (!c.ambientEnabled) return { play: false, volume: 0, reason: "ambient-off" };
    if (c.inQuietHours) return { play: false, volume: 0, reason: "quiet-hours" };
  } else if (!c.userInitiated && c.inQuietHours) {
    return { play: false, volume: 0, reason: "quiet-hours" };
  }
  const volume = clamp01(c.soundVolume) * GAIN[event];
  if (volume <= 0) return { play: false, volume: 0, reason: "zero-volume" };
  return { play: true, volume };
}

/** Application event -> sound cue. */
export function soundForAppEvent(type: string): SoundEvent | null {
  switch (type) {
    case "ghost.awakened":
      return "ghost-awakens";
    case "ghost.interacted":
      return "ghost-interaction";
    case "task.completed":
      return "task-completed";
    case "task.released":
      return "task-released";
    case "review.opened":
      return "midnight-review";
    default:
      return null;
  }
}

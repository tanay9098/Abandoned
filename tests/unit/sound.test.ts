import { describe, expect, it, vi } from "vitest";
import { decideSound, soundForAppEvent, type SoundContext } from "@/components/audio/sound-policy";
import { SoundManager, type HowlLike } from "@/components/audio/sound-manager";

const ctx = (o: Partial<SoundContext> = {}): SoundContext => ({
  soundEnabled: true,
  soundVolume: 1,
  ambientEnabled: true,
  inQuietHours: false,
  hasInteracted: true,
  userInitiated: true,
  ...o,
});

describe("sound policy", () => {
  it("is silent when muted, whatever the event", () => {
    for (const e of ["ghost-awakens", "midnight-review", "ghost-interaction", "task-completed", "task-released", "ambient"] as const) {
      expect(decideSound(e, ctx({ soundEnabled: false }))).toMatchObject({ play: false, reason: "muted" });
    }
  });
  it("respects browser autoplay rules (no interaction, no sound)", () => {
    expect(decideSound("ghost-awakens", ctx({ hasInteracted: false, userInitiated: false })).reason).toBe("autoplay-blocked");
  });
  it("automatic sounds stay silent in quiet hours; user-initiated ones still play", () => {
    expect(decideSound("ghost-awakens", ctx({ inQuietHours: true, userInitiated: false })).reason).toBe("quiet-hours");
    expect(decideSound("midnight-review", ctx({ inQuietHours: true, userInitiated: false })).reason).toBe("quiet-hours");
    expect(decideSound("task-completed", ctx({ inQuietHours: true, userInitiated: true })).play).toBe(true);
  });
  it("ambient needs its own opt-in and never plays in quiet hours", () => {
    expect(decideSound("ambient", ctx({ ambientEnabled: false })).reason).toBe("ambient-off");
    expect(decideSound("ambient", ctx({ inQuietHours: true })).reason).toBe("quiet-hours");
    expect(decideSound("ambient", ctx()).play).toBe(true);
  });
  it("scales volume and keeps midnight chimes and ambience quieter than effects", () => {
    const full = decideSound("task-completed", ctx());
    const chimes = decideSound("midnight-review", ctx());
    const wind = decideSound("ambient", ctx());
    expect(chimes.volume).toBeLessThan(full.volume);
    expect(wind.volume).toBeLessThan(chimes.volume);
    expect(decideSound("task-completed", ctx({ soundVolume: 0.5 })).volume).toBeCloseTo(0.45);
    expect(decideSound("task-completed", ctx({ soundVolume: 0 })).reason).toBe("zero-volume");
    expect(decideSound("task-completed", ctx({ soundVolume: 7 })).volume).toBeLessThanOrEqual(1);
    expect(decideSound("task-completed", ctx({ soundVolume: NaN })).play).toBe(false);
  });
  it("maps application events to the six specified cues", () => {
    expect(soundForAppEvent("ghost.awakened")).toBe("ghost-awakens");
    expect(soundForAppEvent("review.opened")).toBe("midnight-review");
    expect(soundForAppEvent("ghost.interacted")).toBe("ghost-interaction");
    expect(soundForAppEvent("task.completed")).toBe("task-completed");
    expect(soundForAppEvent("task.released")).toBe("task-released");
    expect(soundForAppEvent("task.rescheduled")).toBeNull(); // rescheduling has no cue
  });
});

class FakeHowl implements HowlLike {
  isPlaying = false;
  plays = 0;
  stops = 0;
  play() {
    this.isPlaying = true;
    this.plays++;
    return 1;
  }
  stop() {
    this.isPlaying = false;
    this.stops++;
  }
  volume(): number {
    return 0;
  }
  playing() {
    return this.isPlaying;
  }
  unload() {}
}

function fakeHowl() {
  const made: { src: string; howl: FakeHowl }[] = [];
  const factory = (src: string) => {
    const howl = new FakeHowl();
    made.push({ src, howl });
    return howl;
  };
  return { made, factory };
}

describe("SoundManager", () => {
  const on = { soundEnabled: true, soundVolume: 0.8, ambientEnabled: false };

  it("loads nothing until a sound is actually permitted", async () => {
    const { made, factory } = fakeHowl();
    const m = new SoundManager(factory);
    m.configure({ ...on, soundEnabled: false }, false);
    m.markInteracted();
    expect(await m.play("task-completed", true)).toBe(false);
    expect(made).toHaveLength(0);
  });

  it("plays on demand, loads lazily, and never layers the same sound", async () => {
    const { made, factory } = fakeHowl();
    const m = new SoundManager(factory);
    m.configure(on, false);
    m.markInteracted();
    expect(await m.play("task-completed", true)).toBe(true);
    expect(await m.play("task-completed", true)).toBe(false); // still playing
    expect(made).toHaveLength(1);
    expect(made[0]!.src).toBe("/sounds/complete.wav");
    expect(made[0]!.howl.plays).toBe(1);
  });

  it("does not play before the first user interaction", async () => {
    const { made, factory } = fakeHowl();
    const m = new SoundManager(factory);
    m.configure(on, false);
    expect(await m.play("ghost-awakens", false)).toBe(false);
    expect(made).toHaveLength(0);
  });

  it("starts ambient only when enabled, stops it when disabled, and pauses when the page is hidden", async () => {
    const { made, factory } = fakeHowl();
    const m = new SoundManager(factory);
    m.configure({ ...on, ambientEnabled: true }, false);
    m.markInteracted();
    await vi.waitFor(() => expect(made.find((h) => h.src.endsWith("wind.wav"))?.howl.plays).toBe(1));
    const wind = made.find((h) => h.src.endsWith("wind.wav"))!.howl;

    m.setPageVisible(false);
    expect(wind.stops).toBeGreaterThan(0);
    expect(wind.playing()).toBe(false);

    m.setPageVisible(true);
    await vi.waitFor(() => expect(wind.playing()).toBe(true));

    m.configure({ ...on, ambientEnabled: false }, false);
    expect(wind.playing()).toBe(false);

    m.configure({ ...on, ambientEnabled: true }, true); // quiet hours
    expect(wind.playing()).toBe(false);
  });

  it("muting stops everything that is playing", async () => {
    const { made, factory } = fakeHowl();
    const m = new SoundManager(factory);
    m.configure({ ...on, ambientEnabled: true }, false);
    m.markInteracted();
    await m.play("midnight-review", true);
    await vi.waitFor(() => expect(made.length).toBeGreaterThan(1));
    m.configure({ ...on, soundEnabled: false }, false);
    expect(made.every((h) => !h.howl.playing())).toBe(true);
  });
});

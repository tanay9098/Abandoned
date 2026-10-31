import { decideSound, type SoundContext, type SoundEvent } from "./sound-policy";

/** The slice of Howl we depend on (lets tests inject a fake). */
export interface HowlLike {
  play(): number;
  stop(): void;
  volume(v?: number): number | HowlLike;
  playing(): boolean;
  unload(): void;
}
export type HowlFactory = (src: string, opts: { loop: boolean; volume: number }) => HowlLike;

const FILES: Record<SoundEvent, { src: string; loop: boolean }> = {
  ambient: { src: "/sounds/wind.wav", loop: true },
  "ghost-awakens": { src: "/sounds/whoosh.wav", loop: false },
  "midnight-review": { src: "/sounds/midnight-chimes.wav", loop: false },
  "ghost-interaction": { src: "/sounds/whisper.wav", loop: false },
  "task-completed": { src: "/sounds/complete.wav", loop: false },
  "task-released": { src: "/sounds/release.wav", loop: false },
};

export type SoundPrefs = Pick<SoundContext, "soundEnabled" | "soundVolume" | "ambientEnabled">;

/**
 * Central audio. Howler is imported lazily so no audio code (or file) is loaded until a cue is
 * actually permitted; each sound is created on demand and an already-playing cue is never layered.
 */
export class SoundManager {
  private howls = new Map<SoundEvent, HowlLike>();
  private prefs: SoundPrefs = { soundEnabled: false, soundVolume: 0.6, ambientEnabled: false };
  private quiet = false;
  private interacted = false;
  private pageVisible = true;

  constructor(private factory?: HowlFactory) {}

  configure(prefs: SoundPrefs, inQuietHours: boolean) {
    this.prefs = prefs;
    this.quiet = inQuietHours;
    if (!prefs.soundEnabled) this.stopAll();
    this.syncAmbient();
  }

  markInteracted() {
    if (this.interacted) return;
    this.interacted = true;
    this.syncAmbient();
  }

  setPageVisible(visible: boolean) {
    this.pageVisible = visible;
    this.syncAmbient();
  }

  private ctx(userInitiated: boolean): SoundContext {
    return { ...this.prefs, inQuietHours: this.quiet, hasInteracted: this.interacted, userInitiated };
  }

  private async howl(event: SoundEvent, volume: number): Promise<HowlLike> {
    let h = this.howls.get(event);
    if (!h) {
      const f = FILES[event];
      if (this.factory) h = this.factory(f.src, { loop: f.loop, volume });
      else {
        const { Howl } = await import("howler");
        h = new Howl({ src: [f.src], loop: f.loop, volume, preload: true, html5: false }) as unknown as HowlLike;
      }
      this.howls.set(event, h);
    }
    return h;
  }

  /** Returns true if a cue was started. */
  async play(event: Exclude<SoundEvent, "ambient">, userInitiated = false): Promise<boolean> {
    const d = decideSound(event, this.ctx(userInitiated));
    if (!d.play) return false;
    const h = await this.howl(event, d.volume);
    if (h.playing()) return false; // never overlap copies of the same sound
    h.volume(d.volume);
    h.play();
    return true;
  }

  /** Starts/stops the ambient bed so it always matches current preferences and page visibility. */
  private syncAmbient() {
    const d = decideSound("ambient", this.ctx(true));
    const existing = this.howls.get("ambient");
    if (d.play && this.pageVisible) {
      void this.howl("ambient", d.volume).then((h) => {
        // Re-check: preferences may have changed while the audio library was loading.
        const again = decideSound("ambient", this.ctx(true));
        if (!again.play || !this.pageVisible) return h.stop();
        h.volume(again.volume);
        if (!h.playing()) h.play();
      });
    } else if (existing) {
      existing.stop();
    }
  }

  /** Stop everything (e.g. when sound is disabled). */
  stopAll() {
    for (const h of this.howls.values()) h.stop();
  }

  dispose() {
    for (const h of this.howls.values()) {
      h.stop();
      h.unload();
    }
    this.howls.clear();
  }
}

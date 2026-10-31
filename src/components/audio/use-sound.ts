"use client";
import { useEffect, useState } from "react";
import type { Bus } from "@/lib/client/bus";
import type { Preferences } from "@/features/preferences/model";
import { isWithinQuietHours } from "@/lib/datetime/zone";
import { SoundManager } from "./sound-manager";
import { soundForAppEvent } from "./sound-policy";

/**
 * Connects preferences + the application event bus to the SoundManager.
 * Sound reacts to the same events as animation; nothing here changes application state.
 */
export function useSound(bus: Bus, prefs: Preferences | null, nowMs: number) {
  const [manager] = useState<SoundManager | null>(() => (typeof window !== "undefined" ? new SoundManager() : null));

  const quiet = prefs ? isWithinQuietHours(nowMs, prefs.timezone, prefs.quietHoursStart, prefs.quietHoursEnd) : false;

  useEffect(() => {
    if (!prefs) return;
    manager?.configure({ soundEnabled: prefs.soundEnabled, soundVolume: prefs.soundVolume, ambientEnabled: prefs.ambientEnabled }, quiet);
  }, [manager, prefs, quiet]);

  useEffect(() => {
    const m = manager;
    if (!m) return;
    const interacted = () => m.markInteracted();
    const visibility = () => m.setPageVisible(document.visibilityState === "visible");
    window.addEventListener("pointerdown", interacted, { once: true });
    window.addEventListener("keydown", interacted, { once: true });
    document.addEventListener("visibilitychange", visibility);
    const off = bus.on((e) => {
      const cue = soundForAppEvent(e.type);
      if (!cue || cue === "ambient") return;
      const auto = e.type === "ghost.awakened" || (e.type === "review.opened" && e.auto);
      void m.play(cue, !auto);
    });
    return () => {
      off();
      window.removeEventListener("pointerdown", interacted);
      window.removeEventListener("keydown", interacted);
      document.removeEventListener("visibilitychange", visibility);
      m.dispose();
    };
  }, [bus, manager]);
}

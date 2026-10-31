import { afterEach, describe, expect, it } from "vitest";
import { patchPreferencesSchema, quietHoursConsistent, DEFAULT_PREFERENCES } from "@/features/preferences/model";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { calendarMode, resetEnvCache } from "@/lib/env";
import { resolveNow } from "@/server/clock";

describe("preferences validation", () => {
  it("defaults are quiet and opt-in", () => {
    expect(DEFAULT_PREFERENCES).toMatchObject({ soundEnabled: false, ambientEnabled: false, aiDialogueEnabled: false, reducedMotion: false });
  });
  it("accepts valid partial updates", () => {
    expect(patchPreferencesSchema.safeParse({ soundVolume: 0.3, quietHoursStart: "22:00", quietHoursEnd: "07:30" }).success).toBe(true);
    expect(patchPreferencesSchema.safeParse({ timezone: "Asia/Kolkata" }).success).toBe(true);
  });
  it("rejects out-of-range, malformed and unknown values", () => {
    for (const bad of [{ soundVolume: 1.2 }, { soundVolume: -0.1 }, { quietHoursStart: "25:00" }, { timezone: "Nope/Zone" }, { midnightPresentation: "loud" }, { soundEnabled: "yes" }, {}, { userId: "x" }]) {
      expect(patchPreferencesSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
  it("quiet hours must be set or cleared together", () => {
    expect(quietHoursConsistent({ quietHoursStart: "22:00", quietHoursEnd: null })).toBe(false);
    expect(quietHoursConsistent({ quietHoursStart: null, quietHoursEnd: null })).toBe(true);
  });
});

describe("rate limiter", () => {
  it("blocks after the limit and recovers after the window", () => {
    resetRateLimits();
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, 0).ok).toBe(true);
    const blocked = rateLimit("k", 3, 1000, 10);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimit("k", 3, 1000, 1001).ok).toBe(true);
    expect(rateLimit("other", 3, 1000, 10).ok).toBe(true);
  });
});

describe("server clock", () => {
  const req = (h?: string) => new Request("http://x", { headers: h ? { "x-test-now": h } : {} });
  afterEach(() => {
    delete process.env.ABANDONMENT_ALLOW_TEST_CLOCK;
    delete process.env.VERCEL_ENV;
    resetEnvCache();
  });
  it("ignores X-Test-Now unless explicitly enabled", () => {
    resetEnvCache();
    const before = Date.now();
    expect(resolveNow(req("2031-01-01T00:00:00Z")).getTime()).toBeGreaterThanOrEqual(before);
  });
  it("honours it when the test flag is set, and ignores garbage", () => {
    process.env.ABANDONMENT_ALLOW_TEST_CLOCK = "1";
    resetEnvCache();
    expect(resolveNow(req("2031-01-01T00:00:00Z")).toISOString()).toBe("2031-01-01T00:00:00.000Z");
    expect(Math.abs(resolveNow(req("nonsense")).getTime() - Date.now())).toBeLessThan(2000);
  });
  it("is refused in a production deployment even if the flag leaks", () => {
    process.env.ABANDONMENT_ALLOW_TEST_CLOCK = "1";
    process.env.VERCEL_ENV = "production";
    resetEnvCache();
    expect(resolveNow(req("2031-01-01T00:00:00Z")).getFullYear()).not.toBe(2031);
  });
});

describe("calendar mode", () => {
  afterEach(() => {
    for (const k of ["GOOGLE_CALENDAR_MOCK", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]) delete process.env[k];
    resetEnvCache();
  });
  it("uses the demo provider only when explicit or in development without credentials", () => {
    resetEnvCache();
    expect(calendarMode()).toBe("mock"); // NODE_ENV=test, no credentials
    process.env.GOOGLE_CLIENT_ID = "a";
    process.env.GOOGLE_CLIENT_SECRET = "b";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost/cb";
    resetEnvCache();
    expect(calendarMode()).toBe("google");
    process.env.GOOGLE_CALENDAR_MOCK = "1";
    resetEnvCache();
    expect(calendarMode()).toBe("mock");
  });
});

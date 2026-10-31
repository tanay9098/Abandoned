import { describe, expect, it } from "vitest";
import {
  addDaysToDate,
  endOfLocalDayDeadline,
  formatDuration,
  getZonedParts,
  isValidTimeZone,
  isWithinQuietHours,
  localDateOf,
  localDateTimeToInstant,
  shiftLocalInstant,
  startOfLocalDay,
  tzOffsetMs,
  zonedTimeToUtc,
} from "@/lib/datetime/zone";

const H = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

describe("time zone helpers", () => {
  it("validates IANA zones", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });

  it("computes the Asia/Kolkata offset (+05:30, no DST)", () => {
    expect(tzOffsetMs(Date.UTC(2026, 0, 1), "Asia/Kolkata")).toBe(5.5 * H);
    expect(tzOffsetMs(Date.UTC(2026, 6, 1), "Asia/Kolkata")).toBe(5.5 * H);
  });

  it("converts wall-clock time to an instant", () => {
    const ms = localDateTimeToInstant("2026-11-02", "18:00", "Asia/Kolkata");
    expect(iso(ms)).toBe("2026-11-02T12:30:00.000Z");
  });

  it("derives the local date across the date line", () => {
    const instant = Date.parse("2026-11-02T20:00:00Z");
    expect(localDateOf(instant, "Asia/Kolkata")).toBe("2026-11-03");
    expect(localDateOf(instant, "America/Los_Angeles")).toBe("2026-11-02");
    expect(localDateOf(instant, "Pacific/Auckland")).toBe("2026-11-03");
  });

  it("returns midnight as hour 0 (never 24)", () => {
    expect(getZonedParts(Date.parse("2026-11-02T18:30:00Z"), "Asia/Kolkata").hour).toBe(0);
  });

  describe("daylight saving", () => {
    it("spring-forward: a nonexistent 02:30 shifts forward past the gap", () => {
      // US 2026: clocks jump 02:00 -> 03:00 on 8 March (America/New_York)
      const ms = localDateTimeToInstant("2026-03-08", "02:30", "America/New_York");
      expect(iso(ms)).toBe("2026-03-08T07:30:00.000Z"); // 03:30 EDT
      expect(getZonedParts(ms, "America/New_York").hour).toBe(3);
    });

    it("fall-back: an ambiguous 01:30 resolves to the first occurrence", () => {
      // US 2026: clocks fall 02:00 -> 01:00 on 1 November
      const ms = localDateTimeToInstant("2026-11-01", "01:30", "America/New_York");
      expect(iso(ms)).toBe("2026-11-01T05:30:00.000Z"); // 01:30 EDT, first pass
    });

    it("day length is 23h on spring-forward and 25h on fall-back", () => {
      const spring = startOfLocalDay("2026-03-09", "America/New_York") - startOfLocalDay("2026-03-08", "America/New_York");
      const fall = startOfLocalDay("2026-11-02", "America/New_York") - startOfLocalDay("2026-11-01", "America/New_York");
      expect(spring).toBe(23 * H);
      expect(fall).toBe(25 * H);
    });

    it("handles a midnight that does not exist (Sao Paulo 2018 DST started at 00:00)", () => {
      const start = startOfLocalDay("2018-11-04", "America/Sao_Paulo");
      expect(getZonedParts(start, "America/Sao_Paulo").hour).toBe(1);
      expect(localDateOf(start, "America/Sao_Paulo")).toBe("2018-11-04");
    });

    it("supports half-hour DST (Australia/Lord_Howe)", () => {
      const winter = tzOffsetMs(Date.UTC(2026, 6, 1), "Australia/Lord_Howe");
      const summer = tzOffsetMs(Date.UTC(2026, 0, 1), "Australia/Lord_Howe");
      expect(winter).toBe(10.5 * H);
      expect(summer).toBe(11 * H);
    });

    it("round-trips every hour around a transition", () => {
      const start = Date.UTC(2026, 2, 7, 0, 0, 0);
      for (let i = 0; i < 72; i++) {
        const t = start + i * H;
        const p = getZonedParts(t, "America/New_York");
        const back = zonedTimeToUtc(p, "America/New_York");
        // Round trip is exact except for the repeated hour, which maps to the first pass.
        expect([t, t - H]).toContain(back);
      }
    });
  });

  describe("date-only deadlines", () => {
    it("end-of-day deadline is the first instant of the next local day", () => {
      const ms = endOfLocalDayDeadline("2026-11-02", "Asia/Kolkata");
      expect(iso(ms)).toBe("2026-11-02T18:30:00.000Z"); // 2026-11-03T00:00 IST
    });
  });

  it("adds days to date strings including month/year/leap boundaries", () => {
    expect(addDaysToDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysToDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  describe("quiet hours", () => {
    const tz = "Asia/Kolkata";
    const at = (hhmm: string) => Date.parse(`2026-11-02T${hhmm}:00+05:30`);
    it("handles windows that wrap past midnight", () => {
      expect(isWithinQuietHours(at("23:00"), tz, "22:00", "07:00")).toBe(true);
      expect(isWithinQuietHours(at("00:00"), tz, "22:00", "07:00")).toBe(true);
      expect(isWithinQuietHours(at("06:59"), tz, "22:00", "07:00")).toBe(true);
      expect(isWithinQuietHours(at("07:00"), tz, "22:00", "07:00")).toBe(false);
      expect(isWithinQuietHours(at("12:00"), tz, "22:00", "07:00")).toBe(false);
    });
    it("handles same-day windows and unset bounds", () => {
      expect(isWithinQuietHours(at("13:30"), tz, "13:00", "14:00")).toBe(true);
      expect(isWithinQuietHours(at("14:00"), tz, "13:00", "14:00")).toBe(false);
      expect(isWithinQuietHours(at("13:30"), tz, null, null)).toBe(false);
      expect(isWithinQuietHours(at("13:30"), tz, "10:00", "10:00")).toBe(false);
    });
  });

  it("formats overdue durations", () => {
    expect(formatDuration(3 * H + 18 * 60_000)).toBe("03H 18M");
    expect(formatDuration(51 * H)).toBe("2D 03H");
    expect(formatDuration(-5)).toBe("00H 00M");
  });

  describe("recurrence shifting", () => {
    it("keeps wall-clock time across DST", () => {
      const d1 = localDateTimeToInstant("2026-03-07", "09:00", "America/New_York");
      const d2 = shiftLocalInstant(d1, "America/New_York", "day");
      expect(getZonedParts(d2, "America/New_York")).toMatchObject({ day: 8, hour: 9 });
      expect(d2 - d1).toBe(23 * H);
    });
    it("clamps month-end", () => {
      const jan31 = localDateTimeToInstant("2026-01-31", "10:00", "UTC");
      expect(localDateOf(shiftLocalInstant(jan31, "UTC", "month"), "UTC")).toBe("2026-02-28");
    });
    it("adds weeks", () => {
      const d = localDateTimeToInstant("2026-11-02", "10:00", "UTC");
      expect(localDateOf(shiftLocalInstant(d, "UTC", "week"), "UTC")).toBe("2026-11-09");
    });
  });
});

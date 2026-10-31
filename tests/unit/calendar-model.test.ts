import { describe, expect, it } from "vitest";
import { effectiveEventStatus, normalizeGoogleEvent } from "@/features/calendar/model";

describe("normalizeGoogleEvent", () => {
  it("normalises a timed event", () => {
    const e = normalizeGoogleEvent(
      {
        id: "abc",
        summary: "  Dentist ",
        htmlLink: "https://www.google.com/calendar/event?eid=abc",
        start: { dateTime: "2026-11-02T10:00:00+05:30" },
        end: { dateTime: "2026-11-02T11:00:00+05:30" },
      },
      "Asia/Kolkata",
    )!;
    expect(e.title).toBe("Dentist");
    expect(e.startsAt!.toISOString()).toBe("2026-11-02T04:30:00.000Z");
    expect(e.endsAt!.toISOString()).toBe("2026-11-02T05:30:00.000Z");
    expect(e.allDay).toBe(false);
    expect(e.htmlLink).toMatch(/^https:\/\/www\.google\.com\//);
  });

  it("anchors all-day events to the user's zone with an exclusive end date", () => {
    const e = normalizeGoogleEvent({ id: "d", summary: "Trip", start: { date: "2026-11-02" }, end: { date: "2026-11-04" } }, "Asia/Kolkata")!;
    expect(e.allDay).toBe(true);
    expect(e.startsAt!.toISOString()).toBe("2026-11-01T18:30:00.000Z");
    expect(e.endsAt!.toISOString()).toBe("2026-11-03T18:30:00.000Z");
  });

  it("keeps recurring instance ids distinct", () => {
    const a = normalizeGoogleEvent({ id: "base_20261102T040000Z", start: { dateTime: "2026-11-02T04:00:00Z" }, end: { dateTime: "2026-11-02T05:00:00Z" } }, "UTC")!;
    const b = normalizeGoogleEvent({ id: "base_20261109T040000Z", start: { dateTime: "2026-11-09T04:00:00Z" }, end: { dateTime: "2026-11-09T05:00:00Z" } }, "UTC")!;
    expect(a.providerEventId).not.toBe(b.providerEventId);
    expect(a.title).toBe("(No title)");
  });

  it("returns cancelled events even without times", () => {
    const e = normalizeGoogleEvent({ id: "gone", status: "cancelled" }, "UTC")!;
    expect(e).toMatchObject({ providerEventId: "gone", cancelled: true, startsAt: null, endsAt: null });
  });

  it("rejects malformed events and unsafe links", () => {
    expect(normalizeGoogleEvent({} as never, "UTC")).toBeNull();
    expect(normalizeGoogleEvent({ id: "x", summary: "no times" }, "UTC")).toBeNull();
    expect(normalizeGoogleEvent({ id: "x", start: { dateTime: "nope" } }, "UTC")).toBeNull();
    const e = normalizeGoogleEvent({ id: "x", htmlLink: "javascript:alert(1)", start: { dateTime: "2026-11-02T10:00:00Z" } }, "UTC")!;
    expect(e.htmlLink).toBeNull();
    const e2 = normalizeGoogleEvent({ id: "x", htmlLink: "https://evil.example/google.com", start: { dateTime: "2026-11-02T10:00:00Z" } }, "UTC")!;
    expect(e2.htmlLink).toBeNull();
  });

  it("truncates very long titles", () => {
    const e = normalizeGoogleEvent({ id: "x", summary: "a".repeat(1000), start: { dateTime: "2026-11-02T10:00:00Z" } }, "UTC")!;
    expect(e.title).toHaveLength(200);
  });
});

describe("effectiveEventStatus", () => {
  const ends = new Date("2026-11-02T11:00:00Z");
  it("an ended event is awaiting review, never missed", () => {
    expect(effectiveEventStatus("upcoming", ends, ends.getTime() + 1)).toBe("past_pending_review");
    expect(effectiveEventStatus("upcoming", ends, ends.getTime() - 1)).toBe("upcoming");
  });
  it("explicit decisions and cancellations are preserved", () => {
    expect(effectiveEventStatus("confirmed_missed", ends, ends.getTime() - 99999)).toBe("confirmed_missed");
    expect(effectiveEventStatus("not_missed", ends, 0)).toBe("not_missed");
    expect(effectiveEventStatus("cancelled", ends, 0)).toBe("cancelled");
  });
});

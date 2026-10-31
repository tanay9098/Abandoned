import { describe, expect, it } from "vitest";
import { dedupeKeys, deriveGhostState } from "@/features/hauntings/model";
import { fallbackDialogue, midnightHeadline, overdueBand } from "@/features/hauntings/dialogue";
import { reviewTargetFor } from "@/features/midnight-review/boundary";
import { buildReviewSummary } from "@/features/midnight-review/summary";

const due = new Date("2026-11-02T12:30:00Z");

describe("dedupe keys", () => {
  it("are stable for the same deadline and differ after rescheduling", () => {
    expect(dedupeKeys.deadlineMissed("t1", due)).toBe(dedupeKeys.deadlineMissed("t1", new Date(due)));
    expect(dedupeKeys.deadlineMissed("t1", due)).not.toBe(dedupeKeys.deadlineMissed("t1", new Date(due.getTime() + 1)));
    expect(dedupeKeys.deadlineMissed("t1", due)).not.toBe(dedupeKeys.deadlineMissed("t2", due));
    expect(dedupeKeys.midnightReview("u", "2026-11-03")).toBe("midnight_review:u:2026-11-03");
  });
});

describe("ghost presentation state", () => {
  const overdueTask = { status: "pending" as const, dueAt: due };
  const now = due.getTime() + 60_000;
  it("dormant before any haunting", () => {
    expect(deriveGhostState(overdueTask, [], now)).toBe("dormant");
    expect(deriveGhostState({ status: "pending", dueAt: null }, [], now)).toBe("dormant");
  });
  it("awakened then acknowledged for the current deadline", () => {
    expect(deriveGhostState(overdueTask, [{ dueAtMs: due.getTime(), acknowledged: false }], now)).toBe("awakened");
    expect(deriveGhostState(overdueTask, [{ dueAtMs: due.getTime(), acknowledged: true }], now)).toBe("acknowledged");
  });
  it("resting after reschedule (old deadline haunted, new one in the future)", () => {
    const rescheduled = { status: "pending" as const, dueAt: new Date(now + 86_400_000) };
    expect(deriveGhostState(rescheduled, [{ dueAtMs: due.getTime(), acknowledged: false }], now)).toBe("resting");
  });
  it("resting once completed or released", () => {
    expect(deriveGhostState({ status: "completed", dueAt: due }, [{ dueAtMs: due.getTime(), acknowledged: false }], now)).toBe("resting");
    expect(deriveGhostState({ status: "released", dueAt: due }, [], now)).toBe("dormant");
  });
});

describe("fallback dialogue", () => {
  it("is deterministic per seed and band", () => {
    expect(fallbackDialogue("task-1", 3_600_000)).toBe(fallbackDialogue("task-1", 3_600_000));
  });
  it("selects bands by overdue duration", () => {
    expect(overdueBand(3_600_000)).toBe("fresh");
    expect(overdueBand(30 * 3_600_000)).toBe("days");
    expect(overdueBand(5 * 86_400_000)).toBe("week");
    expect(overdueBand(30 * 86_400_000)).toBe("long");
  });
  it("never shames, threatens or insults", () => {
    const banned = /fail|worthless|lazy|pathetic|stupid|punish|doom|never finish|disappoint/i;
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      for (const ms of [1, 30 * 3_600_000, 5 * 86_400_000, 40 * 86_400_000]) {
        const line = fallbackDialogue(seed, ms);
        expect(line.length).toBeGreaterThan(10);
        expect(line.length).toBeLessThan(240);
        expect(line).not.toMatch(banned);
      }
    }
  });
  it("midnight headline pluralises", () => {
    expect(midnightHeadline(0)).toMatch(/Nothing/);
    expect(midnightHeadline(1)).toMatch(/One unfinished task /);
    expect(midnightHeadline(3)).toMatch(/Three unfinished tasks/);
  });
});

describe("midnight review", () => {
  it("targets the user's current local date (Asia/Kolkata)", () => {
    // 2026-11-02 18:31Z == 2026-11-03 00:01 IST
    const t = reviewTargetFor(Date.parse("2026-11-02T18:31:00Z"), "Asia/Kolkata");
    expect(t.localDate).toBe("2026-11-03");
    expect(t.boundary.toISOString()).toBe("2026-11-02T18:30:00.000Z");
    expect(t.previousBoundary.toISOString()).toBe("2026-11-01T18:30:00.000Z");
  });
  it("one minute before local midnight still targets the previous date", () => {
    const t = reviewTargetFor(Date.parse("2026-11-02T18:29:00Z"), "Asia/Kolkata");
    expect(t.localDate).toBe("2026-11-02");
  });
  it("different zones get different dates for the same instant", () => {
    const now = Date.parse("2026-11-02T18:31:00Z");
    expect(reviewTargetFor(now, "America/Los_Angeles").localDate).toBe("2026-11-02");
  });
  it("summary flags newly-overdue tasks and sorts oldest first", () => {
    const target = reviewTargetFor(Date.parse("2026-11-02T18:31:00Z"), "Asia/Kolkata");
    const s = buildReviewSummary(
      target.boundary,
      target.previousBoundary,
      [
        { id: "b", title: "Recent", dueAt: new Date("2026-11-02T10:00:00Z") },
        { id: "a", title: "Old", dueAt: new Date("2026-10-20T10:00:00Z") },
      ],
      [{ id: "e1", title: "Dentist", endsAt: new Date("2026-11-02T09:00:00Z"), htmlLink: null }],
    );
    expect(s.tasks.map((t) => t.id)).toEqual(["a", "b"]);
    expect(s.counts).toEqual({ overdueTasks: 2, newlyOverdue: 1, eventsAwaitingReview: 1 });
    expect(s.tasks[0]!.newlyOverdue).toBe(false);
    expect(s.tasks[1]!.newlyOverdue).toBe(true);
  });
});

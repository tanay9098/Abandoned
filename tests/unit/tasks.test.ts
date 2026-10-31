import { describe, expect, it } from "vitest";
import {
  canTransition,
  groupTask,
  isOverdue,
  matchesFilter,
  overdueByMs,
  statusTimestamps,
} from "@/features/tasks/model";
import { createTaskSchema, patchTaskSchema, resolveDeadline, touchesDeadline } from "@/features/tasks/validation";

const due = new Date("2026-11-02T12:30:00.000Z");

describe("overdue derivation", () => {
  it("is false one millisecond before the deadline, true exactly at it", () => {
    const t = { status: "pending" as const, dueAt: due };
    expect(isOverdue(t, due.getTime() - 1)).toBe(false);
    expect(isOverdue(t, due.getTime())).toBe(true);
    expect(isOverdue(t, due.getTime() + 1)).toBe(true);
  });
  it("tasks without a deadline are never overdue", () => {
    expect(isOverdue({ status: "pending", dueAt: null }, new Date("2999-01-01"))).toBe(false);
  });
  it("completed and released tasks are never overdue", () => {
    const later = due.getTime() + 1e9;
    expect(isOverdue({ status: "completed", dueAt: due }, later)).toBe(false);
    expect(isOverdue({ status: "released", dueAt: due }, later)).toBe(false);
  });
  it("accepts ISO strings (client DTOs)", () => {
    expect(isOverdue({ status: "pending", dueAt: due.toISOString() }, due)).toBe(true);
  });
  it("reports overdue duration", () => {
    expect(overdueByMs({ status: "pending", dueAt: due }, due.getTime() + 5000)).toBe(5000);
    expect(overdueByMs({ status: "pending", dueAt: due }, due.getTime() - 5000)).toBe(0);
  });
});

describe("status transitions", () => {
  it("allows complete/release/reopen but not complete->released directly", () => {
    expect(canTransition("pending", "completed")).toBe(true);
    expect(canTransition("pending", "released")).toBe(true);
    expect(canTransition("completed", "pending")).toBe(true);
    expect(canTransition("released", "pending")).toBe(true);
    expect(canTransition("completed", "released")).toBe(false);
    expect(canTransition("released", "completed")).toBe(false);
  });
  it("keeps timestamps consistent with status", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    expect(statusTimestamps("completed", now)).toEqual({ completedAt: now, releasedAt: null });
    expect(statusTimestamps("released", now)).toEqual({ completedAt: null, releasedAt: now });
    expect(statusTimestamps("pending", now)).toEqual({ completedAt: null, releasedAt: null });
    const prev = { status: "completed" as const, completedAt: new Date(1), releasedAt: null };
    expect(statusTimestamps("completed", now, prev).completedAt).toEqual(new Date(1));
  });
});

describe("filters and grouping", () => {
  const now = due.getTime() + 1000;
  it("filters", () => {
    const overdue = { status: "pending" as const, dueAt: due };
    const done = { status: "completed" as const, dueAt: due };
    expect(matchesFilter(overdue, "overdue", now)).toBe(true);
    expect(matchesFilter(done, "overdue", now)).toBe(false);
    expect(matchesFilter(done, "active", now)).toBe(false);
    expect(matchesFilter(done, "completed", now)).toBe(true);
    expect(matchesFilter(done, "all", now)).toBe(true);
  });
  it("groups by local day", () => {
    const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    const g = (t: Parameters<typeof groupTask>[0]) => groupTask(t, now, dayOf, "2026-11-02", "2026-11-03");
    expect(g({ status: "pending", dueAt: null })).toBe("someday");
    expect(g({ status: "pending", dueAt: due })).toBe("overdue");
    expect(g({ status: "pending", dueAt: new Date("2026-11-02T20:00:00Z") })).toBe("today");
    expect(g({ status: "pending", dueAt: new Date("2026-11-03T20:00:00Z") })).toBe("tomorrow");
    expect(g({ status: "pending", dueAt: new Date("2026-11-09T20:00:00Z") })).toBe("upcoming");
    expect(g({ status: "completed", dueAt: due })).toBe("resolved");
  });
});

describe("task input validation", () => {
  it("accepts the documented create payload", () => {
    const r = createTaskSchema.safeParse({
      title: "Finish portfolio",
      description: "Complete the project section",
      dueAt: "2026-11-02T18:00:00+05:30",
      dueTimezone: "Asia/Kolkata",
    });
    expect(r.success).toBe(true);
  });
  it("rejects empty titles, bad zones, naive datetimes and unknown keys", () => {
    expect(createTaskSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: "x", dueTimezone: "Mars/Base" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: "x", dueAt: "2026-11-02T18:00:00" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: "x", userId: "abc" }).success).toBe(false);
  });
  it("rejects dueAt together with dueDate, and dueTime without dueDate", () => {
    expect(createTaskSchema.safeParse({ title: "x", dueAt: "2026-11-02T18:00:00Z", dueDate: "2026-11-02" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: "x", dueTime: "10:00" }).success).toBe(false);
  });
  it("patch requires at least one field and allows clearing the deadline", () => {
    expect(patchTaskSchema.safeParse({}).success).toBe(false);
    const clear = patchTaskSchema.safeParse({ dueAt: null });
    expect(clear.success).toBe(true);
    expect(touchesDeadline(clear.data!)).toBe(true);
    expect(touchesDeadline({ })).toBe(false);
  });
  it("resolves deadlines in the chosen zone", () => {
    expect(resolveDeadline({ dueDate: "2026-11-02", dueTime: "18:00" }, "Asia/Kolkata").dueAt?.toISOString()).toBe(
      "2026-11-02T12:30:00.000Z",
    );
    expect(resolveDeadline({ dueDate: "2026-11-02" }, "Asia/Kolkata").dueAt?.toISOString()).toBe("2026-11-02T18:30:00.000Z");
    expect(resolveDeadline({ dueAt: "2026-11-02T18:00:00+05:30" }, "UTC").dueAt?.toISOString()).toBe("2026-11-02T12:30:00.000Z");
    expect(resolveDeadline({ dueAt: null }, "UTC")).toEqual({ dueAt: null, dueTimezone: null });
  });
  it("a task due 11:00 PM is not due before 23:00 local, and a task due tomorrow is not due at tomorrow's midnight", () => {
    const tz = "Asia/Kolkata";
    const elevenPm = resolveDeadline({ dueDate: "2026-11-02", dueTime: "23:00" }, tz).dueAt!;
    expect(isOverdue({ status: "pending", dueAt: elevenPm }, Date.parse("2026-11-02T22:59:59+05:30"))).toBe(false);
    expect(isOverdue({ status: "pending", dueAt: elevenPm }, Date.parse("2026-11-02T23:00:00+05:30"))).toBe(true);
    // due tomorrow 11 PM vs midnight that starts tomorrow
    const tomorrow = resolveDeadline({ dueDate: "2026-11-03", dueTime: "23:00" }, tz).dueAt!;
    expect(isOverdue({ status: "pending", dueAt: tomorrow }, Date.parse("2026-11-03T00:00:00+05:30"))).toBe(false);
  });
});

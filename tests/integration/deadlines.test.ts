import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types";
import { processDeadlines } from "@/server/services/deadline.service";
import { updateTask } from "@/server/services/task.service";
import { listGhostEvents } from "@/server/repositories/ghost-events.repo";
import { decorateTasks } from "@/server/services/haunting.service";
import { listTasks } from "@/server/services/task.service";
import { freshDb, hours, minutes, newTask, newUser, T0 } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});
afterAll(() => db.close());

const missed = async (userId: string) => (await listGhostEvents(db, userId, { types: ["deadline_missed"] }));

describe("deadline engine", () => {
  it("records no haunting before the deadline, and exactly one at the boundary", async () => {
    const u = await newUser(db);
    const due = new Date(T0.getTime() + hours(2));
    await newTask(db, u.id, due);

    let r = await processDeadlines(db, { now: new Date(due.getTime() - 1), userId: u.id });
    expect(r.created).toBe(0);
    expect(await missed(u.id)).toHaveLength(0);

    r = await processDeadlines(db, { now: due, userId: u.id });
    expect(r.created).toBe(1);
    expect(await missed(u.id)).toHaveLength(1);
  });

  it("is idempotent: repeated and overlapping runs never duplicate", async () => {
    const u = await newUser(db);
    const due = new Date(T0.getTime() + hours(1));
    await newTask(db, u.id, due);
    const now = new Date(due.getTime() + minutes(5));
    const results = await Promise.all([processDeadlines(db, { now }), processDeadlines(db, { now }), processDeadlines(db, { now })]);
    const total = results.reduce((s, r) => s + r.created, 0);
    expect(total).toBeGreaterThanOrEqual(1);
    expect((await missed(u.id)).length).toBe(1);
    const again = await processDeadlines(db, { now, userId: u.id });
    expect(again).toMatchObject({ scanned: 0, created: 0 });
  });

  it("ignores tasks without deadlines, completed and released tasks", async () => {
    const u = await newUser(db);
    const due = new Date(T0.getTime() + hours(1));
    await newTask(db, u.id, null, "no deadline");
    const done = await newTask(db, u.id, due, "done");
    const rel = await newTask(db, u.id, due, "released");
    await updateTask(db, u.id, done.id, { status: "completed" }, T0);
    await updateTask(db, u.id, rel.id, { status: "released" }, T0);
    await processDeadlines(db, { now: new Date(due.getTime() + hours(100)), userId: u.id });
    expect(await missed(u.id)).toHaveLength(0);
  });

  it("rechecks task state under lock: a task completed after candidate selection is skipped", async () => {
    const u = await newUser(db);
    const due = new Date(T0.getTime() + hours(1));
    const t = await newTask(db, u.id, due);
    const now = new Date(due.getTime() + minutes(1));
    const r = await processDeadlines(db, {
      now,
      userId: u.id,
      beforeRecheck: async () => {
        await updateTask(db, u.id, t.id, { status: "completed" }, now);
      },
    });
    expect(r).toMatchObject({ scanned: 1, created: 0, skipped: 1 });
    expect(await missed(u.id)).toHaveLength(0);
  });

  it("rechecks the deadline: a task rescheduled after candidate selection is skipped", async () => {
    const u = await newUser(db);
    const due = new Date(T0.getTime() + hours(1));
    const t = await newTask(db, u.id, due);
    const now = new Date(due.getTime() + minutes(1));
    const r = await processDeadlines(db, {
      now,
      userId: u.id,
      beforeRecheck: async () => {
        await updateTask(db, u.id, t.id, { dueAt: new Date(now.getTime() + hours(24)).toISOString() }, now);
      },
    });
    expect(r.created).toBe(0);
    expect(await missed(u.id)).toHaveLength(0);
  });

  it("a rescheduled task that is missed again produces a second haunting; history is preserved", async () => {
    const u = await newUser(db);
    const due1 = new Date(T0.getTime() + hours(1));
    const t = await newTask(db, u.id, due1);
    await processDeadlines(db, { now: new Date(due1.getTime() + 1), userId: u.id });

    const resched = new Date(due1.getTime() + hours(2));
    const due2 = new Date(resched.getTime() + hours(24));
    await updateTask(db, u.id, t.id, { dueAt: due2.toISOString() }, resched);

    // no longer overdue → "resting"
    let views = await decorateTasks(db, u.id, await listTasks(db, u.id, resched), resched);
    expect(views[0]!.isOverdue).toBe(false);
    expect(views[0]!.ghostState).toBe("resting");
    expect(views[0]!.haunting).toBeNull();

    await processDeadlines(db, { now: new Date(due2.getTime() + 1), userId: u.id });
    const events = await missed(u.id);
    expect(events).toHaveLength(2);
    views = await decorateTasks(db, u.id, await listTasks(db, u.id, new Date(due2.getTime() + 1)), new Date(due2.getTime() + 1));
    expect(views[0]!.ghostState).toBe("awakened");
    // the reschedule itself is recorded
    expect((await listGhostEvents(db, u.id, { types: ["task_rescheduled"] })).length).toBe(1);
  });

  it("completing then reopening an overdue task does not re-haunt the same deadline", async () => {
    const u = await newUser(db);
    const due = new Date(T0.getTime() + hours(1));
    const t = await newTask(db, u.id, due);
    const now = new Date(due.getTime() + minutes(1));
    await processDeadlines(db, { now, userId: u.id });
    await updateTask(db, u.id, t.id, { status: "completed" }, now);
    await updateTask(db, u.id, t.id, { status: "pending" }, now);
    const r = await processDeadlines(db, { now: new Date(now.getTime() + hours(1)), userId: u.id });
    expect(r.created).toBe(0);
    expect(await missed(u.id)).toHaveLength(1);
  });

  it("works for many users in one run and stores the deadline as occurred_at", async () => {
    const a = await newUser(db, "America/New_York");
    const b = await newUser(db, "Pacific/Auckland");
    const due = new Date(T0.getTime() + hours(1));
    await newTask(db, a.id, due);
    await newTask(db, b.id, due);
    await processDeadlines(db, { now: new Date(due.getTime() + 1) });
    const ea = await missed(a.id);
    expect(ea).toHaveLength(1);
    expect(ea[0]!.occurredAt.getTime()).toBe(due.getTime());
    expect(await missed(b.id)).toHaveLength(1);
  });

  it("handles a deadline that falls inside a DST gap (task due 02:30 on spring-forward day)", async () => {
    const u = await newUser(db, "America/New_York");
    const { createTask } = await import("@/server/services/task.service");
    const t = await createTask(db, u.id, { title: "dst", dueDate: "2026-03-08", dueTime: "02:30" } as never, T0);
    expect(t.dueAt!.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    await processDeadlines(db, { now: new Date("2026-03-08T07:29:59Z"), userId: u.id });
    expect(await missed(u.id)).toHaveLength(0);
    await processDeadlines(db, { now: new Date("2026-03-08T07:30:00Z"), userId: u.id });
    expect(await missed(u.id)).toHaveLength(1);
  });
});

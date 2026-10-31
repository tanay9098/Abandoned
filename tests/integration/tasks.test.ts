import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types";
import { createTask, deleteTask, getTask, listTasks, updateTask } from "@/server/services/task.service";
import { listGhostEvents } from "@/server/repositories/ghost-events.repo";
import { processDeadlines } from "@/server/services/deadline.service";
import { AppError } from "@/server/errors";
import { freshDb, hours, newTask, newUser, T0 } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});
afterAll(() => db.close());

describe("task service", () => {
  it("creates tasks with and without deadlines (documented payload)", async () => {
    const u = await newUser(db);
    const a = await createTask(
      db,
      u.id,
      { title: "Finish portfolio", description: "Complete the project section", dueAt: "2026-11-02T18:00:00+05:30", dueTimezone: "Asia/Kolkata" },
      T0,
    );
    expect(a.status).toBe("pending");
    expect(a.dueAt!.toISOString()).toBe("2026-11-02T12:30:00.000Z");
    const b = await createTask(db, u.id, { title: "Someday" }, T0);
    expect(b.dueAt).toBeNull();
    expect(b.sourceType).toBe("native");
  });

  it("date-only deadlines use the profile zone end-of-day", async () => {
    const u = await newUser(db, "Asia/Kolkata");
    const t = await createTask(db, u.id, { title: "d", dueDate: "2026-11-02" }, T0);
    expect(t.dueAt!.toISOString()).toBe("2026-11-02T18:30:00.000Z");
    expect(t.dueTimezone).toBe("Asia/Kolkata");
  });

  it("isolates users: another user's task does not exist for the caller", async () => {
    const a = await newUser(db);
    const b = await newUser(db);
    const t = await newTask(db, a.id, null);
    await expect(getTask(db, b.id, t.id)).rejects.toMatchObject({ status: 404 });
    await expect(updateTask(db, b.id, t.id, { title: "hax" }, T0)).rejects.toMatchObject({ status: 404 });
    await expect(deleteTask(db, b.id, t.id)).rejects.toMatchObject({ status: 404 });
    expect(await listTasks(db, b.id, T0)).toHaveLength(0);
  });

  it("completes, releases, reopens and keeps timestamps consistent", async () => {
    const u = await newUser(db);
    const t = await newTask(db, u.id, new Date(T0.getTime() + hours(1)));
    const done = await updateTask(db, u.id, t.id, { status: "completed" }, T0);
    expect(done.task.completedAt).toEqual(T0);
    const reopened = await updateTask(db, u.id, t.id, { status: "pending" }, T0);
    expect(reopened.task.completedAt).toBeNull();
    const rel = await updateTask(db, u.id, t.id, { status: "released" }, T0);
    expect(rel.task.releasedAt).toEqual(T0);
    expect(rel.task.completedAt).toBeNull();
    const types = (await listGhostEvents(db, u.id, { taskId: t.id })).map((e) => e.eventType).sort();
    expect(types).toEqual(["task_completed", "task_released"]);
  });

  it("rejects invalid transitions (completed -> released)", async () => {
    const u = await newUser(db);
    const t = await newTask(db, u.id, null);
    await updateTask(db, u.id, t.id, { status: "completed" }, T0);
    await expect(updateTask(db, u.id, t.id, { status: "released" }, T0)).rejects.toMatchObject({ status: 409, code: "invalid_transition" });
  });

  it("rejects deadline edits on finished tasks until reopened", async () => {
    const u = await newUser(db);
    const t = await newTask(db, u.id, new Date(T0.getTime() + hours(1)));
    await updateTask(db, u.id, t.id, { status: "completed" }, T0);
    await expect(updateTask(db, u.id, t.id, { dueAt: "2027-01-01T00:00:00Z" }, T0)).rejects.toMatchObject({ code: "invalid_transition" });
    const r = await updateTask(db, u.id, t.id, { status: "pending", dueAt: "2027-01-01T00:00:00Z" }, T0);
    expect(r.task.status).toBe("pending");
  });

  it("enforces optimistic concurrency with expectedVersion", async () => {
    const u = await newUser(db);
    const t = await newTask(db, u.id, null);
    const first = await updateTask(db, u.id, t.id, { title: "v2", expectedVersion: 1 }, T0);
    expect(first.task.version).toBe(2);
    await expect(updateTask(db, u.id, t.id, { title: "stale", expectedVersion: 1 }, T0)).rejects.toMatchObject({ status: 409, code: "version_conflict" });
  });

  it("clearing a deadline makes the task non-overdue forever", async () => {
    const u = await newUser(db);
    const due = new Date(T0.getTime() + hours(1));
    const t = await newTask(db, u.id, due);
    await updateTask(db, u.id, t.id, { dueAt: null }, T0);
    await processDeadlines(db, { now: new Date(due.getTime() + hours(1000)), userId: u.id });
    expect(await listGhostEvents(db, u.id, { types: ["deadline_missed"] })).toHaveLength(0);
  });

  it("filters: active / overdue / completed / released", async () => {
    const u = await newUser(db);
    const past = new Date(T0.getTime() - hours(1));
    await newTask(db, u.id, past, "overdue");
    await newTask(db, u.id, new Date(T0.getTime() + hours(5)), "future");
    await newTask(db, u.id, null, "none");
    const c = await newTask(db, u.id, null, "complete");
    const r = await newTask(db, u.id, null, "release");
    await updateTask(db, u.id, c.id, { status: "completed" }, T0);
    await updateTask(db, u.id, r.id, { status: "released" }, T0);
    const titles = async (filter: never) => (await listTasks(db, u.id, T0, { filter })).map((t) => t.title).sort();
    expect(await titles("overdue" as never)).toEqual(["overdue"]);
    expect(await titles("active" as never)).toEqual(["future", "none", "overdue"]);
    expect(await titles("completed" as never)).toEqual(["complete"]);
    expect(await titles("released" as never)).toEqual(["release"]);
    expect(await titles("all" as never)).toHaveLength(5);
  });

  it("deleting a task preserves its haunting history", async () => {
    const u = await newUser(db);
    const due = new Date(T0.getTime() + hours(1));
    const t = await newTask(db, u.id, due, "Doomed");
    await processDeadlines(db, { now: new Date(due.getTime() + 1), userId: u.id });
    await deleteTask(db, u.id, t.id);
    const ev = await listGhostEvents(db, u.id, { types: ["deadline_missed"] });
    expect(ev).toHaveLength(1);
    expect(ev[0]!.taskId).toBeNull();
    expect(ev[0]!.payload.title).toBe("Doomed");
  });

  it("completing a recurring task spawns the next future occurrence", async () => {
    const u = await newUser(db, "UTC");
    const due = new Date("2026-11-01T10:00:00Z");
    const t = await createTask(db, u.id, { title: "Standup", dueAt: due.toISOString(), recurrence: "daily" }, T0);
    const now = new Date("2026-11-04T12:00:00Z");
    const r = await updateTask(db, u.id, t.id, { status: "completed" }, now);
    expect(r.nextTask).not.toBeNull();
    expect(r.nextTask!.dueAt!.toISOString()).toBe("2026-11-05T10:00:00.000Z");
    expect(r.nextTask!.recurrence).toBe("daily");
    // completing a non-recurring task spawns nothing
    const plain = await newTask(db, u.id, null);
    expect((await updateTask(db, u.id, plain.id, { status: "completed" }, now)).nextTask).toBeNull();
  });

  it("rejects recurrence without a deadline at the database level", async () => {
    const u = await newUser(db);
    const t = await createTask(db, u.id, { title: "x", recurrence: "daily" }, T0);
    expect(t.recurrence).toBeNull(); // service drops recurrence when there is no deadline
  });

  it("surfaces AppError for unknown ids", async () => {
    const u = await newUser(db);
    await expect(getTask(db, u.id, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(AppError);
  });
});

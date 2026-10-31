import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types";
import { generateReview, generateReviewsForAllUsers, getLatestReviewView, markReview } from "@/server/services/midnight-review.service";
import { updateTask } from "@/server/services/task.service";
import { updatePreferences } from "@/server/services/preferences.service";
import { listGhostEvents } from "@/server/repositories/ghost-events.repo";
import { createTask } from "@/server/services/task.service";
import { freshDb, hours, newTask, newUser } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});
afterAll(() => db.close());

// 2026-11-03 00:00 IST == 2026-11-02T18:30:00Z
const MIDNIGHT_IST = new Date("2026-11-02T18:30:00Z");
const created = new Date("2026-10-30T00:00:00Z");

describe("midnight review", () => {
  it("summarises overdue tasks as of the user's local midnight and nothing else", async () => {
    const u = await newUser(db, "Asia/Kolkata");
    await createTask(db, u.id, { title: "old", dueAt: "2026-10-31T10:00:00Z" }, created);
    await createTask(db, u.id, { title: "today evening", dueAt: "2026-11-02T10:00:00Z" }, created); // overdue before midnight
    await createTask(db, u.id, { title: "due tomorrow 11pm", dueDate: "2026-11-03", dueTime: "23:00" }, created); // not overdue
    await createTask(db, u.id, { title: "no deadline" }, created);

    const now = new Date(MIDNIGHT_IST.getTime() + 60_000); // 00:01 IST
    const { created: made, review } = await generateReview(db, u.id, now);
    expect(made).toBe(true);
    expect(review.localDate).toBe("2026-11-03");
    expect(review.summary.tasks.map((t) => t.title)).toEqual(["old", "today evening"]);
    expect(review.summary.counts.overdueTasks).toBe(2);
    expect(review.summary.counts.newlyOverdue).toBe(1); // only the one that crossed since the previous midnight
  });

  it("a task due at 11:00 PM is not in the review generated at the midnight before it", async () => {
    const u = await newUser(db, "Asia/Kolkata");
    await createTask(db, u.id, { title: "11pm", dueDate: "2026-11-02", dueTime: "23:00" }, created);
    // review for local 2026-11-02 (boundary 2026-11-02 00:00 IST == 2026-11-01T18:30Z)
    const { review } = await generateReview(db, u.id, new Date("2026-11-01T18:31:00Z"));
    expect(review.summary.tasks).toHaveLength(0);
  });

  it("does not mark anything: incomplete tasks are only summarised", async () => {
    const u = await newUser(db, "Asia/Kolkata");
    const t = await createTask(db, u.id, { title: "x", dueAt: "2026-11-02T10:00:00Z" }, created);
    await generateReview(db, u.id, new Date(MIDNIGHT_IST.getTime() + 1000));
    const rows = await db.query<{ status: string }>("select status from tasks where id=$1", [t.id]);
    expect(rows[0]!.status).toBe("pending");
  });

  it("is idempotent across retries and concurrent runners (one row, one ghost event)", async () => {
    const u = await newUser(db, "Asia/Kolkata");
    await createTask(db, u.id, { title: "x", dueAt: "2026-11-02T10:00:00Z" }, created);
    const now = new Date(MIDNIGHT_IST.getTime() + 1000);
    const results = await Promise.all([generateReview(db, u.id, now), generateReview(db, u.id, now), generateReview(db, u.id, new Date(now.getTime() + hours(3)))]);
    expect(results.filter((r) => r.created).length).toBe(1);
    const rows = await db.query("select 1 from daily_reviews where user_id=$1", [u.id]);
    expect(rows).toHaveLength(1);
    expect(await listGhostEvents(db, u.id, { types: ["midnight_review"] })).toHaveLength(1);
  });

  it("users offline at midnight still get their review when the job (or the app) next runs", async () => {
    const u = await newUser(db, "Asia/Kolkata");
    await createTask(db, u.id, { title: "x", dueAt: "2026-11-02T10:00:00Z" }, created);
    const lateMorning = new Date("2026-11-03T06:00:00Z");
    const r = await generateReviewsForAllUsers(db, lateMorning);
    expect(r.failed).toBe(0);
    const view = await getLatestReviewView(db, u.id, lateMorning);
    expect(view?.review.localDate).toBe("2026-11-03");
    expect(view?.pending).toBe(true);
  });

  it("different time zones produce different local dates for the same instant", async () => {
    const ist = await newUser(db, "Asia/Kolkata");
    const la = await newUser(db, "America/Los_Angeles");
    const now = new Date(MIDNIGHT_IST.getTime() + 60_000);
    expect((await generateReview(db, ist.id, now)).review.localDate).toBe("2026-11-03");
    expect((await generateReview(db, la.id, now)).review.localDate).toBe("2026-11-02");
  });

  it("changing time zone creates the new local date's review without rewriting history", async () => {
    const u = await newUser(db, "Asia/Kolkata");
    const now = new Date(MIDNIGHT_IST.getTime() + 60_000);
    const first = (await generateReview(db, u.id, now)).review;
    await updatePreferences(db, u.id, { timezone: "America/Los_Angeles" }, now);
    const second = (await generateReview(db, u.id, now)).review;
    expect(second.localDate).toBe("2026-11-02");
    const stored = await db.query<{ timezone: string }>("select timezone from daily_reviews where id=$1", [first.id]);
    expect(stored[0]!.timezone).toBe("Asia/Kolkata");
  });

  it("DST: review on the fall-back day uses the correct 25-hour day boundary", async () => {
    const u = await newUser(db, "America/New_York");
    await createTask(db, u.id, { title: "late", dueAt: "2026-11-01T05:30:00Z" }, created); // 01:30 EDT (first pass)
    // 00:30 EDT on Nov 1 == 04:30Z — review for Nov 1 has boundary 04:00Z; task is NOT yet overdue
    const r1 = await generateReview(db, u.id, new Date("2026-11-01T04:30:00Z"));
    expect(r1.review.localDate).toBe("2026-11-01");
    expect(r1.review.summary.tasks).toHaveLength(0);
    // Nov 2 review boundary is 05:00Z (EST) — the task is overdue by then
    const r2 = await generateReview(db, u.id, new Date("2026-11-02T05:10:00Z"));
    expect(r2.review.localDate).toBe("2026-11-02");
    expect(r2.review.summary.tasks).toHaveLength(1);
  });

  it("repeated reads never create reviews; dismissal is recorded", async () => {
    const u = await newUser(db, "Asia/Kolkata");
    expect(await getLatestReviewView(db, u.id, MIDNIGHT_IST)).toBeNull();
    expect(await getLatestReviewView(db, u.id, MIDNIGHT_IST)).toBeNull();
    await createTask(db, u.id, { title: "x", dueAt: "2026-11-02T10:00:00Z" }, created);
    const { review } = await generateReview(db, u.id, new Date(MIDNIGHT_IST.getTime() + 1000));
    expect((await getLatestReviewView(db, u.id, MIDNIGHT_IST))?.pending).toBe(true);
    await markReview(db, u.id, review.id, "dismiss", MIDNIGHT_IST);
    expect((await getLatestReviewView(db, u.id, MIDNIGHT_IST))?.pending).toBe(false);
  });

  it("live task state reflects resolutions made after the review", async () => {
    const u = await newUser(db, "Asia/Kolkata");
    const t = await createTask(db, u.id, { title: "x", dueAt: "2026-11-02T10:00:00Z" }, created);
    const now = new Date(MIDNIGHT_IST.getTime() + 1000);
    await generateReview(db, u.id, now);
    await updateTask(db, u.id, t.id, { status: "completed" }, now);
    const view = await getLatestReviewView(db, u.id, now);
    expect(view!.tasks[0]).toMatchObject({ status: "completed", stillOverdue: false });
  });

  it("an empty review is stored but not presented", async () => {
    const u = await newUser(db, "Asia/Kolkata");
    await newTask(db, u.id, null);
    await generateReview(db, u.id, MIDNIGHT_IST);
    expect((await getLatestReviewView(db, u.id, MIDNIGHT_IST))?.pending).toBe(false);
  });
});

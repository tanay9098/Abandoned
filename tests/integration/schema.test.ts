import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types";
import { freshDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});
afterAll(() => db.close());

const uid = async (tz = "UTC") => (await db.query<{ id: string }>("insert into profiles (timezone) values ($1) returning id", [tz]))[0]!.id;

describe("schema constraints", () => {
  it("migrations apply and are recorded", async () => {
    const rows = await db.query<{ name: string }>("select name from schema_migrations");
    expect(rows.map((r) => r.name)).toContain("0001_initial_schema.sql");
  });

  it("rejects timestamps inconsistent with status", async () => {
    const u = await uid();
    await expect(db.query("insert into tasks (user_id,title,status) values ($1,'x','completed')", [u])).rejects.toThrow();
    await expect(
      db.query("insert into tasks (user_id,title,status,completed_at,released_at) values ($1,'x','completed',now(),now())", [u]),
    ).rejects.toThrow();
    await db.query("insert into tasks (user_id,title,status,completed_at) values ($1,'ok','completed',now())", [u]);
  });

  it("rejects bad status, volume and half-set quiet hours", async () => {
    const u = await uid();
    await expect(db.query("insert into tasks (user_id,title,status) values ($1,'x','overdue')", [u])).rejects.toThrow();
    await expect(db.query("insert into user_preferences (user_id, sound_volume) values ($1, 1.5)", [u])).rejects.toThrow();
    await expect(db.query("insert into user_preferences (user_id, quiet_hours_start) values ($1, '22:00')", [u])).rejects.toThrow();
  });

  it("has no stored overdue column", async () => {
    const cols = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'tasks'",
    );
    expect(cols.map((c) => c.column_name).join()).not.toMatch(/overdue/);
  });

  it("enforces unique dedupe keys per user and one review per local date", async () => {
    const u = await uid();
    const ins = "insert into ghost_events (user_id,event_type,dedupe_key,occurred_at) values ($1,'deadline_missed',$2,now())";
    await db.query(ins, [u, "k1"]);
    await expect(db.query(ins, [u, "k1"])).rejects.toThrow(/duplicate|unique/i);
    const r = "insert into daily_reviews (user_id,local_date,timezone,summary) values ($1,'2026-11-03','UTC','{}')";
    await db.query(r, [u]);
    await expect(db.query(r, [u])).rejects.toThrow(/duplicate|unique/i);
  });

  it("allows only one active calendar connection per user", async () => {
    const u = await uid();
    await db.query("insert into calendar_connections (user_id) values ($1)", [u]);
    await expect(db.query("insert into calendar_connections (user_id) values ($1)", [u])).rejects.toThrow(/duplicate|unique/i);
    await db.query("update calendar_connections set revoked_at = now() where user_id = $1", [u]);
    await db.query("insert into calendar_connections (user_id) values ($1)", [u]);
  });

  it("keeps ghost history when the task is deleted", async () => {
    const u = await uid();
    const t = (await db.query<{ id: string }>("insert into tasks (user_id,title) values ($1,'t') returning id", [u]))[0]!.id;
    await db.query("insert into ghost_events (user_id,task_id,event_type,dedupe_key,occurred_at) values ($1,$2,'deadline_missed','dk',now())", [u, t]);
    await db.query("delete from tasks where id = $1", [t]);
    const ev = await db.query<{ task_id: string | null }>("select task_id from ghost_events where dedupe_key = 'dk'");
    expect(ev).toHaveLength(1);
    expect(ev[0]!.task_id).toBeNull();
  });
});

describe("row level security (defence in depth)", () => {
  it("isolates users when accessed as a non-privileged role", async () => {
    const a = await uid();
    const b = await uid();
    await db.query("insert into tasks (user_id,title) values ($1,'A-task'), ($2,'B-task')", [a, b]);
    await db.query("insert into calendar_connections (user_id, encrypted_tokens) values ($1,'secret')", [a]).catch(() => undefined);
    await db.query("do $$ begin if not exists (select from pg_roles where rolname='app_user') then create role app_user; end if; end $$");
    await db.query("grant select, insert, update, delete on all tables in schema public to app_user");
    await db.query("grant usage on schema auth to app_user");
    await db.transaction(async (tx) => {
      await tx.query("set local role app_user");
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [a]);
      const mine = await tx.query<{ title: string }>("select title from tasks");
      expect(mine.map((r) => r.title)).toEqual(["A-task"]);
      // cannot write a row for another user
      await expect(tx.query("insert into tasks (user_id,title) values ($1,'evil')", [b])).rejects.toThrow(/row-level security/i);
    });
    const bTask = (await db.query<{ id: string }>("select id from tasks where user_id = $1", [b]))[0]!.id;
    await db.transaction(async (tx) => {
      await tx.query("set local role app_user");
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [a]);
      // token table is default-deny
      expect(await tx.query("select * from calendar_connections")).toHaveLength(0);
      // ghost events cannot reference another user's task
      await expect(
        tx.query("insert into ghost_events (user_id,task_id,event_type,dedupe_key,occurred_at) values ($1,$2,'deadline_missed','x',now())", [a, bTask]),
      ).rejects.toThrow(/row-level security/i);
    });
  });
});

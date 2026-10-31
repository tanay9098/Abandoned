import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/types";
import { resetEnvCache } from "@/lib/env";
import {
  beginConnect,
  completeConnect,
  connectionStatus,
  disconnect,
  listCalendarEvents,
  reviewEvent,
  syncCalendar,
} from "@/server/services/calendar.service";
import { getActiveConnection } from "@/server/repositories/calendar.repo";
import { listGhostEvents } from "@/server/repositories/ghost-events.repo";
import { encryptJson, decryptJson } from "@/server/integrations/google-calendar/crypto";
import { CALENDAR_SCOPE } from "@/server/integrations/google-calendar/oauth";
import { effectiveEventStatus } from "@/features/calendar/model";
import { freshDb, newUser } from "./helpers";

let db: Db;
const NOW = new Date("2026-11-02T09:00:00Z");

beforeAll(async () => {
  db = await freshDb();
});
afterAll(() => db.close());

function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetEnvCache();
}
afterEach(() => setEnv({ GOOGLE_CALENDAR_MOCK: undefined, GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined, GOOGLE_REDIRECT_URI: undefined, TOKEN_ENCRYPTION_KEY: undefined }));

describe("demo calendar (mock provider)", () => {
  beforeEach(() => setEnv({ GOOGLE_CALENDAR_MOCK: "1" }));

  it("connects, syncs, and shows ended events as awaiting review — never as missed", async () => {
    const u = await newUser(db, "Asia/Kolkata", NOW);
    await completeConnect(db, u.id, "mock-demo-code", "v", NOW);
    const r = await syncCalendar(db, u.id, NOW);
    expect(r.inserted).toBeGreaterThan(0);

    const events = await listCalendarEvents(db, u.id, new Date(NOW.getTime() - 14 * 86_400_000), new Date(NOW.getTime() + 30 * 86_400_000));
    const byTitle = Object.fromEntries(events.map((e) => [e.title, e]));
    expect(effectiveEventStatus(byTitle["Dentist appointment"]!.status, byTitle["Dentist appointment"]!.endsAt, NOW)).toBe("past_pending_review");
    expect(effectiveEventStatus(byTitle["Coffee with Priya"]!.status, byTitle["Coffee with Priya"]!.endsAt, NOW)).toBe("upcoming");
    expect(events.every((e) => e.status !== "confirmed_missed")).toBe(true);
    expect(byTitle["Design conference (all day)"]!.allDay).toBe(true);
    // a cancelled event with no times is not inserted
    expect(byTitle["Yoga class"]).toBeUndefined();
  });

  it("re-syncing never duplicates events (provider id uniqueness)", async () => {
    const u = await newUser(db, "Asia/Kolkata", NOW);
    await completeConnect(db, u.id, "mock-demo-code", "v", NOW);
    const a = await syncCalendar(db, u.id, NOW);
    const b = await syncCalendar(db, u.id, NOW);
    expect(b.inserted).toBe(0);
    expect(b.updated).toBe(a.inserted);
    const rows = await db.query("select 1 from calendar_events where user_id=$1", [u.id]);
    expect(rows).toHaveLength(a.inserted);
  });

  it("requires an explicit decision; only ended, non-cancelled events can be classified", async () => {
    const u = await newUser(db, "Asia/Kolkata", NOW);
    await completeConnect(db, u.id, "mock-demo-code", "v", NOW);
    await syncCalendar(db, u.id, NOW);
    const events = await listCalendarEvents(db, u.id, new Date(NOW.getTime() - 14 * 86_400_000), new Date(NOW.getTime() + 30 * 86_400_000));
    const past = events.find((e) => e.title === "Dentist appointment")!;
    const future = events.find((e) => e.title === "Coffee with Priya")!;

    await expect(reviewEvent(db, u.id, future.id, "confirmed_missed", NOW)).rejects.toMatchObject({ code: "invalid_event_state" });

    // nothing is auto-classified
    expect((await listGhostEvents(db, u.id, { types: ["event_review"] }))).toHaveLength(0);

    const updated = await reviewEvent(db, u.id, past.id, "confirmed_missed", NOW);
    expect(updated.status).toBe("confirmed_missed");
    expect(await listGhostEvents(db, u.id, { types: ["event_review"] })).toHaveLength(1);

    // decision survives re-sync
    await syncCalendar(db, u.id, NOW);
    const after = (await listCalendarEvents(db, u.id, new Date(NOW.getTime() - 14 * 86_400_000), NOW)).find((e) => e.id === past.id)!;
    expect(after.status).toBe("confirmed_missed");

    // the user can correct their decision
    const fixed = await reviewEvent(db, u.id, past.id, "not_missed", new Date(NOW.getTime() + 1000));
    expect(fixed.status).toBe("not_missed");
  });

  it("cannot review another user's event", async () => {
    const a = await newUser(db, "UTC", NOW);
    const b = await newUser(db, "UTC", NOW);
    await completeConnect(db, a.id, "mock-demo-code", "v", NOW);
    await syncCalendar(db, a.id, NOW);
    const ev = (await listCalendarEvents(db, a.id, new Date(NOW.getTime() - 14 * 86_400_000), NOW))[0]!;
    await expect(reviewEvent(db, b.id, ev.id, "not_missed", NOW)).rejects.toMatchObject({ status: 404 });
  });

  it("disconnect wipes synced copies but keeps ghost history, and allows reconnecting", async () => {
    const u = await newUser(db, "UTC", NOW);
    await completeConnect(db, u.id, "mock-demo-code", "v", NOW);
    await syncCalendar(db, u.id, NOW);
    const ev = (await listCalendarEvents(db, u.id, new Date(NOW.getTime() - 14 * 86_400_000), NOW))[0]!;
    await reviewEvent(db, u.id, ev.id, "not_missed", NOW);
    await disconnect(db, u.id, NOW);
    expect(await getActiveConnection(db, u.id)).toBeNull();
    expect(await db.query("select 1 from calendar_events where user_id=$1", [u.id])).toHaveLength(0);
    const hist = await listGhostEvents(db, u.id, { types: ["event_review"] });
    expect(hist).toHaveLength(1);
    expect(hist[0]!.calendarEventId).toBeNull();
    expect((await connectionStatus(db, u.id)).connected).toBe(false);
    await completeConnect(db, u.id, "mock-demo-code", "v", NOW);
    expect((await connectionStatus(db, u.id)).connected).toBe(true);
  });

  it("syncing while disconnected is a clear conflict", async () => {
    const u = await newUser(db, "UTC", NOW);
    await expect(syncCalendar(db, u.id, NOW)).rejects.toMatchObject({ code: "calendar_not_connected" });
  });

  it("rejects a wrong demo code", async () => {
    const u = await newUser(db, "UTC", NOW);
    await expect(completeConnect(db, u.id, "nope", "v", NOW)).rejects.toMatchObject({ status: 400 });
  });
});

describe("Google provider (mocked HTTP)", () => {
  beforeEach(() =>
    setEnv({
      GOOGLE_CALENDAR_MOCK: "0",
      GOOGLE_CLIENT_ID: "cid",
      GOOGLE_CLIENT_SECRET: "csecret",
      GOOGLE_REDIRECT_URI: "http://localhost:3000/api/calendar/callback",
      TOKEN_ENCRYPTION_KEY: "a".repeat(64),
    }),
  );

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("builds a minimal-scope, PKCE, offline auth URL", () => {
    const { url, tx } = beginConnect("u", NOW.getTime());
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("scope")).toBe(CALENDAR_SCOPE);
    expect(u.searchParams.get("scope")).not.toMatch(/calendar$|calendar\.events$/); // never a write scope
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("state")).toBe(tx.state);
    expect(url).not.toContain("csecret");
  });

  it("exchanges the code, stores tokens encrypted, and rejects a missing scope", async () => {
    const u = await newUser(db, "UTC", NOW);
    const ok = vi.fn(async () => json({ access_token: "AT", refresh_token: "RT", expires_in: 3600, scope: CALENDAR_SCOPE }));
    await completeConnect(db, u.id, "code", "verifier", NOW, { fetchImpl: ok as never });
    const conn = (await getActiveConnection(db, u.id))!;
    expect(conn.encryptedTokens).toBeTruthy();
    expect(conn.encryptedTokens).not.toContain("AT");
    expect(conn.encryptedTokens).not.toContain("RT");
    expect(decryptJson<{ accessToken: string }>(conn.encryptedTokens!).accessToken).toBe("AT");
    const body = String((ok.mock.calls[0] as unknown[])[1] && ((ok.mock.calls[0] as unknown[])[1] as RequestInit).body);
    expect(body).toContain("code_verifier=verifier");

    const u2 = await newUser(db, "UTC", NOW);
    const wrongScope = vi.fn(async () => json({ access_token: "AT", scope: "https://www.googleapis.com/auth/userinfo.email" }));
    await expect(completeConnect(db, u2.id, "code", "v", NOW, { fetchImpl: wrongScope as never })).rejects.toMatchObject({ code: "oauth_scope_missing" });
    expect(await getActiveConnection(db, u2.id)).toBeNull();
  });

  async function connected(accessExpiresAt = NOW.getTime() + 3_600_000) {
    const u = await newUser(db, "UTC", NOW);
    const { upsertConnection } = await import("@/server/repositories/calendar.repo");
    await upsertConnection(db, { userId: u.id, providerAccountId: null, scopes: [CALENDAR_SCOPE], isDemo: false, encryptedTokens: encryptJson({ accessToken: "AT", refreshToken: "RT", expiresAt: accessExpiresAt }) }, NOW);
    return u;
  }

  const items = [
    { id: "e1", status: "confirmed", summary: "Timed", htmlLink: "https://www.google.com/calendar/event?eid=e1", start: { dateTime: "2026-11-01T10:00:00Z" }, end: { dateTime: "2026-11-01T11:00:00Z" } },
    { id: "r_20261101", status: "confirmed", summary: "Recurring", start: { dateTime: "2026-11-01T12:00:00Z" }, end: { dateTime: "2026-11-01T13:00:00Z" } },
    { id: "ad", status: "confirmed", summary: "All day", start: { date: "2026-11-01" }, end: { date: "2026-11-02" } },
  ];

  it("syncs across pages, sends only a Bearer token, and never requests descriptions", async () => {
    const u = await connected();
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push(String(url));
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer AT");
      expect(init?.method ?? "GET").toBe("GET");
      return String(url).includes("pageToken=p2") ? json({ items: [items[2]] }) : json({ items: [items[0], items[1]], nextPageToken: "p2" });
    });
    const r = await syncCalendar(db, u.id, NOW, { fetchImpl: fetchImpl as never });
    expect(r).toMatchObject({ fetched: 3, inserted: 3 });
    expect(calls[0]).toContain("singleEvents=true");
    expect(calls[0]).toContain("showDeleted=true");
    expect(decodeURIComponent(calls[0]!)).not.toMatch(/description|attendees/);
  });

  it("marks previously-synced events cancelled when Google reports them cancelled", async () => {
    const u = await connected();
    await syncCalendar(db, u.id, NOW, { fetchImpl: (async () => json({ items: [items[0]] })) as never });
    await syncCalendar(db, u.id, NOW, { fetchImpl: (async () => json({ items: [{ id: "e1", status: "cancelled" }] })) as never });
    const ev = (await listCalendarEvents(db, u.id, new Date("2026-10-01"), new Date("2026-11-30")))[0]!;
    expect(ev.status).toBe("cancelled");
  });

  it("refreshes an expired access token and persists the new one", async () => {
    const u = await connected(NOW.getTime() - 1000);
    const fetchImpl = vi.fn(async (url: string | URL) => {
      if (String(url).startsWith("https://oauth2.googleapis.com/token")) return json({ access_token: "AT2", expires_in: 3600 });
      return json({ items: [] });
    });
    await syncCalendar(db, u.id, NOW, { fetchImpl: fetchImpl as never });
    const conn = (await getActiveConnection(db, u.id))!;
    expect(decryptJson<{ accessToken: string }>(conn.encryptedTokens!).accessToken).toBe("AT2");
  });

  it("revoked access (invalid_grant) wipes credentials and asks to reconnect", async () => {
    const u = await connected(NOW.getTime() - 1000);
    const fetchImpl = vi.fn(async () => json({ error: "invalid_grant" }, 400));
    await expect(syncCalendar(db, u.id, NOW, { fetchImpl: fetchImpl as never })).rejects.toMatchObject({ code: "calendar_reauth_required" });
    expect(await getActiveConnection(db, u.id)).toBeNull();
  });

  it("a 401 from the API triggers one refresh, then a second 401 revokes", async () => {
    const u = await connected();
    let tokenCalls = 0;
    const fetchImpl = vi.fn(async (url: string | URL) => {
      if (String(url).startsWith("https://oauth2.googleapis.com/token")) {
        tokenCalls++;
        return json({ access_token: "AT3", expires_in: 3600 });
      }
      return json({}, 401);
    });
    await expect(syncCalendar(db, u.id, NOW, { fetchImpl: fetchImpl as never })).rejects.toMatchObject({ code: "calendar_reauth_required" });
    expect(tokenCalls).toBe(1);
  });

  it("provider outages degrade gracefully without touching stored data", async () => {
    const u = await connected();
    await syncCalendar(db, u.id, NOW, { fetchImpl: (async () => json({ items: [items[0]] })) as never });
    await expect(syncCalendar(db, u.id, NOW, { fetchImpl: (async () => json({}, 503)) as never })).rejects.toMatchObject({ status: 502, code: "calendar_unavailable" });
    await expect(syncCalendar(db, u.id, NOW, { fetchImpl: (async () => { throw new Error("network"); }) as never })).rejects.toMatchObject({ code: "calendar_unavailable" });
    expect((await listCalendarEvents(db, u.id, new Date("2026-10-01"), new Date("2026-11-30"))).length).toBe(1);
    expect((await connectionStatus(db, u.id)).connected).toBe(true);
  });

  it("disconnect revokes at Google and wipes the token column", async () => {
    const u = await connected();
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const r = await disconnect(db, u.id, NOW, { fetchImpl: fetchImpl as never });
    expect(r.revokedAtProvider).toBe(true);
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toBe("https://oauth2.googleapis.com/revoke");
    const rows = await db.query<{ encrypted_tokens: string | null }>("select encrypted_tokens from calendar_connections where user_id=$1", [u.id]);
    expect(rows.every((r) => r.encrypted_tokens === null)).toBe(true);
  });

  it("is reported as unconfigured in production without credentials", async () => {
    setEnv({ GOOGLE_CALENDAR_MOCK: undefined, GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined, SESSION_SECRET: "s".repeat(40), CRON_SECRET: "c".repeat(20) });
    const prev = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = "production";
    resetEnvCache();
    try {
      expect(() => beginConnect("u", 0)).toThrow(/not configured/);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = prev!;
      setEnv({ SESSION_SECRET: undefined, CRON_SECRET: undefined });
    }
  });
});

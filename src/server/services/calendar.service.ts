import { calendarMode } from "@/lib/env";
import type { Db } from "../db/types";
import { AppError, badRequest, conflict, notFound } from "../errors";
import * as calRepo from "../repositories/calendar.repo";
import * as ghostRepo from "../repositories/ghost-events.repo";
import { getProfile } from "../repositories/profiles.repo";
import { decryptJson, encryptJson } from "../integrations/google-calendar/crypto";
import {
  CALENDAR_SCOPE,
  buildAuthUrl,
  exchangeCode,
  newTransaction,
  refreshAccessToken,
  revokeToken,
  type OAuthTransaction,
  type StoredTokens,
} from "../integrations/google-calendar/oauth";
import { GoogleAuthError, listGoogleEvents } from "../integrations/google-calendar/api";
import { mockGoogleEvents } from "../integrations/google-calendar/mock";
import { effectiveEventStatus, normalizeGoogleEvent, type ReviewDecision } from "@/features/calendar/model";
import { logger } from "@/lib/logging/logger";

export interface Deps {
  fetchImpl?: typeof fetch;
}

const SYNC_PAST_DAYS = 30;
const SYNC_FUTURE_DAYS = 30;
const DAY = 86_400_000;

export function beginConnect(userId: string, nowMs: number): { tx: OAuthTransaction; url: string } {
  const mode = calendarMode();
  if (mode === "unconfigured") throw new AppError(503, "calendar_unconfigured", "Google Calendar is not configured on this server.");
  const tx = newTransaction(userId, nowMs);
  const url =
    mode === "mock"
      ? `/api/calendar/callback?${new URLSearchParams({ state: tx.state, code: "mock-demo-code" }).toString()}`
      : buildAuthUrl(tx);
  return { tx, url };
}

/** Completes OAuth (already validated). Stores encrypted tokens server-side; nothing sensitive returns to the browser. */
export async function completeConnect(db: Db, userId: string, code: string, verifier: string, now: Date, deps: Deps = {}) {
  const mode = calendarMode();
  if (mode === "mock") {
    if (code !== "mock-demo-code") throw badRequest("Unexpected demo authorisation code");
    return calRepo.upsertConnection(db, { userId, providerAccountId: "demo", encryptedTokens: null, scopes: [CALENDAR_SCOPE], isDemo: true }, now);
  }
  if (mode === "unconfigured") throw new AppError(503, "calendar_unconfigured", "Google Calendar is not configured on this server.");
  const { tokens, scopes } = await exchangeCode(code, verifier, now.getTime(), deps.fetchImpl);
  return calRepo.upsertConnection(db, { userId, providerAccountId: null, encryptedTokens: encryptJson(tokens), scopes, isDemo: false }, now);
}

export interface ConnectionStatus {
  mode: ReturnType<typeof calendarMode>;
  connected: boolean;
  isDemo: boolean;
  lastSyncedAt: string | null;
  scopes: string[];
}

export async function connectionStatus(db: Db, userId: string): Promise<ConnectionStatus> {
  const c = await calRepo.getActiveConnection(db, userId);
  return {
    mode: calendarMode(),
    connected: !!c,
    isDemo: c?.isDemo ?? calendarMode() === "mock",
    lastSyncedAt: c?.lastSyncedAt?.toISOString() ?? null,
    scopes: c?.scopes ?? [],
  };
}

async function accessTokenFor(db: Db, c: calRepo.CalendarConnection, now: Date, deps: Deps): Promise<{ token: string; refreshed: boolean }> {
  if (!c.encryptedTokens) throw new AppError(409, "calendar_reauth_required", "Reconnect Google Calendar to continue.");
  const tokens = decryptJson<StoredTokens>(c.encryptedTokens);
  if (tokens.expiresAt - 60_000 > now.getTime()) return { token: tokens.accessToken, refreshed: false };
  return { token: await refresh(db, c, tokens, now, deps), refreshed: true };
}

async function refresh(db: Db, c: calRepo.CalendarConnection, tokens: StoredTokens, now: Date, deps: Deps): Promise<string> {
  const next = await refreshAccessToken(tokens, now.getTime(), deps.fetchImpl);
  if (!next) {
    // Grant revoked or expired at Google: stop using the connection and wipe credentials.
    await calRepo.revokeConnection(db, c.id, now);
    throw new AppError(409, "calendar_reauth_required", "Google Calendar access was revoked or expired. Reconnect to continue.");
  }
  await calRepo.updateTokens(db, c.id, encryptJson(next));
  return next.accessToken;
}

export interface SyncResult {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
}

/** Pull-only synchronisation of a ±30-day window. Never writes to Google. */
export async function syncCalendar(db: Db, userId: string, now: Date, deps: Deps = {}): Promise<SyncResult> {
  const conn = await calRepo.getActiveConnection(db, userId);
  if (!conn) throw conflict("Google Calendar is not connected.", "calendar_not_connected");
  const profile = await getProfile(db, userId);
  if (!profile) throw notFound("Profile");

  const from = new Date(now.getTime() - SYNC_PAST_DAYS * DAY);
  const to = new Date(now.getTime() + SYNC_FUTURE_DAYS * DAY);

  let raw;
  if (conn.isDemo) {
    raw = mockGoogleEvents(now, profile.timezone);
  } else {
    const { token } = await accessTokenFor(db, conn, now, deps);
    try {
      raw = await listGoogleEvents(token, from, to, deps.fetchImpl);
    } catch (err) {
      if (!(err instanceof GoogleAuthError)) throw err;
      // Token rejected despite not being expired: refresh once and retry.
      const tokens = decryptJson<StoredTokens>(conn.encryptedTokens!);
      const fresh = await refresh(db, conn, tokens, now, deps);
      try {
        raw = await listGoogleEvents(fresh, from, to, deps.fetchImpl);
      } catch (err2) {
        if (err2 instanceof GoogleAuthError) {
          await calRepo.revokeConnection(db, conn.id, now);
          throw new AppError(409, "calendar_reauth_required", "Google Calendar access was revoked. Reconnect to continue.");
        }
        throw err2;
      }
    }
  }

  const result: SyncResult = { fetched: raw.length, inserted: 0, updated: 0, skipped: 0 };
  await db.transaction(async (tx) => {
    for (const r of raw) {
      const n = normalizeGoogleEvent(r, profile.timezone);
      if (!n) {
        result.skipped++;
        continue;
      }
      const outcome = await calRepo.upsertEvent(tx, userId, conn.id, n, now);
      result[outcome]++;
    }
    await calRepo.markSynced(tx, conn.id, `window:${from.toISOString()}/${to.toISOString()}`, now);
  });
  logger.info("calendar.synced", { userId, ...result });
  return result;
}

export async function listCalendarEvents(db: Db, userId: string, from: Date, to: Date) {
  if (!(from < to)) throw badRequest("`from` must be before `to`");
  if (to.getTime() - from.getTime() > 92 * DAY) throw badRequest("Date range may not exceed 92 days");
  return calRepo.listEvents(db, userId, from, to);
}

/**
 * Explicit user decision on a past event. Only an event that has ended and is not cancelled can be
 * classified — the application never infers "missed" on its own.
 */
export async function reviewEvent(db: Db, userId: string, eventId: string, decision: ReviewDecision, now: Date) {
  return db.transaction(async (tx) => {
    const ev = await calRepo.getEvent(tx, userId, eventId, true);
    if (!ev) throw notFound("Event");
    const status = effectiveEventStatus(ev.status, ev.endsAt, now);
    if (status === "cancelled") throw conflict("A cancelled event cannot be reviewed.", "invalid_event_state");
    if (status === "upcoming") throw conflict("This event has not ended yet.", "invalid_event_state");
    await calRepo.setReviewDecision(tx, ev.id, decision, now);
    await ghostRepo.insertGhostEventOnce(
      tx,
      {
        userId,
        calendarEventId: ev.id,
        eventType: "event_review",
        dedupeKey: `event_review:${ev.id}:${now.getTime()}`,
        occurredAt: now,
        payload: { decision, title: ev.title, endedAt: ev.endsAt.toISOString() },
      },
      now,
    );
    return (await calRepo.getEvent(tx, userId, eventId))!;
  });
}

/** Disconnect: revoke at Google (best effort), wipe credentials, delete synced copies. Ghost history is kept. */
export async function disconnect(db: Db, userId: string, now: Date, deps: Deps = {}): Promise<{ revokedAtProvider: boolean }> {
  const conn = await calRepo.getActiveConnection(db, userId);
  if (!conn) return { revokedAtProvider: false };
  let revokedAtProvider = false;
  if (conn.encryptedTokens) {
    try {
      revokedAtProvider = await revokeToken(decryptJson<StoredTokens>(conn.encryptedTokens), deps.fetchImpl);
    } catch {
      revokedAtProvider = false;
    }
  }
  await calRepo.revokeConnection(db, conn.id, now);
  return { revokedAtProvider };
}

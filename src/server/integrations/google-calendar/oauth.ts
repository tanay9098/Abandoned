import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env, sessionSecret } from "@/lib/env";
import { AppError } from "@/server/errors";

/** Minimum scope: read events only. Nothing here can create, edit or delete Calendar data. */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export const OAUTH_COOKIE = "abd_oauth";
export const OAUTH_TTL_SEC = 600;

export interface OAuthTransaction {
  state: string;
  verifier: string;
  userId: string;
  exp: number; // epoch seconds
}

const sign = (payload: string) => createHmac("sha256", sessionSecret()).update(`oauth:${payload}`).digest("base64url");

export function newTransaction(userId: string, nowMs: number): OAuthTransaction {
  return {
    state: randomBytes(32).toString("base64url"),
    verifier: randomBytes(48).toString("base64url"),
    userId,
    exp: Math.floor(nowMs / 1000) + OAUTH_TTL_SEC,
  };
}

export function encodeTransaction(t: OAuthTransaction): string {
  const payload = Buffer.from(JSON.stringify(t)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeTransaction(cookie: string | undefined): OAuthTransaction | null {
  if (!cookie) return null;
  const [payload, mac] = cookie.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const t = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthTransaction;
    return typeof t.state === "string" && typeof t.verifier === "string" && typeof t.userId === "string" && typeof t.exp === "number" ? t : null;
  } catch {
    return null;
  }
}

/**
 * Validates the OAuth callback against the signed transaction cookie.
 * Rejects: missing/forged/expired cookie, different signed-in user, state mismatch, provider errors.
 */
export function validateCallback(
  tx: OAuthTransaction | null,
  params: { state: string | null; code: string | null; error: string | null },
  sessionUserId: string,
  nowMs: number,
): { code: string; verifier: string } {
  if (params.error) throw new AppError(400, "oauth_denied", params.error === "access_denied" ? "Calendar access was not granted." : "Google reported an authorisation error.");
  if (!tx) throw new AppError(400, "oauth_state_missing", "Authorisation session not found. Start the connection again.");
  if (tx.exp * 1000 < nowMs) throw new AppError(400, "oauth_state_expired", "Authorisation session expired. Start the connection again.");
  if (tx.userId !== sessionUserId) throw new AppError(403, "oauth_user_mismatch", "This authorisation belongs to a different session.");
  const a = Buffer.from(params.state ?? "");
  const b = Buffer.from(tx.state);
  if (a.length === 0 || a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError(400, "oauth_state_mismatch", "Authorisation state did not match.");
  if (!params.code || params.code.length > 2048) throw new AppError(400, "oauth_code_missing", "No authorisation code was returned.");
  return { code: params.code, verifier: tx.verifier };
}

export function buildAuthUrl(tx: OAuthTransaction): string {
  const e = env();
  const challenge = createHash("sha256").update(tx.verifier).digest("base64url");
  const q = new URLSearchParams({
    client_id: e.GOOGLE_CLIENT_ID!,
    redirect_uri: e.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    state: tx.state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
  });
  return `${AUTH_URL}?${q.toString()}`;
}

export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // epoch ms
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}

async function postForm(fetchImpl: typeof fetch, url: string, body: Record<string, string>): Promise<{ status: number; json: TokenResponse }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
      signal: ctrl.signal,
    });
    const json = (await res.json().catch(() => ({}))) as TokenResponse;
    return { status: res.status, json };
  } catch {
    throw new AppError(502, "calendar_unavailable", "Google could not be reached. Try again shortly.");
  } finally {
    clearTimeout(timer);
  }
}

export async function exchangeCode(code: string, verifier: string, nowMs: number, fetchImpl: typeof fetch = fetch): Promise<{ tokens: StoredTokens; scopes: string[] }> {
  const e = env();
  const { status, json } = await postForm(fetchImpl, TOKEN_URL, {
    code,
    client_id: e.GOOGLE_CLIENT_ID!,
    client_secret: e.GOOGLE_CLIENT_SECRET!,
    redirect_uri: e.GOOGLE_REDIRECT_URI!,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  if (status !== 200 || !json.access_token) throw new AppError(400, "oauth_exchange_failed", "Google rejected the authorisation code.");
  const scopes = (json.scope ?? "").split(" ").filter(Boolean);
  if (!scopes.includes(CALENDAR_SCOPE)) throw new AppError(400, "oauth_scope_missing", "The required read-only Calendar permission was not granted.");
  return {
    tokens: { accessToken: json.access_token, refreshToken: json.refresh_token ?? null, expiresAt: nowMs + (json.expires_in ?? 3600) * 1000 },
    scopes,
  };
}

/** Returns new tokens, or null when the grant is gone (revoked / expired refresh token). */
export async function refreshAccessToken(tokens: StoredTokens, nowMs: number, fetchImpl: typeof fetch = fetch): Promise<StoredTokens | null> {
  if (!tokens.refreshToken) return null;
  const e = env();
  const { status, json } = await postForm(fetchImpl, TOKEN_URL, {
    client_id: e.GOOGLE_CLIENT_ID!,
    client_secret: e.GOOGLE_CLIENT_SECRET!,
    refresh_token: tokens.refreshToken,
    grant_type: "refresh_token",
  });
  if (status === 400 || status === 401) return null; // invalid_grant
  if (status !== 200 || !json.access_token) throw new AppError(502, "calendar_unavailable", "Google could not refresh access.");
  return { accessToken: json.access_token, refreshToken: tokens.refreshToken, expiresAt: nowMs + (json.expires_in ?? 3600) * 1000 };
}

/** Best-effort revocation at Google; local credentials are wiped regardless. */
export async function revokeToken(tokens: StoredTokens, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const { status } = await postForm(fetchImpl, REVOKE_URL, { token: tokens.refreshToken ?? tokens.accessToken });
    return status === 200;
  } catch {
    return false;
  }
}

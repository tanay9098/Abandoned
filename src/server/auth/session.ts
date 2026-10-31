import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecret, isProduction } from "@/lib/env";

/**
 * Auth mechanism (explicit choice, see Architecture §Auth): signed, httpOnly session cookies
 * bound to a server-side profile row. The seam is `getSessionUserId`; swapping in Supabase Auth
 * means replacing that one function. The browser never supplies a user id.
 */
export const SESSION_COOKIE = "abd_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mac(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function signSession(userId: string): string {
  return `${userId}.${mac(userId)}`;
}

export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const userId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(mac(userId));
  if (!UUID.test(userId) || given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return userId;
}

export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: isProduction(), path: "/", maxAge: SESSION_MAX_AGE };
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/auth/session";
import { OAUTH_COOKIE, decodeTransaction, validateCallback } from "@/server/integrations/google-calendar/oauth";
import { completeConnect, syncCalendar } from "@/server/services/calendar.service";
import { getDb } from "@/server/db";
import { resolveNow } from "@/server/clock";
import { AppError } from "@/server/errors";
import { logger } from "@/lib/logging/logger";


function back(req: Request, params: Record<string, string>) {
  const url = new URL("/calendar", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/** OAuth redirect target. Validates state, PKCE verifier, expiry and session binding before exchanging the code. */
export async function GET(req: Request) {
  const jar = await cookies();
  const sessionUser = verifySession(jar.get(SESSION_COOKIE)?.value);
  const tx = decodeTransaction(jar.get(OAUTH_COOKIE)?.value);
  jar.delete({ name: OAUTH_COOKIE, path: "/api/calendar" }); // single use, whatever happens next
  if (!sessionUser) return NextResponse.redirect(new URL("/login", req.url));
  const q = new URL(req.url).searchParams;
  const now = resolveNow(req);
  try {
    const { code, verifier } = validateCallback(tx, { state: q.get("state"), code: q.get("code"), error: q.get("error") }, sessionUser, now.getTime());
    const db = await getDb();
    await completeConnect(db, sessionUser, code, verifier, now);
    await syncCalendar(db, sessionUser, now).catch((e) => logger.warn("calendar.initial_sync_failed", { code: e instanceof AppError ? e.code : "unknown" }));
    return back(req, { connected: "1" });
  } catch (err) {
    const code = err instanceof AppError ? err.code : "oauth_failed";
    if (!(err instanceof AppError)) logger.error("calendar.callback_failed", { error: (err as Error).message });
    return back(req, { error: code });
  }
}

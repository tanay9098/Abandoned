import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { cookies } from "next/headers";
import { getDb } from "./db";
import type { Db } from "./db/types";
import { AppError, badRequest, forbidden, unauthorized } from "./errors";
import { SESSION_COOKIE, verifySession } from "./auth/session";
import { getProfile, type Profile } from "./repositories/profiles.repo";
import { resolveNow } from "./clock";
import { logger, newRequestId } from "@/lib/logging/logger";
import { env } from "@/lib/env";
import { timingSafeEqual } from "node:crypto";

export interface Ctx<P = Record<string, string>> {
  req: Request;
  db: Db;
  now: Date;
  params: P;
  requestId: string;
}
export interface UserCtx<P = Record<string, string>> extends Ctx<P> {
  userId: string;
  profile: Profile;
}

type RouteContext = { params?: Promise<Record<string, string>> };

export function json(data: unknown, init?: number | ResponseInit): NextResponse {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

function toErrorResponse(err: unknown, requestId: string): NextResponse {
  if (err instanceof AppError) {
    return json({ error: { code: err.code, message: err.message, details: err.details, requestId } }, err.status);
  }
  if (err instanceof ZodError) {
    return json(
      { error: { code: "invalid_request", message: "Invalid input", details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })), requestId } },
      400,
    );
  }
  logger.error("request.unhandled", { requestId, error: err instanceof Error ? err.message : String(err) });
  return json({ error: { code: "internal_error", message: "Something went wrong", requestId } }, 500);
}

/** CSRF defence for cookie auth: reject cross-origin state-changing requests. */
function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, tests) do not send Origin
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || new URL(origin).host !== host) throw forbidden("Cross-origin request rejected");
}

async function baseCtx(req: Request, rc: RouteContext): Promise<Ctx> {
  return { req, db: await getDb(), now: resolveNow(req), params: (await rc.params) ?? {}, requestId: newRequestId() };
}

export function userRoute<P = Record<string, string>>(fn: (c: UserCtx<P>) => Promise<NextResponse | Response>) {
  return async (req: Request, rc: RouteContext = {}) => {
    let requestId = "";
    try {
      const c = await baseCtx(req, rc);
      requestId = c.requestId;
      assertSameOrigin(req);
      const userId = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
      if (!userId) throw unauthorized();
      const profile = await getProfile(c.db, userId);
      if (!profile) throw unauthorized();
      return await fn({ ...(c as unknown as UserCtx<P>), userId, profile });
    } catch (err) {
      return toErrorResponse(err, requestId);
    }
  };
}

export function publicRoute<P = Record<string, string>>(fn: (c: Ctx<P>) => Promise<NextResponse | Response>) {
  return async (req: Request, rc: RouteContext = {}) => {
    let requestId = "";
    try {
      const c = await baseCtx(req, rc);
      requestId = c.requestId;
      assertSameOrigin(req);
      return await fn(c as unknown as Ctx<P>);
    } catch (err) {
      return toErrorResponse(err, requestId);
    }
  };
}

/** Scheduler endpoints: constant-time Bearer comparison with CRON_SECRET. */
export function jobRoute(fn: (c: Ctx) => Promise<NextResponse | Response>) {
  return async (req: Request, rc: RouteContext = {}) => {
    let requestId = "";
    try {
      const secret = env().CRON_SECRET;
      const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const ok = !!secret && secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
      if (!ok) return json({ error: { code: "unauthorized", message: "Invalid scheduler credentials" } }, 401);
      const c = await baseCtx(req, rc);
      requestId = c.requestId;
      return await fn(c);
    } catch (err) {
      return toErrorResponse(err, requestId);
    }
  };
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return schema.parse(body);
}

export function queryParam(req: Request, name: string): string | null {
  return new URL(req.url).searchParams.get(name);
}

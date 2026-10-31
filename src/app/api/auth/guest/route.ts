import { z } from "zod";
import { cookies } from "next/headers";
import { json, parseJson, publicRoute } from "@/server/http";
import { createProfile } from "@/server/repositories/profiles.repo";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/server/auth/session";
import { isValidTimeZone } from "@/lib/datetime/zone";
import { seedDemoData } from "@/server/services/demo.service";
import { AppError } from "@/server/errors";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ timezone: z.string().refine(isValidTimeZone, "Unknown IANA time zone"), seedDemo: z.boolean().optional() }).strict();

/** Creates a guest archive (profile + preferences) and signs the visitor in. */
export const POST = publicRoute(async ({ req, db, now }) => {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0]!.trim();
  const rl = rateLimit(`guest:${ip}`, 30, 3_600_000);
  if (!rl.ok) throw new AppError(429, "rate_limited", "Too many new archives from this address. Try again later.");
  const input = await parseJson(req, schema);
  const profile = await createProfile(db, input.timezone, now);
  if (input.seedDemo) await seedDemoData(db, profile.id, now);
  (await cookies()).set(SESSION_COOKIE, signSession(profile.id), sessionCookieOptions());
  return json({ user: { id: profile.id, timezone: profile.timezone } }, 201);
});

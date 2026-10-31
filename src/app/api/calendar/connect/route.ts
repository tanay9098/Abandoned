import { cookies } from "next/headers";
import { json, userRoute } from "@/server/http";
import { beginConnect } from "@/server/services/calendar.service";
import { OAUTH_COOKIE, OAUTH_TTL_SEC, encodeTransaction } from "@/server/integrations/google-calendar/oauth";
import { isProduction } from "@/lib/env";

/** Starts OAuth: stores a signed state+PKCE transaction in an httpOnly cookie and returns the URL to visit. */
export const POST = userRoute(async ({ userId, now }) => {
  const { tx, url } = beginConnect(userId, now.getTime());
  (await cookies()).set(OAUTH_COOKIE, encodeTransaction(tx), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/api/calendar",
    maxAge: OAUTH_TTL_SEC,
  });
  return json({ url });
});

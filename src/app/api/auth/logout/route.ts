import { cookies } from "next/headers";
import { json, publicRoute } from "@/server/http";
import { SESSION_COOKIE } from "@/server/auth/session";

export const POST = publicRoute(async () => {
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true });
});

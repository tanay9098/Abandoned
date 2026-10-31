import { env } from "@/lib/env";

/**
 * Server "now". Production always uses the real clock. For automated end-to-end tests only,
 * `ABANDONMENT_ALLOW_TEST_CLOCK=1` lets a request carry `X-Test-Now: <ISO instant>` so deadlines can be
 * simulated without waiting. The flag is refused outright when NODE_ENV=production and VERCEL_ENV=production.
 */
export function resolveNow(req?: Request): Date {
  const e = env();
  const allowed = e.ABANDONMENT_ALLOW_TEST_CLOCK === "1" && process.env.VERCEL_ENV !== "production";
  const header = allowed ? req?.headers.get("x-test-now") : null;
  if (header) {
    const t = Date.parse(header);
    if (!Number.isNaN(t)) return new Date(t);
  }
  return new Date();
}

/**
 * Fixed-window in-memory limiter. Adequate for a single instance and for protecting the
 * (optional) AI endpoint from accidental loops; a multi-instance deployment should move this
 * to a shared store. Documented limitation.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return { ok: true, retryAfterSec: 0 };
  }
  b.count++;
  return b.count <= limit ? { ok: true, retryAfterSec: 0 } : { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

export function resetRateLimits() {
  buckets.clear();
}

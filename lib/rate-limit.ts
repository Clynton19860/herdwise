import "server-only";

/**
 * A sliding-window rate limiter held in process memory.
 *
 * Honest about what this is: on serverless each instance keeps its own counters,
 * so the effective limit is per-instance rather than global. That still stops
 * casual abuse and runaway clients, which is what an unauthenticated endpoint
 * most needs protecting from. It is *not* a substitute for authentication, and
 * once auth exists the limit should move to a per-user key in the database.
 */

type Window = { hits: number[]; };

const buckets = new Map<string, Window>();

/** Keep the map from growing without bound on a long-lived instance. */
const MAX_KEYS = 5_000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (buckets.size > MAX_KEYS) buckets.clear();

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

/**
 * Best available caller identity behind a proxy.
 *
 * Vercel sets `x-forwarded-for`; the left-most entry is the client. Falls back
 * to a single shared bucket rather than to a per-request unique value, so a
 * missing header tightens the limit instead of disabling it.
 */
export function callerKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim();
  return ip || "unknown";
}

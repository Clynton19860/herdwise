import { createGeofence } from "@/lib/db";
import { callerKey, rateLimit } from "@/lib/rate-limit";
import { permit } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a management zone.
 *
 * There is no authentication yet, so this endpoint is reachable by anyone who
 * can reach the site. The rate limit is what stands between that and someone
 * filling the table; it is a stopgap, not a substitute for auth.
 *
 * A failure is reported as a failure. The wizard this replaces waited 1.3
 * seconds, invented a reference number and declared the zone published, which
 * is the one outcome worse than an error message.
 */
const MAX_VERTICES = 500;

export async function POST(req: Request) {
  const allowed = await permit(req, "write", "geofences");
  if (!allowed.ok) return allowed.response;


  const limit = rateLimit(callerKey(req), { limit: 12, windowSeconds: 60 });
  if (!limit.ok) {
    return Response.json(
      { error: `Too many zones created — try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let body: {
    name?: string; type?: string; ward?: string | null;
    capacity?: number | null; ring?: [number, number][];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const ring = body.ring;

  if (!name) return Response.json({ error: "Give the zone a name." }, { status: 400 });
  if (!Array.isArray(ring) || ring.length < 3) {
    return Response.json({ error: "Draw at least three points on the map." }, { status: 400 });
  }
  if (ring.length > MAX_VERTICES) {
    return Response.json({ error: "That outline has too many points." }, { status: 400 });
  }
  for (const point of ring) {
    const [lng, lat] = point ?? [];
    if (typeof lng !== "number" || typeof lat !== "number" ||
        lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return Response.json({ error: "The outline contains an invalid coordinate." }, { status: 400 });
    }
  }

  try {
    const zone = await createGeofence({
      name,
      type: body.type ?? "grazing",
      ring,
      wardName: body.ward ?? null,
      capacity: body.capacity ?? null,
    });
    return Response.json(zone, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The browser-facing database role is read-only apart from land parcels, so
    // this is the expected failure until a write grant is added. Say which it is
    // rather than reporting a generic server error.
    if (/permission denied/i.test(message)) {
      return Response.json(
        { error: "This deployment cannot create zones yet — the database role is read-only." },
        { status: 503 },
      );
    }
    return Response.json({ error: "Could not save the zone." }, { status: 500 });
  }
}

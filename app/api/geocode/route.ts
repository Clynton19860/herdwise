import { callerKey, rateLimit } from "@/lib/rate-limit";
import { permit } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Find a place by name, so a field can be drawn where it actually is.
 *
 * Marking out a paddock meant panning across Harare by hand until you
 * recognised a roof. An officer registering a farm in Hatcliffe knows the suburb
 * or the road, not the coordinates, and had no way to tell the map either.
 *
 * Proxied rather than called from the browser for three reasons: OpenStreetMap's
 * Nominatim asks for an identifying User-Agent, which a browser will not let us
 * set; their usage policy expects one request per second, which is enforced here
 * where it can be; and it keeps the search behind our own session, so this is
 * not an open geocoding endpoint for anyone who finds the URL.
 *
 * Results are biased to Zimbabwe, with South Africa included because the pilot
 * hardware is bench-tested in Johannesburg and a zone drawn there has to be
 * findable too.
 */
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const COUNTRIES = "zw,za";

export async function GET(req: Request) {
  const allowed = await permit(req, "read", "geofences");
  if (!allowed.ok) return allowed.response;

  // Nominatim's policy is one call a second. This is per signed-in caller,
  // which is stricter than the policy for any single person and keeps a stuck
  // keystroke handler from getting the whole deployment blocked.
  const limit = rateLimit(`geocode:${callerKey(req)}`, { limit: 20, windowSeconds: 60 });
  if (!limit.ok) {
    return Response.json(
      { error: `Searching too fast — try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 3) return Response.json({ results: [] });

  const url = `${NOMINATIM}?${new URLSearchParams({
    q, format: "jsonv2", limit: "6", countrycodes: COUNTRIES, addressdetails: "1",
  })}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Herdwise/1.0 (City of Harare livestock platform)",
        "Accept-Language": "en",
      },
      // A slow geocoder must not hold a request open indefinitely.
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      console.error(`[geocode] ${res.status} for ${q}`);
      return Response.json({ results: [], error: "Search is unavailable." }, { status: 502 });
    }

    const raw = (await res.json()) as {
      display_name?: string; lat?: string; lon?: string;
      name?: string; type?: string; boundingbox?: string[];
    }[];

    return Response.json({
      results: raw
        .filter((r) => r.lat && r.lon)
        .map((r) => ({
          label: r.display_name ?? r.name ?? q,
          // The first part of the display name is what people recognise; the
          // rest is the administrative trail and belongs in smaller print.
          name: (r.display_name ?? "").split(",")[0] || (r.name ?? q),
          lat: Number(r.lat),
          lng: Number(r.lon),
          kind: r.type ?? null,
          // South-west and north-east corners, so the map can frame a suburb
          // rather than drop a pin in the middle of it.
          bounds: r.boundingbox?.length === 4
            ? {
                south: Number(r.boundingbox[0]), north: Number(r.boundingbox[1]),
                west: Number(r.boundingbox[2]), east: Number(r.boundingbox[3]),
              }
            : null,
        })),
    });
  } catch (e) {
    console.error(`[geocode] ${String(e)}`);
    return Response.json({ results: [], error: "Search is unavailable." }, { status: 502 });
  }
}

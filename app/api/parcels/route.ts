import { createParcel, getMapParcels } from "@/lib/db";

export const dynamic = "force-dynamic";

type Body = { name?: string; tenure?: string; ring?: [number, number][] };

/**
 * Save a field allocation drawn on the map.
 *
 * Writes go through the server's privileged connection, never the browser's
 * anon key — the anon role has read access only (migration 0005), so a drawn
 * parcel cannot be forged from the client.
 */
/** Existing allocations, so a new zone can be drawn in context. */
export async function GET() {
  return Response.json(await getMapParcels(), { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const ring = body.ring;

  if (!name) return Response.json({ error: "name is required" }, { status: 400 });
  if (!Array.isArray(ring) || ring.length < 4) {
    return Response.json({ error: "a closed ring needs at least 4 points" }, { status: 400 });
  }
  const bad = ring.find(
    (p) => !Array.isArray(p) || p.length !== 2 ||
      !Number.isFinite(p[0]) || !Number.isFinite(p[1]) ||
      Math.abs(p[1]) > 90 || Math.abs(p[0]) > 180,
  );
  if (bad) return Response.json({ error: "coordinates out of range" }, { status: 400 });

  try {
    const parcel = await createParcel({ name, tenure: body.tenure ?? "communal", ring });
    return Response.json(parcel, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[parcels] create failed:", message);
    return Response.json({ error: message }, { status: 400 });
  }
}

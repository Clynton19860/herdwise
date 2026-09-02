import { assignDevice, getUnclaimedDevices } from "@/lib/db";
import { requireStaff, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tags reporting to the gateway that belong to no animal yet. */
export async function GET(req: Request) {
  const me = await requireStaff(req);
  if (!me) return unauthorized();
  return Response.json(await getUnclaimedDevices());
}

/**
 * Claim a tag for an animal, or release one.
 *
 * `animalId: null` detaches — a tag taken off an animal that has been sold or
 * died becomes claimable again rather than being deleted, because its history of
 * positions stays attached to the animal it was on at the time.
 */
export async function POST(req: Request) {
  const me = await requireStaff(req);
  if (!me) return unauthorized();
  if (me.role !== "officer" && me.role !== "admin") {
    return Response.json({ error: "You cannot assign tags." }, { status: 403 });
  }

  let body: { deviceId?: string; animalId?: string | null };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.deviceId) {
    return Response.json({ error: "Choose a tag." }, { status: 400 });
  }

  try {
    const updated = await assignDevice(body.deviceId, body.animalId ?? null);
    if (!updated) return Response.json({ error: "No such tag." }, { status: 404 });
    return Response.json(updated);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    // One tag, one animal. The unique constraint is what stops two animals
    // sharing a device and therefore sharing a position history.
    if (/devices_animal_id_key/.test(m)) {
      return Response.json(
        { error: "That animal already has a tag. Release it first." },
        { status: 409 },
      );
    }
    console.error("[devices] assign failed:", m);
    return Response.json({ error: "Could not assign the tag." }, { status: 500 });
  }
}

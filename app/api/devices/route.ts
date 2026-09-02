import {
  animalBelongsTo, assignDevice, deviceClaimableBy,
  getClaimableDevices, getUnclaimedDevices,
} from "@/lib/db";
import { unauthorized } from "@/lib/api-auth";
import { principalFromRequest } from "@/lib/principal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tags reporting to the gateway that belong to no animal yet. */
export async function GET(req: Request) {
  const me = await principalFromRequest(req);
  if (!me) return unauthorized();
  // A farmer sees unclaimed tags and his own. Another farmer's tags are not his
  // to see, let alone to take.
  return Response.json(
    me.kind === "owner" ? await getClaimableDevices(me.id) : await getUnclaimedDevices(),
  );
}

/**
 * Claim a tag for an animal, or release one.
 *
 * `animalId: null` detaches — a tag taken off an animal that has been sold or
 * died becomes claimable again rather than being deleted, because its history of
 * positions stays attached to the animal it was on at the time.
 */
export async function POST(req: Request) {
  const me = await principalFromRequest(req);
  if (!me) return unauthorized();
  if (me.kind === "staff" && me.role !== "officer" && me.role !== "admin") {
    return Response.json({ error: "You cannot assign tags." }, { status: 403 });
  }

  let body: { deviceId?: string; animalId?: string | null };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.deviceId) {
    return Response.json({ error: "Choose a tag." }, { status: 400 });
  }

  if (me.kind === "owner") {
    // Both ends have to be his: the tag must be free or already his, and the
    // animal he is attaching it to must be his.
    if (!(await deviceClaimableBy(body.deviceId, me.id))) {
      return Response.json({ error: "That tag belongs to another owner." }, { status: 403 });
    }
    if (body.animalId && !(await animalBelongsTo(body.animalId, me.id))) {
      return Response.json({ error: "That is not one of your animals." }, { status: 403 });
    }
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

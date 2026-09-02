import { assignDevice, createAnimal, getDeviceByImei } from "@/lib/db";
import { unauthorized } from "@/lib/api-auth";
import { principalFromRequest } from "@/lib/principal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPECIES = new Set(["cattle", "goat", "sheep", "donkey", "pig"]);
const SEX = new Set(["male", "female"]);

/** Register an animal against an owner. */
export async function POST(req: Request) {
  const me = await principalFromRequest(req);
  if (!me) return unauthorized();

  let b: Record<string, string | null | undefined>;
  try { b = await req.json(); } catch { return bad("Invalid request."); }

  const tag = (b.tag ?? "").toString().trim();
  const species = (b.species ?? "").toString().toLowerCase();
  // A farmer registers against himself and nobody else. Taking the owner from
  // the body for an owner principal would let him file an animal under another
  // farmer's name.
  const ownerId = me.kind === "owner" ? me.id : (b.ownerId ?? "").toString();

  if (!tag) return bad("Enter the ear tag number.");
  if (!SPECIES.has(species)) return bad("Choose a species.");
  if (!ownerId) return bad("Choose an owner.");
  const sex = (b.sex ?? "").toString().toLowerCase();
  if (sex && !SEX.has(sex)) return bad("Sex must be male or female.");

  try {
    const animal = await createAnimal({
      tag, species, ownerId,
      name: b.name ?? null, breed: b.breed ?? null, sex: sex || null,
      birthDate: b.birthDate ?? null, colour: b.colour ?? null,
      parcelName: b.parcel ?? null,
    });
    // If the officer typed the IMEI printed on the tag, claim it now. A tag that
    // has not dialled in yet has no device row, so this is reported rather than
    // failing the registration — the animal is registered either way, and the
    // tag can be claimed from its page once it reports.
    let tagLinked: string | null = null;
    const imei = (b.imei ?? "").toString().trim();
    if (imei) {
      const device = await getDeviceByImei(imei);
      if (device && !device.animal_id) {
        await assignDevice(device.id, animal.id);
        tagLinked = "linked";
      } else {
        tagLinked = device ? "already_assigned" : "not_reporting_yet";
      }
    }

    return Response.json({ ...animal, tagLinked }, { status: 201 });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/animals_tag_key/.test(m)) {
      return Response.json({ error: "That ear tag is already registered." }, { status: 409 });
    }
    if (/animals_owner_id_fkey/.test(m)) {
      return Response.json({ error: "That owner no longer exists." }, { status: 400 });
    }
    console.error("[animals] create failed:", m);
    return Response.json({ error: "Could not save the animal." }, { status: 500 });
  }
}

const bad = (error: string) => Response.json({ error }, { status: 400 });

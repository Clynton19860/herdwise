import { createAnimal } from "@/lib/db";
import { requireStaff, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPECIES = new Set(["cattle", "goat", "sheep", "donkey", "pig"]);
const SEX = new Set(["male", "female"]);

/** Register an animal against an owner. */
export async function POST(req: Request) {
  const me = await requireStaff(req);
  if (!me) return unauthorized();

  let b: Record<string, string | null | undefined>;
  try { b = await req.json(); } catch { return bad("Invalid request."); }

  const tag = (b.tag ?? "").toString().trim();
  const species = (b.species ?? "").toString().toLowerCase();
  const ownerId = (b.ownerId ?? "").toString();

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
    return Response.json(animal, { status: 201 });
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

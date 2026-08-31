import { updateAnimal } from "@/lib/db";
import { requireStaff, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEX = new Set(["male", "female"]);
const STATUS = new Set(["healthy", "monitoring", "alert", "quarantined", "deceased"]);

/**
 * Correct an animal's record, or move it to another allocation.
 *
 * The ear tag is not editable. It identifies a physical object, and changing it
 * would silently reassign every position, breach and health record already
 * filed against it.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireStaff(req);
  if (!me) return unauthorized();
  if (me.role !== "officer" && me.role !== "admin" && me.role !== "vet") {
    return Response.json({ error: "You cannot edit animal records." }, { status: 403 });
  }

  const { id } = await ctx.params;
  let b: Record<string, string | null | undefined>;
  try { b = await req.json(); } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const sex = b.sex?.toString().toLowerCase();
  const status = b.status?.toString().toLowerCase();
  if (sex && !SEX.has(sex)) return Response.json({ error: "Sex must be male or female." }, { status: 400 });
  if (status && !STATUS.has(status)) return Response.json({ error: "Unknown status." }, { status: 400 });

  const updated = await updateAnimal(id, {
    name: b.name ?? undefined, breed: b.breed ?? undefined, sex: sex ?? undefined,
    birthDate: b.birthDate ?? undefined, colour: b.colour ?? undefined,
    status: status ?? undefined, parcelName: b.parcel ?? undefined,
  });
  if (!updated) return Response.json({ error: "No such animal." }, { status: 404 });
  return Response.json(updated);
}

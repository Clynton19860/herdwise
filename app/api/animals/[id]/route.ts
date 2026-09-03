import { animalBelongsTo, deleteAnimal, updateAnimal } from "@/lib/db";
import { unauthorized } from "@/lib/api-auth";
import { principalFromRequest } from "@/lib/principal";
import { permit } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEX = new Set(["male", "female"]);
const STATUS = new Set(["healthy", "monitoring", "alert", "quarantined", "deceased"]);

/**
 * Correct an animal's record, or move it to another allocation.
 *
 * The ear tag is editable. Positions, breaches and health records all reference
 * the animal's id, so the tag is the number printed on the plastic rather than
 * a key — and when a tag is damaged and replaced in the field, the record has to
 * follow. Uniqueness is enforced by the index.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const allowed = await permit(req, "write", "livestock");
  if (!allowed.ok) return allowed.response;
  const me = allowed.me;

  const { id } = await ctx.params;

  if (me.kind === "owner") {
    // Answered from the row's owner_id rather than from which page asked.
    if (!(await animalBelongsTo(id, me.id))) {
      return Response.json({ error: "That is not one of your animals." }, { status: 403 });
    }
  } else if (me.role !== "officer" && me.role !== "admin" && me.role !== "vet") {
    return Response.json({ error: "You cannot edit animal records." }, { status: 403 });
  }
  let b: Record<string, string | null | undefined>;
  try { b = await req.json(); } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const sex = b.sex?.toString().toLowerCase();
  const status = b.status?.toString().toLowerCase();
  if (sex && !SEX.has(sex)) return Response.json({ error: "Sex must be male or female." }, { status: 400 });
  if (status && !STATUS.has(status)) return Response.json({ error: "Unknown status." }, { status: 400 });

  const tag = b.tag?.toString().trim();
  if (tag !== undefined && !tag) {
    return Response.json({ error: "An ear tag cannot be blank." }, { status: 400 });
  }

  try {
    const updated = await updateAnimal(id, {
      tag,
        name: b.name ?? undefined, breed: b.breed ?? undefined, sex: sex ?? undefined,
      birthDate: b.birthDate ?? undefined, colour: b.colour ?? undefined,
      status: status ?? undefined, parcelName: b.parcel ?? undefined,
    });
    if (!updated) return Response.json({ error: "No such animal." }, { status: 404 });
    return Response.json(updated);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/animals_tag_key/.test(m)) {
      return Response.json(
        { error: "Another animal is already registered with that ear tag." },
        { status: 409 },
      );
    }
    console.error("[animals] update failed:", m);
    return Response.json({ error: "Could not save the change." }, { status: 500 });
  }
}

/**
 * Remove an animal from the register, releasing its ear tag.
 *
 * Restricted to an administrator on the council side, and to the owner for
 * their own animals. A field officer can correct a record but not erase one:
 * removing an animal from a municipal register is a different kind of act from
 * fixing a mistyped colour, and the two should not share a permission.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await principalFromRequest(req);
  if (!me) return unauthorized();

  const { id } = await ctx.params;

  if (me.kind === "owner") {
    if (!(await animalBelongsTo(id, me.id))) {
      return Response.json({ error: "That is not one of your animals." }, { status: 403 });
    }
  } else if (me.role !== "admin") {
    return Response.json(
      { error: "Only an administrator can remove an animal from the register." },
      { status: 403 },
    );
  }

  const removed = await deleteAnimal(id);
  if (!removed) return Response.json({ error: "No such animal." }, { status: 404 });

  return Response.json({
    ok: true,
    tag: removed.tag,
    releasedImei: removed.releasedImei,
    note: removed.releasedImei
      ? `${removed.tag} removed. Tag ${removed.releasedImei} is now unassigned.`
      : `${removed.tag} removed.`,
  });
}

import { updateOwner } from "@/lib/db";
import { requireStaff, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Correct an owner's details. Identity keys are not editable here. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireStaff(req);
  if (!me) return unauthorized();
  if (me.role !== "officer" && me.role !== "admin") {
    return Response.json({ error: "You cannot edit owner records." }, { status: 403 });
  }

  const { id } = await ctx.params;
  let b: Record<string, string | null | undefined>;
  try { b = await req.json(); } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const fullName = b.fullName?.toString().trim();
  const phone = b.phone?.toString().trim();
  if (fullName !== undefined && !fullName) {
    return Response.json({ error: "A name cannot be blank." }, { status: 400 });
  }
  if (phone !== undefined && !phone) {
    return Response.json({ error: "A contact number cannot be blank." }, { status: 400 });
  }

  const updated = await updateOwner(id, {
    fullName, phone, address: b.address ?? undefined, wardName: b.ward ?? undefined,
  });
  if (!updated) return Response.json({ error: "No such owner." }, { status: 404 });
  return Response.json(updated);
}

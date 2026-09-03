import { updateOwner } from "@/lib/db";
import { permit } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Correct an owner's details. Identity keys are not editable here. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const allowed = await permit(req, "write", "owners");
  if (!allowed.ok) return allowed.response;
  const me = allowed.me.kind === "staff" ? allowed.me.staff : null;
  if (!me) {
    return Response.json(
      { error: "This is a council function." },
      { status: 403 },
    );
  }
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

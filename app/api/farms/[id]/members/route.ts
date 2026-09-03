import { addFarmMember, farmRoleOf, getFarmMembers, removeFarmMember } from "@/lib/db";
import { sendInviteCode } from "@/lib/supabase-auth";
import { emailIsFree } from "@/lib/db";
import { principalFromRequest } from "@/lib/principal";
import { permit } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = new Set(["manager", "herdsman", "vet"]);
const bad = (error: string, status = 400) => Response.json({ error }, { status });

/** Who works on this farm. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const allowed = await permit(req, "read", "people");
  if (!allowed.ok) return allowed.response;

  const me = await principalFromRequest(req);
  if (me?.kind !== "owner") return bad("Sign in to continue.", 401);
  const { id } = await ctx.params;
  if (!(await farmRoleOf(me.id, id))) return bad("That is not one of your farms.", 403);
  return Response.json(await getFarmMembers(id));
}

/**
 * Appoint somebody to this farm.
 *
 * The owner and anyone they have made a manager may appoint. `owner` is not an
 * assignable role — it belongs to whoever created the farm, and handing it out
 * from here would let a manager quietly take the place over.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const allowed = await permit(req, "write", "people");
  if (!allowed.ok) return allowed.response;

  const me = await principalFromRequest(req);
  if (me?.kind !== "owner") return bad("Sign in to continue.", 401);

  const { id } = await ctx.params;
  const myRole = await farmRoleOf(me.id, id);
  if (!myRole) return bad("That is not one of your farms.", 403);
  if (myRole !== "owner" && myRole !== "manager") {
    return bad("Only the owner or a manager can appoint people.", 403);
  }

  let b: { fullName?: string; email?: string; role?: string; phone?: string };
  try { b = await req.json(); } catch { return bad("Invalid request."); }

  const fullName = (b.fullName ?? "").trim();
  const email = (b.email ?? "").trim().toLowerCase();
  const role = (b.role ?? "herdsman").toLowerCase();

  if (!fullName) return bad("Enter their name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("Enter a valid email address.");
  if (!ROLES.has(role)) return bad("Choose a role.");

  // An address already belonging to municipal staff cannot become a farm
  // account — sign-in resolves a principal by address, and ambiguity there is
  // somebody seeing the wrong herd.
  const free = await emailIsFree(email);
  const existingMembers = await getFarmMembers(id);
  const alreadyHere = existingMembers.some((m) => m.email?.toLowerCase() === email);
  if (!free && !alreadyHere) {
    return bad("That address already belongs to another account.", 409);
  }

  const { personId } = await addFarmMember({ farmId: id, fullName, email, role, phone: b.phone ?? "" });
  const sent = alreadyHere ? { ok: true } : await sendInviteCode(email);

  return Response.json({
    personId,
    invited: sent.ok,
    note: alreadyHere
      ? `${fullName} is now a ${role} on this farm.`
      : sent.ok
        ? `Invitation sent to ${email}.`
        : `Added, but the invitation email could not be sent — Supabase allows two an hour.`,
  });
}

/** Remove somebody. The owner cannot be removed from their own farm. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await principalFromRequest(req);
  if (me?.kind !== "owner") return bad("Sign in to continue.", 401);

  const { id } = await ctx.params;
  const myRole = await farmRoleOf(me.id, id);
  if (myRole !== "owner" && myRole !== "manager") {
    return bad("Only the owner or a manager can remove people.", 403);
  }

  const personId = new URL(req.url).searchParams.get("person");
  if (!personId) return bad("Which person?");

  await removeFarmMember(id, personId);
  return Response.json({ ok: true });
}

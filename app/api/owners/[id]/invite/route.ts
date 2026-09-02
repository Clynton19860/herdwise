import { emailIsFree, getOwner, setOwnerEmail } from "@/lib/db";
import { sendInviteCode } from "@/lib/supabase-auth";
import { requireStaff, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Give a registered owner an account.
 *
 * Owners exist in the register long before any of them signs in — an officer
 * records a farmer when animals are tagged, and most will never hold an account.
 * This attaches an address to one who should, and sends the same branded
 * six-digit code staff receive.
 *
 * The address must belong to nobody else, staff or owner. Sign-in resolves a
 * principal by email, so a shared address would make it ambiguous which of the
 * two was meant — and ambiguity there is somebody seeing the wrong herd.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireStaff(req);
  if (!me) return unauthorized();
  if (me.role !== "officer" && me.role !== "admin") {
    return Response.json({ error: "You cannot invite owners." }, { status: 403 });
  }

  const { id } = await ctx.params;
  let body: { email?: string };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const owner = await getOwner(id);
  if (!owner) return Response.json({ error: "No such owner." }, { status: 404 });

  if (!(await emailIsFree(email))) {
    return Response.json(
      { error: "That address already belongs to an account." },
      { status: 409 },
    );
  }

  await setOwnerEmail(owner.id, email);
  const sent = await sendInviteCode(email);

  return Response.json({
    id: owner.id,
    invited: sent.ok,
    // The address is saved either way, so an administrator knows whether to
    // expect the email or to try again — Supabase allows two an hour.
    note: sent.ok
      ? `Invitation sent to ${email}.`
      : `Address saved, but the invitation email could not be sent — Supabase allows two an hour. Try again shortly.`,
  });
}

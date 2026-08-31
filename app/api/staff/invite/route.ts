import { createStaff, getStaffByEmail } from "@/lib/db";
import { sendInviteCode } from "@/lib/supabase-auth";
import { requireStaff, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = new Set(["officer", "vet", "admin"]);

/**
 * Invite a colleague. Administrators only.
 *
 * Unlike the sign-in and reset endpoints, this one does say when an address is
 * already registered — the caller is a signed-in administrator who can see the
 * staff list anyway, and silently doing nothing would leave them believing an
 * invitation had been sent.
 */
export async function POST(req: Request) {
  const me = await requireStaff(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") {
    return Response.json({ error: "Only administrators can add staff." }, { status: 403 });
  }

  let body: { fullName?: string; email?: string; role?: string; ward?: string | null };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const fullName = (body.fullName ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const role = (body.role ?? "officer").toLowerCase();

  if (!fullName) return Response.json({ error: "Enter their name." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!ROLES.has(role)) return Response.json({ error: "Unknown role." }, { status: 400 });

  if (await getStaffByEmail(email)) {
    return Response.json({ error: "Somebody is already registered with that address." }, { status: 409 });
  }

  const created = await createStaff({ fullName, email, role, wardName: body.ward ?? null });
  const sent = await sendInviteCode(email);

  return Response.json({
    id: created.id,
    // Said plainly: the staff row exists either way, and an administrator needs
    // to know whether to expect the email to arrive or to resend later.
    invited: sent.ok,
    note: sent.ok
      ? "Invitation sent."
      : "Account created, but the invitation email could not be sent — Supabase allows two an hour.",
  });
}

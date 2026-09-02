import { getOwnerAccountByEmail, getStaffByEmail, setOwnerPassword, setStaffPassword } from "@/lib/db";
import { hashPassword, readChallenge } from "@/lib/auth";
import { checkSignInCode } from "@/lib/supabase-auth";
import { callerKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Finish a reset or an invitation: prove the code, then choose a password.
 *
 * `flow` decides which kind of code Supabase is asked to check. A recovery code
 * cannot complete an invitation and vice versa, which matters because the two
 * arrive in different emails saying different things.
 */
const MIN_PASSWORD = 10;

export async function POST(req: Request) {
  const limit = rateLimit(`setpw:${callerKey(req)}`, { limit: 12, windowSeconds: 900 });
  if (!limit.ok) {
    return Response.json(
      { error: `Too many attempts — try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let body: { challenge?: string; code?: string; password?: string; flow?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const claim = readChallenge(body.challenge);
  const code = (body.code ?? "").trim();
  const password = body.password ?? "";
  const flow = body.flow === "invite" ? "signup" : "recovery";

  if (!claim) {
    return Response.json({ error: "That request expired. Start again." }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return Response.json({ error: "Enter the six-digit code." }, { status: 400 });
  }
  // Length is the only rule worth enforcing. Composition rules push people
  // toward predictable substitutions and away from longer passphrases.
  if (password.length < MIN_PASSWORD) {
    return Response.json(
      { error: `Choose a password of at least ${MIN_PASSWORD} characters.` },
      { status: 400 },
    );
  }

  // One address, one principal — so this is a lookup rather than a choice.
  const staff = await getStaffByEmail(claim.email);
  const owner = staff ? null : await getOwnerAccountByEmail(claim.email);
  if ((!staff || !staff.active) && !owner) {
    return Response.json({ error: "That code is not right or has expired." }, { status: 401 });
  }
  if (!(await checkSignInCode(claim.email, code, flow))) {
    return Response.json({ error: "That code is not right or has expired." }, { status: 401 });
  }

  const hash = await hashPassword(password);
  if (staff) await setStaffPassword(staff.id, hash);
  else if (owner) await setOwnerPassword(owner.id, hash);

  // Deliberately no session. Signing in afterwards proves the new password
  // works, and goes through the second factor like any other sign-in.
  return Response.json({ ok: true });
}

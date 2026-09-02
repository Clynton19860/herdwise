import { getOwnerAccountByEmail, getStaffByEmail } from "@/lib/db";
import { CODE_TTL_MINUTES, issueChallenge, verifyPassword } from "@/lib/auth";
import { sendSignInCode } from "@/lib/supabase-auth";
import { callerKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step one: verify the password, then have Supabase send the six-digit code.
 *
 * The response is deliberately identical whether or not the account exists and
 * whether or not the password was right — including when sending fails. Anything
 * else turns this endpoint into a way to discover which email addresses are
 * registered, and a wrong password would be distinguishable from a wrong
 * address. A caller learns nothing until they present a correct code.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`login:${callerKey(req)}`, { limit: 8, windowSeconds: 300 });
  if (!limit.ok) {
    return Response.json(
      { error: `Too many attempts — try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  if (!email || !password) {
    return Response.json({ error: "Enter your email and password." }, { status: 400 });
  }

  // An address belongs to exactly one principal — enforced when an invitation is
  // sent — so this is a lookup rather than a choice.
  const staff = await getStaffByEmail(email);
  const owner = staff ? null : await getOwnerAccountByEmail(email);

  const ok = staff?.active
    ? await verifyPassword(password, staff.passwordHash)
    : owner
      ? await verifyPassword(password, owner.passwordHash)
      : false;

  if (ok) {
    // Failures are logged, never returned. Supabase's own mailer allows two
    // messages an hour, so a rejection here is most often that ceiling rather
    // than anything about the address.
    await sendSignInCode(email);
  }

  return Response.json({
    challenge: issueChallenge(email),
    expiresInMinutes: CODE_TTL_MINUTES,
  });
}

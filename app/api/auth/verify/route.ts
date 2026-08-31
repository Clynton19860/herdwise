import { getStaffByEmail, touchLastLogin } from "@/lib/db";
import { SESSION_COOKIE, issueSession, readChallenge, sessionCookieOptions } from "@/lib/auth";
import { checkSignInCode } from "@/lib/supabase-auth";
import { callerKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step two: exchange a correct code for a session.
 *
 * Supabase both issued the code and checks it, which means the attempt ceiling
 * and expiry are enforced there rather than here — `otp_expiry` and the
 * verification rate limit live in `supabase/config.toml` beside the templates,
 * so the ten minutes the email promises is the ten minutes actually applied.
 *
 * The session that comes back is this application's own signed cookie. Supabase
 * is the second factor, not the identity.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`verify:${callerKey(req)}`, { limit: 12, windowSeconds: 300 });
  if (!limit.ok) {
    return Response.json(
      { error: `Too many attempts — try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let body: { challenge?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const claim = readChallenge(body.challenge);
  const code = (body.code ?? "").trim();
  if (!claim) {
    return Response.json({ error: "That sign-in attempt expired. Start again." }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return Response.json({ error: "Enter the six-digit code." }, { status: 400 });
  }

  const staff = await getStaffByEmail(claim.email);
  if (!staff || !staff.active || !(await checkSignInCode(claim.email, code))) {
    return Response.json({ error: "That code is not right or has expired." }, { status: 401 });
  }

  await touchLastLogin(staff.id);

  const res = Response.json({ ok: true, name: staff.fullName });
  const token = issueSession(staff.id, staff.tokenVersion);
  const o = sessionCookieOptions();
  res.headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${token}; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Lax${
      o.secure ? "; Secure" : ""
    }`,
  );
  return res;
}

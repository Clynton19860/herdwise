import { getStaffByEmail, issueLoginCode } from "@/lib/db";
import { CODE_TTL_MINUTES, generateCode, hashCode, issueChallenge, verifyPassword } from "@/lib/auth";
import { callerKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step one: verify the password, then send a six-digit code.
 *
 * The response is deliberately identical whether or not the account exists and
 * whether or not the password was right. Anything else turns this endpoint into
 * a way to discover which email addresses are registered, and a wrong password
 * would be distinguishable from a wrong address. A caller learns nothing until
 * they present a correct code.
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

  const staff = await getStaffByEmail(email);
  const ok = staff?.active ? await verifyPassword(password, staff.passwordHash) : false;

  let devCode: string | undefined;
  if (ok && staff) {
    const code = generateCode();
    await issueLoginCode(staff.id, hashCode(code), CODE_TTL_MINUTES);

    // No mail or SMS provider is connected yet, so the code is written to the
    // server log — the operator running the pilot can read it there. When a
    // provider is added, this is the only line that changes.
    console.log(`[auth] verification code for ${email}: ${code}`);
    if (process.env.AUTH_SHOW_CODE === "1") devCode = code;
  }

  return Response.json({
    challenge: issueChallenge(email),
    expiresInMinutes: CODE_TTL_MINUTES,
    // Present only while AUTH_SHOW_CODE is set, for testing without email.
    code: devCode,
  });
}

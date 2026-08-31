import { consumeLoginCode, getLiveLoginCode, getStaffByEmail, recordCodeAttempt } from "@/lib/db";
import {
  MAX_CODE_ATTEMPTS, SESSION_COOKIE, codeMatches, issueSession,
  readChallenge, sessionCookieOptions,
} from "@/lib/auth";
import { callerKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step two: exchange a correct code for a session.
 *
 * Six digits is a million combinations, which is a lot for a person and nothing
 * for a script — so the attempt counter, not the length, is what makes the code
 * safe. After a handful of wrong guesses the code is spent and a new one must be
 * requested, which also resets the rate limit clock against the attacker.
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
  const live = staff ? await getLiveLoginCode(staff.id) : null;

  const wrong = () =>
    Response.json({ error: "That code is not right or has expired." }, { status: 401 });

  if (!staff || !staff.active || !live) return wrong();

  if (live.attempts >= MAX_CODE_ATTEMPTS) {
    await consumeLoginCode(live.id, staff.id);
    return Response.json(
      { error: "Too many wrong codes. Request a new one." },
      { status: 401 },
    );
  }

  if (!codeMatches(code, live.code_hash)) {
    await recordCodeAttempt(live.id);
    return wrong();
  }

  await consumeLoginCode(live.id, staff.id);

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

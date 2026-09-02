import { getOwnerAccountByEmail, getStaffByEmail } from "@/lib/db";
import { CODE_TTL_MINUTES, issueChallenge } from "@/lib/auth";
import { sendResetCode } from "@/lib/supabase-auth";
import { callerKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ask for a password reset code.
 *
 * Answers identically for a registered address and an unregistered one. A
 * "no such account" here would turn the reset form into a membership check for
 * anyone curious about who works for the city.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`reset:${callerKey(req)}`, { limit: 5, windowSeconds: 900 });
  if (!limit.ok) {
    return Response.json(
      { error: `Too many requests — try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  if (!email) return Response.json({ error: "Enter your email." }, { status: 400 });

  const staff = await getStaffByEmail(email);
  const owner = staff ? null : await getOwnerAccountByEmail(email);
  if (staff?.active || owner) await sendResetCode(email);

  return Response.json({ challenge: issueChallenge(email), expiresInMinutes: CODE_TTL_MINUTES });
}

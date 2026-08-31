import { CODE_TTL_MINUTES, issueChallenge } from "@/lib/auth";
import { callerKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issues a challenge without sending anything.
 *
 * Completing an invitation needs one: the code was already emailed when the
 * account was created, so asking for another would send the wrong kind — a
 * recovery code cannot finish a sign-up. This just carries the address into the
 * next step in a form the browser cannot edit.
 *
 * Handing one out for any address is safe. A challenge on its own opens nothing;
 * it has to be presented alongside a code that Supabase issued.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`challenge:${callerKey(req)}`, { limit: 20, windowSeconds: 300 });
  if (!limit.ok) return Response.json({ error: "Too many requests." }, { status: 429 });

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = (body.email ?? "").trim();
  if (!email) return Response.json({ error: "Enter your email." }, { status: 400 });

  return Response.json({ challenge: issueChallenge(email), expiresInMinutes: CODE_TTL_MINUTES });
}

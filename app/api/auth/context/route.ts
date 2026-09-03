import { getMemberships, getPersonByEmail } from "@/lib/db";
import { readChallenge } from "@/lib/auth";
import { sessionFor } from "@/lib/sign-in";
import { callerKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Choose which role to act as, after signing in as a person.
 *
 * Only reached when somebody holds more than one — a council officer who also
 * owns cattle, or a veterinarian invited onto several farms. The password was
 * already proven at `/api/auth/login`; this step is about which hat, not who.
 *
 * The browser sends back the subject id it picked, and that is not trusted. The
 * person is taken from the signed challenge, their memberships are re-read from
 * the database, and the choice has to be one of them. Editing the id in the
 * request gets a 403 rather than somebody else's session.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`context:${callerKey(req)}`, { limit: 20, windowSeconds: 300 });
  if (!limit.ok) {
    return Response.json(
      { error: `Too many attempts — try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let body: { challenge?: string; kind?: string; subjectId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const claim = readChallenge(body.challenge);
  if (!claim) {
    return Response.json({ error: "That sign-in expired. Start again." }, { status: 400 });
  }

  const person = await getPersonByEmail(claim.email);
  if (!person?.active) {
    return Response.json({ error: "That account is not available." }, { status: 403 });
  }

  const memberships = await getMemberships(person.id);
  const chosen = memberships.find(
    (m) => m.kind === body.kind && m.subjectId === body.subjectId,
  );
  if (!chosen) {
    return Response.json({ error: "You do not hold that role." }, { status: 403 });
  }

  return sessionFor(chosen.kind, chosen.subjectId);
}

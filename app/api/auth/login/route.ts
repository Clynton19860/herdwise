import { getMemberships, getPersonByEmail, touchPersonLogin } from "@/lib/db";
import { issueChallenge, verifyPassword } from "@/lib/auth";
import { sessionFor } from "@/lib/sign-in";
import { callerKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign in with a password, as a person.
 *
 * A six-digit code used to stand between the password and the session. It was
 * removed because Supabase's built-in mailer allows two messages an hour, so
 * somebody signing in three times in a morning — which is what a ward office
 * does — was locked out by their own second factor. Codes remain where they are
 * worth the friction and are sent at most once: accepting an invitation and
 * resetting a password.
 *
 * Identity now resolves through `people` rather than through `staff` and
 * `owners` separately. Those two tables each carried an email and a password,
 * so the route had to check one first — and whichever it checked, the other
 * identity for that address was unreachable. A council administrator who also
 * owns cattle could not sign in as a farmer. Now a person signs in once and,
 * when they hold more than one role, says which one they mean.
 *
 * The failure message is identical for an unknown address and a wrong password,
 * so this cannot be used to discover who holds an account.
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

  const person = await getPersonByEmail(email);
  const ok = person?.active ? await verifyPassword(password, person.passwordHash) : false;
  if (!ok || !person) {
    return Response.json({ error: "That email and password do not match." }, { status: 401 });
  }

  const memberships = await getMemberships(person.id);

  // An account with no role attached can sign in and reach nothing, which is
  // worse than being told plainly.
  if (memberships.length === 0) {
    return Response.json(
      { error: "This account is not attached to a council or a farm yet." },
      { status: 403 },
    );
  }

  await touchPersonLogin(person.id);

  // More than one hat: say which are available and let them choose. The email
  // travels back inside a signed challenge, so the next step cannot be edited
  // into somebody else's sign-in.
  if (memberships.length > 1) {
    return Response.json({
      choose: true,
      challenge: issueChallenge(person.email),
      name: person.fullName,
      options: memberships.map((m) => ({
        kind: m.kind, subjectId: m.subjectId, role: m.role, label: m.label, ward: m.ward,
      })),
    });
  }

  return sessionFor(memberships[0].kind, memberships[0].subjectId);
}

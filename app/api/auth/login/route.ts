import {
  getOwnerAccountByEmail, getStaffByEmail, touchLastLogin, touchOwnerLogin,
} from "@/lib/db";
import { SESSION_COOKIE, issueSession, sessionCookieOptions, verifyPassword } from "@/lib/auth";
import { callerKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign in with a password.
 *
 * A six-digit code used to stand between the password and the session. It has
 * been removed from this route deliberately: an officer signs in from a shared
 * ward office several times a day, and Supabase's built-in mailer allows two
 * messages an hour — so the second factor was locking people out of their own
 * platform far more often than it was stopping anybody.
 *
 * Codes remain where they are worth the friction and are sent at most once:
 * accepting an invitation, resetting a password, and changing an email address.
 * Those are the moments an account can be taken over; a routine sign-in is not.
 *
 * The failure message is identical for an unknown address and a wrong password,
 * so this cannot be used to discover who holds an account. It cannot hide that
 * *some* attempt failed — the session is the tell — but it never says which.
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

  const principal = staff?.active ? staff : owner;
  const ok = principal ? await verifyPassword(password, principal.passwordHash) : false;

  if (!ok || !principal) {
    return Response.json(
      { error: "That email and password do not match." },
      { status: 401 },
    );
  }

  if (staff) await touchLastLogin(staff.id);
  else if (owner) await touchOwnerLogin(owner.id);

  // Staff land on the ward overview; an owner lands on his own herd. Told to the
  // client rather than guessed, so the redirect cannot send a farmer to a page
  // he is not allowed to open.
  const res = Response.json({
    ok: true,
    name: principal.fullName,
    home: staff ? "/dashboard" : "/my",
  });
  const token = issueSession(
    principal.id, principal.tokenVersion, staff ? "staff" : "owner",
  );
  const o = sessionCookieOptions();
  res.headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${token}; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Lax${
      o.secure ? "; Secure" : ""
    }`,
  );
  return res;
}

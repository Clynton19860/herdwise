import "server-only";
import {
  getOwnerAccountById, getStaffById, touchLastLogin, touchOwnerLogin,
} from "@/lib/db";
import { SESSION_COOKIE, issueSession, sessionCookieOptions } from "@/lib/auth";

/**
 * Turn one membership into a session.
 *
 * Shared by the login route and the context route so both mint a session the
 * same way. The token version is read from the row being acted as rather than
 * passed in by the caller — a session that carried a version the browser chose
 * could outlive a revocation.
 *
 * Lives here rather than beside a route because Next rejects exports from a
 * route file that are not route handlers.
 */
export async function sessionFor(kind: "staff" | "owner", subjectId: string) {
  if (kind === "owner") {
    const owner = await getOwnerAccountById(subjectId);
    if (!owner) return Response.json({ error: "That account is not available." }, { status: 403 });
    await touchOwnerLogin(owner.id);
    return withSessionCookie(
      { ok: true, name: owner.fullName, home: "/my" },
      issueSession(owner.id, owner.tokenVersion, "owner"),
    );
  }

  const staff = await getStaffById(subjectId);
  if (!staff || !staff.active) {
    return Response.json({ error: "That account is not available." }, { status: 403 });
  }
  await touchLastLogin(staff.id);
  return withSessionCookie(
    { ok: true, name: staff.fullName, home: "/dashboard" },
    issueSession(staff.id, staff.tokenVersion, "staff"),
  );
}

export function withSessionCookie(payload: Record<string, unknown>, token: string) {
  const res = Response.json(payload);
  const o = sessionCookieOptions();
  res.headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${token}; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Lax${
      o.secure ? "; Secure" : ""
    }`,
  );
  return res;
}

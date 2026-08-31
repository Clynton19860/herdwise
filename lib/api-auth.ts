import "server-only";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { getStaffById, type StaffAccount } from "@/lib/db";

/**
 * Guards an API route.
 *
 * Adding sign-in to the pages alone would have been theatre: every one of these
 * endpoints returns the same data the pages do, so leaving them open means the
 * animals, owners and positions stay readable to anyone who knows the URL.
 *
 * Checks the signature and re-reads the staff row, so a deactivated account or a
 * revoked session stops working immediately rather than at cookie expiry.
 */
export async function requireStaff(req: Request): Promise<StaffAccount | null> {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  const session = readSession(match?.[1]);
  if (!session) return null;

  const staff = await getStaffById(session.sub);
  if (!staff || !staff.active || staff.tokenVersion !== session.v) return null;
  return staff;
}

export const unauthorized = () =>
  Response.json({ error: "Sign in to continue." }, { status: 401 });

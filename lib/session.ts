import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { getStaffById, type StaffAccount } from "@/lib/db";

/**
 * The signed-in member of staff, or null.
 *
 * The cookie's signature proves it was issued here and has not been edited, but
 * that alone is not enough: an account can be deactivated, or every session
 * revoked, after a valid cookie was handed out. So the row is re-read and
 * `token_version` compared on each request. A signature check answers "did we
 * issue this", not "is it still good".
 */
export async function currentStaff(): Promise<StaffAccount | null> {
  const jar = await cookies();
  const session = readSession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const staff = await getStaffById(session.sub);
  if (!staff || !staff.active) return null;
  if (staff.tokenVersion !== session.v) return null;
  return staff;
}

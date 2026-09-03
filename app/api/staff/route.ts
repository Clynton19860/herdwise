import { getStaff } from "@/lib/db";
import { requireStaff, unauthorized } from "@/lib/api-auth";
import { permit } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Staff available to be assigned an incident.
 *
 * The report form used to offer five officers by name — none of whom had a staff
 * row — so an incident could be assigned to somebody who does not exist.
 */
export async function GET(req: Request) {
  const allowed = await permit(req, "read", "people");
  if (!allowed.ok) return allowed.response;

  if (!(await requireStaff(req))) return unauthorized();

  try {
    return Response.json(await getStaff());
  } catch {
    return Response.json([], { status: 200 });
  }
}

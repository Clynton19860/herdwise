import { archiveGeofence } from "@/lib/db";
import { requireStaff, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retire a zone.
 *
 * Archiving rather than deleting: containment events cite the zone they were
 * scored against, and deleting one would leave that history pointing at nothing.
 * A retired zone stops being enforced and stays readable.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireStaff(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") {
    return Response.json({ error: "Only an administrator can archive a zone." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const archived = await archiveGeofence(id);
  if (!archived) return Response.json({ error: "No such zone." }, { status: 404 });
  return Response.json({ ok: true, id: archived.id });
}

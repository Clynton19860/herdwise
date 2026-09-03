import { archiveGeofence } from "@/lib/db";
import { permit } from "@/lib/guard";

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
  const allowed = await permit(req, "write", "geofences");
  if (!allowed.ok) return allowed.response;
  const me = allowed.me.kind === "staff" ? allowed.me.staff : null;
  if (!me) {
    return Response.json(
      { error: "This is a council function." },
      { status: 403 },
    );
  }
  if (me.role !== "admin") {
    return Response.json({ error: "Only an administrator can archive a zone." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const archived = await archiveGeofence(id);
  if (!archived) return Response.json({ error: "No such zone." }, { status: 404 });
  return Response.json({ ok: true, id: archived.id });
}

import { updateIncidentStatus } from "@/lib/db";
import { requireStaff, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["open", "in_progress", "resolved", "escalated"]);

/**
 * Move an incident through its workflow: acknowledge, escalate, resolve.
 *
 * These were the buttons that could not be wired before authentication, because
 * every one of them is a claim about who did something. The signed-in officer is
 * recorded, not a name typed into a box.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireStaff(req);
  if (!me) return unauthorized();
  if (me.role !== "officer" && me.role !== "admin") {
    return Response.json(
      { error: "Only an officer can work an incident." },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  let body: { status?: string };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const status = (body.status ?? "").toLowerCase().replace(/\s+/g, "_");
  if (!STATUSES.has(status)) {
    return Response.json({ error: "Unknown status." }, { status: 400 });
  }

  const updated = await updateIncidentStatus(id, status, me.fullName);
  if (!updated) return Response.json({ error: "No such incident." }, { status: 404 });
  return Response.json(updated);
}

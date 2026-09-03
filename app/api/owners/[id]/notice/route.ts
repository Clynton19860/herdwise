import { serveNotice } from "@/lib/db";
import { permit } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEVERITY = new Set(["low", "medium", "high", "critical"]);
const CHANNEL = new Set(["in_app", "sms"]);

/**
 * Serve a notice on an owner.
 *
 * Filed under `incidents` rather than `owners` for permission purposes: this is
 * an enforcement act, not an edit to somebody's record, and the people who may
 * correct an address are not necessarily the people who may serve a notice.
 *
 * The officer's name is taken from the session and appended to the body, so a
 * notice always says who issued it and the browser cannot claim it came from
 * somebody else.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const allowed = await permit(req, "write", "incidents");
  if (!allowed.ok) return allowed.response;

  const { id } = await ctx.params;

  let b: Record<string, string | undefined>;
  try { b = await req.json(); } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const subject = (b.subject ?? "").trim();
  const body = (b.body ?? "").trim();
  const severity = (b.severity ?? "medium").toLowerCase();
  const channel = (b.channel ?? "in_app").toLowerCase();

  if (!subject) return Response.json({ error: "A notice needs a subject." }, { status: 400 });
  if (!body) return Response.json({ error: "A notice needs a body." }, { status: 400 });
  if (!SEVERITY.has(severity)) return Response.json({ error: "Unknown severity." }, { status: 400 });
  if (!CHANNEL.has(channel)) return Response.json({ error: "Unknown channel." }, { status: 400 });

  const served = await serveNotice({
    ownerId: id, subject, body,
    severity: severity as "low" | "medium" | "high" | "critical",
    channel: channel as "in_app" | "sms",
    officer: allowed.me.name,
  });
  if (!served) return Response.json({ error: "No such owner." }, { status: 404 });

  return Response.json({
    ok: true,
    state: served.state,
    note: served.state === "sent"
      ? "Served. It appears in their platform account now."
      : "Written and queued. It will send once a carrier account is connected.",
  });
}

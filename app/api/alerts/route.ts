import { getAnimals, getNotifications, markNotificationsRead } from "@/lib/db";
import { permit } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What is waiting for this officer.
 *
 * Two sources, and they answer different questions. Notifications are a record:
 * a breach happened, somebody should know, and it stays until read. Device
 * conditions are a state: this tag's battery is low *now*, and it stops being
 * true when the battery is changed rather than when somebody acknowledges it.
 * Persisting the second would leave stale alerts nobody can clear.
 */
export async function GET(req: Request) {
  const allowed = await permit(req, "read", "tracking");
  if (!allowed.ok) return allowed.response;
  const me = allowed.me.kind === "staff" ? allowed.me.staff : null;
  if (!me) {
    return Response.json(
      { error: "This is a council function." },
      { status: 403 },
    );
  }

  try {
    const [notices, animals] = await Promise.all([getNotifications(me.id), getAnimals()]);

    const live = animals
      .filter((a) => a.device.battery > 0 && a.device.battery < 25)
      .map((a) => ({
        id: `battery:${a.id}`,
        tone: "amber",
        text: `${a.tag} battery at ${a.device.battery}%`,
        href: `/livestock/${a.id}`,
        unread: true,
      }));

    return Response.json({
      items: [
        ...notices.map((n) => ({
          id: n.id,
          tone: n.severity === "critical" ? "coral" : "amber",
          text: n.subject,
          href: n.href ?? "/tracking",
          unread: !n.read,
        })),
        ...live,
      ].slice(0, 12),
      unread: notices.filter((n) => !n.read).length + live.length,
    });
  } catch {
    return Response.json({ items: [], unread: 0 }, { status: 200 });
  }
}

/** Marks notices read. Device conditions have nothing to mark — they simply stop. */
export async function POST(req: Request) {
  const allowed = await permit(req, "write", "incidents");
  if (!allowed.ok) return allowed.response;
  const me = allowed.me.kind === "staff" ? allowed.me.staff : null;
  if (!me) {
    return Response.json(
      { error: "This is a council function." },
      { status: 403 },
    );
  }

  let body: { ids?: string[] } = {};
  try { body = await req.json(); } catch { /* clearing everything is the default */ }

  const ids = (body.ids ?? []).filter((id) => !id.startsWith("battery:"));
  await markNotificationsRead(me.id, ids.length ? ids : undefined);
  return Response.json({ ok: true });
}

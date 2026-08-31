import { getAnimals, getIncidents, getOpenBreaches } from "@/lib/db";
import { requireStaff, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What is actually waiting for an officer.
 *
 * The notification bell displayed a pulsing unread dot permanently, regardless
 * of whether anything had happened, and clicking it did nothing. An indicator
 * that is always on carries no information — and worse, it trains people to
 * ignore the one time it matters.
 */
export async function GET(req: Request) {
  if (!(await requireStaff(req))) return unauthorized();

  try {
    const [breaches, incidents, animals] = await Promise.all([
      getOpenBreaches(), getIncidents(), getAnimals(),
    ]);

    const open = incidents.filter(
      (i) => i.status === "Open" || i.status === "In progress" || i.status === "Escalated",
    );
    const lowBattery = animals.filter((a) => a.device.battery > 0 && a.device.battery < 25);

    return Response.json({
      items: [
        ...breaches.map((b) => ({
          tone: "coral",
          text: `${b.tag} is outside ${b.parcel ?? "its allocation"}`,
          href: `/livestock/${b.animal_id}`,
        })),
        ...open.map((i) => ({
          tone: "amber",
          text: `Incident ${i.ref} — ${i.type}`,
          href: `/incidents/${i.id}`,
        })),
        ...lowBattery.map((a) => ({
          tone: "amber",
          text: `${a.tag} battery at ${a.device.battery}%`,
          href: `/livestock/${a.id}`,
        })),
      ].slice(0, 8),
    });
  } catch {
    return Response.json({ items: [] }, { status: 200 });
  }
}

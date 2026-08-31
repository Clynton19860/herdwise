import { createIncident } from "@/lib/db";
import { requireStaff, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["stray", "theft", "boundary_breach", "disease_alert", "injured", "death"]);
const SEVERITIES = new Set(["low", "medium", "high", "critical"]);

/**
 * Report an incident.
 *
 * The reference is allocated by the database, not the browser. The form used to
 * invent one with Math.random(), which can collide and carries no ordering.
 */
export async function POST(req: Request) {
  const me = await requireStaff(req);
  if (!me) return unauthorized();

  let b: Record<string, string | null | undefined>;
  try { b = await req.json(); } catch { return bad("Invalid request."); }

  const type = (b.type ?? "").toString().toLowerCase().replace(/\s+/g, "_");
  const severity = (b.severity ?? "").toString().toLowerCase();

  if (!TYPES.has(type)) return bad("Choose what kind of incident this is.");
  if (!SEVERITIES.has(severity)) return bad("Choose a severity.");

  try {
    const incident = await createIncident({
      type, severity,
      animalId: b.animalId ?? null, ownerId: b.ownerId ?? null,
      locationLabel: b.location ?? null,
      // Recorded against the signed-in officer unless one is named explicitly.
      officer: (b.officer ?? "").toString().trim() || me.fullName,
      notes: b.notes ?? null,
    });
    return Response.json(incident, { status: 201 });
  } catch (err) {
    console.error("[incidents] create failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Could not file the incident." }, { status: 500 });
  }
}

const bad = (error: string) => Response.json({ error }, { status: 400 });

import { createHealthRecord } from "@/lib/db";
import { permit } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["vaccination", "treatment", "diagnosis", "inspection", "quarantine"]);

/** Log a vaccination, treatment, diagnosis, inspection or quarantine. */
export async function POST(req: Request) {
  const allowed = await permit(req, "write", "health");
  if (!allowed.ok) return allowed.response;
  const me = allowed.me.kind === "staff" ? allowed.me.staff : null;
  if (!me) {
    return Response.json(
      { error: "This is a council function." },
      { status: 403 },
    );
  }
  // A health record is a clinical statement. Officers read them; vets write them.
  if (me.role !== "vet" && me.role !== "admin") {
    return Response.json(
      { error: "Only a veterinarian can add a health record." },
      { status: 403 },
    );
  }

  let b: Record<string, string | null | undefined>;
  try { b = await req.json(); } catch { return bad("Invalid request."); }

  const animalId = (b.animalId ?? "").toString();
  const type = (b.type ?? "").toString().toLowerCase();
  const description = (b.description ?? "").toString().trim();
  const occurredOn = (b.occurredOn ?? "").toString();

  if (!animalId) return bad("Choose an animal.");
  if (!TYPES.has(type)) return bad("Choose the kind of record.");
  if (!description) return bad("Describe what was done.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) return bad("Give the date it happened.");

  try {
    const record = await createHealthRecord({
      animalId, type, occurredOn, description,
      nextDueOn: b.nextDueOn ?? null,
      medicine: b.medicine ?? null,
      veterinarian: (b.veterinarian ?? "").toString().trim() || me.fullName,
    });
    return Response.json(record, { status: 201 });
  } catch (err) {
    console.error("[health] create failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Could not save the record." }, { status: 500 });
  }
}

const bad = (error: string) => Response.json({ error }, { status: 400 });

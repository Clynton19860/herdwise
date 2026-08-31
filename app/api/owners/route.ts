import { createOwner } from "@/lib/db";
import { requireStaff, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Register a livestock owner. */
export async function POST(req: Request) {
  const me = await requireStaff(req);
  if (!me) return unauthorized();

  let b: Record<string, string | null | undefined>;
  try { b = await req.json(); } catch { return bad("Invalid request."); }

  const fullName = (b.fullName ?? "").toString().trim();
  const nationalId = (b.nationalId ?? "").toString().trim();
  const phone = (b.phone ?? "").toString().trim();

  if (!fullName) return bad("Enter the owner's full name.");
  if (!nationalId) return bad("Enter their national ID.");
  if (!phone) return bad("Enter a contact number.");

  try {
    const owner = await createOwner({
      fullName, nationalId, phone,
      wardName: b.ward ?? null, address: b.address ?? null,
    });
    return Response.json(owner, { status: 201 });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    // The schema makes national_id unique, which is the check that stops the
    // same person being registered twice under slightly different spellings.
    if (/owners_national_id_key/.test(m)) {
      return Response.json(
        { error: "Somebody is already registered with that national ID." },
        { status: 409 },
      );
    }
    console.error("[owners] create failed:", m);
    return Response.json({ error: "Could not save the owner." }, { status: 500 });
  }
}

const bad = (error: string) => Response.json({ error }, { status: 400 });

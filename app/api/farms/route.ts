import { createFarm, getFarmsFor } from "@/lib/db";
import { principalFromRequest } from "@/lib/principal";
import { permit } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => Response.json({ error }, { status });

/** The farms this person works on. */
export async function GET(req: Request) {
  const allowed = await permit(req, "read", "settings");
  if (!allowed.ok) return allowed.response;

  const me = await principalFromRequest(req);
  if (me?.kind !== "owner") return bad("Sign in to continue.", 401);
  return Response.json(await getFarmsFor(me.id));
}

/**
 * Create a farm.
 *
 * Anybody signed in on the farm side may create one, and creating it makes them
 * its owner. There is no approval step and nothing is made in advance — that was
 * the point of the change: a farmer arrives owning nothing and describes his own
 * place rather than being placed into a ward somebody invented for him.
 *
 * The ward is optional and, when given, is only a municipal grouping. A farm is
 * a real place whether or not a city has filed it.
 */
export async function POST(req: Request) {
  const allowed = await permit(req, "write", "settings");
  if (!allowed.ok) return allowed.response;

  const me = await principalFromRequest(req);
  if (me?.kind !== "owner") return bad("Sign in to continue.", 401);

  let b: { name?: string; district?: string; ward?: string };
  try { b = await req.json(); } catch { return bad("Invalid request."); }

  const name = (b.name ?? "").trim();
  if (!name) return bad("Give the farm a name.");
  if (name.length > 120) return bad("That name is too long.");

  const farm = await createFarm({
    name, personId: me.id,
    district: b.district?.trim() || null,
    wardName: b.ward?.trim() || null,
  });
  return Response.json(farm, { status: 201 });
}

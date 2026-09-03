import { getMapAnimals } from "@/lib/db";
import { requireStaff, unauthorized } from "@/lib/api-auth";
import { permit } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Realtime tells the map *that* something moved; this says where. */
export async function GET(req: Request) {
  const allowed = await permit(req, "read", "tracking");
  if (!allowed.ok) return allowed.response;

  if (!(await requireStaff(req))) return unauthorized();

  return Response.json(await getMapAnimals(), {
    headers: { "cache-control": "no-store" },
  });
}

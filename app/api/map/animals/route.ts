import { getMapAnimals } from "@/lib/db";
import { requireStaff, unauthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** Realtime tells the map *that* something moved; this says where. */
export async function GET(req: Request) {
  if (!(await requireStaff(req))) return unauthorized();

  return Response.json(await getMapAnimals(), {
    headers: { "cache-control": "no-store" },
  });
}

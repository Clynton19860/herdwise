import { getMapAnimals } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Realtime tells the map *that* something moved; this says where. */
export async function GET() {
  return Response.json(await getMapAnimals(), {
    headers: { "cache-control": "no-store" },
  });
}

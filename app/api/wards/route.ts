import { getWards } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The registered wards, for forms that ask an operator to pick one.
 *
 * The wizards used to carry a hardcoded list of six wards, none of which were
 * in the database — so every option led to a record that could not be linked.
 * A picker must only offer what exists.
 */
export async function GET() {
  try {
    return Response.json(await getWards());
  } catch {
    return Response.json([], { status: 200 });
  }
}

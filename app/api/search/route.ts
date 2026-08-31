import { search } from "@/lib/db";
import { callerKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Backs the ⌘K field, which previously accepted input and did nothing with it. */
export async function GET(req: Request) {
  const limit = rateLimit(callerKey(req), { limit: 60, windowSeconds: 60 });
  if (!limit.ok) return Response.json([], { status: 429 });

  const q = new URL(req.url).searchParams.get("q") ?? "";
  // Two characters is the floor: a single letter matches most of the register
  // and makes the query pointless as well as expensive.
  if (q.trim().length < 2) return Response.json([]);

  try {
    return Response.json(await search(q.slice(0, 80)));
  } catch {
    return Response.json([], { status: 200 });
  }
}

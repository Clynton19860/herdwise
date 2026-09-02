import { updateOwner } from "@/lib/db";
import { principalFromRequest } from "@/lib/principal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A farmer correcting his own contact details.
 *
 * The id comes from the session, never from the request body — otherwise this
 * endpoint would let any signed-in owner edit any other owner's record, which is
 * exactly the failure a separate owner surface exists to prevent.
 *
 * Only phone and address. Ward and national ID are how the register identifies
 * and places somebody, and are not this account's to change.
 */
export async function PATCH(req: Request) {
  const principal = await principalFromRequest(req);
  if (principal?.kind !== "owner") {
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  }

  let b: { phone?: string; address?: string };
  try { b = await req.json(); } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const phone = b.phone?.trim();
  if (phone !== undefined && !phone) {
    return Response.json({ error: "A contact number cannot be blank." }, { status: 400 });
  }

  const updated = await updateOwner(principal.id, { phone, address: b.address });
  if (!updated) return Response.json({ error: "Could not save." }, { status: 404 });
  return Response.json(updated);
}

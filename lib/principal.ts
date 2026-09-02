import "server-only";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import {
  getFarmsFor, getOwnerAccountById, getStaffById,
  type Farm, type OwnerAccount, type StaffAccount,
} from "@/lib/db";

/**
 * Who is signed in, and what kind of thing they are.
 *
 * Two principals with separate tables, separate id spaces and very different
 * reach. A member of staff sees the ward; a farm owner sees his own herd and
 * nothing else — not because a filter is applied to the same pages, but because
 * he is served different pages whose queries take his id as an argument.
 *
 * Resolved in one place so a route cannot accidentally treat an owner as staff.
 * The kind comes from the signed session, not from anything the browser can set.
 */
export type Principal =
  | { kind: "staff"; id: string; name: string; role: string; ward: string | null; staff: StaffAccount }
  | {
      kind: "owner"; id: string; name: string; ward: string | null; owner: OwnerAccount;
      /**
       * The farms this person works on. Empty for somebody newly invited who has
       * not described their place yet — the interface asks them to before
       * anything else, rather than inventing one for them.
       */
      farms: Farm[];
      farmIds: string[];
    };

async function resolve(token: string | undefined): Promise<Principal | null> {
  const session = readSession(token);
  if (!session) return null;

  // Sessions issued before owners existed carry no kind and are staff.
  if (session.k === "o") {
    const owner = await getOwnerAccountById(session.sub);
    if (!owner || owner.tokenVersion !== session.v) return null;
    const farms = await getFarmsFor(owner.id);
    return {
      kind: "owner", id: owner.id, name: owner.fullName, ward: owner.ward, owner,
      farms, farmIds: farms.map((f) => f.id),
    };
  }

  const staff = await getStaffById(session.sub);
  if (!staff || !staff.active || staff.tokenVersion !== session.v) return null;
  return { kind: "staff", id: staff.id, name: staff.fullName, role: staff.role, ward: staff.ward, staff };
}

/** For server components. */
export async function currentPrincipal(): Promise<Principal | null> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return resolve(jar.get(SESSION_COOKIE)?.value);
}

/** For route handlers, which read the cookie off the request. */
export async function principalFromRequest(req: Request): Promise<Principal | null> {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return resolve(match?.[1]);
}

/**
 * The owner's own id, or null for anybody else.
 *
 * Every owner-facing query takes this as an argument rather than reading a
 * session itself, so the scope is visible at the call site and a query that
 * forgot it would not compile.
 */
export function ownerScope(p: Principal | null): string | null {
  return p?.kind === "owner" ? p.id : null;
}

/** May this person act on this farm, and does their role allow appointing others? */
export function farmRole(p: Principal | null, farmId: string): string | null {
  if (p?.kind !== "owner") return null;
  return p.farms.find((f) => f.id === farmId)?.role ?? null;
}

export function canAppoint(p: Principal | null, farmId: string): boolean {
  const role = farmRole(p, farmId);
  return role === "owner" || role === "manager";
}

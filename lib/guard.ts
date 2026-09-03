import "server-only";
import { getGrants, tenantOf, type TenantGrant } from "@/lib/db";
import { can, grantFor, refusal, type Action, type Component } from "@/lib/permissions";

/**
 * One place a route asks "may they?", instead of twenty-seven answers.
 *
 * Before this, authorisation was whatever each route remembered to check. Nine
 * of twenty-seven checked a role at all, each in its own way, and the rest
 * accepted anybody with a session. That is not a policy, it is twenty-seven
 * opinions — and the gap between them is where an officer turns out to be able
 * to delete a register.
 *
 * The grant is always read from the database. A plan that travelled in a cookie
 * would be a ceiling the browser could be persuaded to raise, which defeats the
 * reason for putting it on the tenant.
 */

export type Allowed = { ok: true; grant: TenantGrant };
export type Denied = { ok: false; response: Response };

/**
 * May this person take this action, somewhere they hold a grant?
 *
 * For creating things, where there is no existing record to scope against. The
 * best grant wins: somebody who is an administrator of one tenant and a viewer
 * of another may create in the first.
 */
export async function mayAnywhere(
  personId: string | null,
  action: Action,
  component: Component,
): Promise<Allowed | Denied> {
  if (!personId) return denied("Sign in to continue.", 401);

  const grants = await getGrants(personId);
  const allowed = grants.find((g) => can({ plan: g.plan, role: g.role }, action, component));
  if (allowed) return { ok: true, grant: allowed };

  // Report the limit that the *closest* grant hit, so the message is useful.
  // "Forbidden" tells a farm manager nothing; being told the account is on a
  // trial plan tells them who to call.
  const nearest = grants[0] ?? null;
  return denied(
    refusal(nearest && { plan: nearest.plan, role: nearest.role }, action, component)
      ?? "You do not have access to this.",
    nearest ? 403 : 401,
  );
}

/**
 * May this person take this action on this particular record?
 *
 * The record's own tenant decides which ceiling applies, read from the row. A
 * caller that supplied its own idea of the tenant could supply somebody else's.
 */
export async function mayOn(
  personId: string | null,
  action: Action,
  component: Component,
  table: Parameters<typeof tenantOf>[0],
  recordId: string,
): Promise<Allowed | Denied> {
  if (!personId) return denied("Sign in to continue.", 401);

  const record = await tenantOf(table, recordId);
  if (!record) return denied("No such record.", 404);

  const grants = await getGrants(personId);

  // Membership in the owning tenant, or a mandate over the council that
  // regulates it. The rule itself is pure and lives beside the permission
  // table, so it can be tested without a database.
  const scope = grantFor(grants, record);
  // Hand back the full grant, so a caller knows which tenant it is acting in.
  const effective = scope ? grants.find((g) => g.tenantId === scope.tenantId) ?? null : null;
  if (effective && can({ plan: effective.plan, role: effective.role }, action, component)) {
    return { ok: true, grant: effective };
  }

  return denied(
    refusal(effective && { plan: effective.plan, role: effective.role }, action, component)
      ?? "That record is not yours.",
    403,
  );
}

function denied(message: string, status: number): Denied {
  return { ok: false, response: Response.json({ error: message }, { status }) };
}

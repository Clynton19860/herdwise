/**
 * What a person may do, decided in one place.
 *
 * Two independent questions, deliberately kept apart:
 *
 *   plan  — what may this *organisation* do at all? Set by us, when they pay.
 *   role  — what may this *person* do within it? Set by their own administrator.
 *
 * Conflating them is the mistake this file exists to avoid. If "read only" were
 * a role, an invited farm evaluating the platform would simply add a colleague,
 * grant them write, and have a working system for nothing. Because it is a plan
 * on the tenant, nobody inside can grant what the tenant does not hold — an
 * administrator is still inside the tenant.
 *
 * The rule that makes the two compose safely is the only one worth remembering:
 * **a grant can never exceed the ceiling above it.** It is enforced once, in
 * `can()`, rather than in each of the twenty-seven routes that need it.
 */

export const COMPONENTS = [
  "livestock", "tags", "owners", "geofences", "incidents",
  "health", "analytics", "tracking", "people", "settings",
] as const;

export type Component = (typeof COMPONENTS)[number];
export type Action = "read" | "write";

export type Plan = "full" | "demo" | "suspended";
export type Role =
  | "owner" | "admin" | "manager" | "officer" | "vet" | "herdsman" | "viewer";

/** Everything, for the roles that genuinely have everything. */
const ALL: Component[] = [...COMPONENTS];

/**
 * Read and write, per role.
 *
 * Written as data rather than as branching, because this is the table somebody
 * will be asked to show a procurement officer, and a table can be read by
 * someone who does not write TypeScript.
 */
const ROLES: Record<Role, { read: Component[]; write: Component[] }> = {
  // A farm owner runs their own operation, including who else may reach it.
  owner: { read: ALL, write: ALL },

  // A council administrator, within their own jurisdiction.
  admin: { read: ALL, write: ALL },

  // Runs the day-to-day of a farm but does not change who has access.
  manager: {
    read: ALL,
    write: ["livestock", "tags", "geofences", "health", "incidents"],
  },

  // A municipal field officer: sees everything they regulate, records what
  // they observe, and cannot alter the register's people or settings.
  officer: {
    read: ALL,
    write: ["livestock", "geofences", "incidents", "health"],
  },

  // Health is the vet's business and nothing else is. They may be invited to
  // several farms at once, so this role has to be narrow to be safe.
  vet: {
    read: ["livestock", "health", "tracking", "incidents", "tags"],
    write: ["health"],
  },

  // Works with the animals, not with the records about them.
  herdsman: {
    read: ["livestock", "tags", "tracking", "geofences", "health"],
    write: ["livestock"],
  },

  // Exists so an evaluation can be given to a named person rather than by
  // handing round a password.
  viewer: { read: ALL, write: [] },
};

/**
 * The ceiling each plan imposes, whatever the role beneath it says.
 *
 * `demo` is deliberately expressed as a cap on *writes* rather than as a list
 * of components: the question of how much a tenant on trial may enter is a
 * commercial one that will change, and changing it should not mean rewriting
 * the permission model. Strict read-only is the safe default; a volume cap on
 * the same components is a policy change, not a redesign.
 */
const PLANS: Record<Plan, { read: boolean; write: Component[] }> = {
  full: { read: true, write: ALL },
  demo: { read: true, write: [] },
  suspended: { read: false, write: [] },
};

export type Grant = { plan: Plan; role: Role };

/**
 * May this person take this action on this component?
 *
 * Both the plan and the role have to allow it. Neither can override the other,
 * and the plan is checked first because it is the one the tenant cannot change.
 */
export function can(grant: Grant | null, action: Action, component: Component): boolean {
  if (!grant) return false;

  const plan = PLANS[grant.plan];
  const role = ROLES[grant.role];
  if (!plan || !role) return false;

  if (action === "read") {
    return plan.read && role.read.includes(component);
  }
  return plan.write.includes(component) && role.write.includes(component);
}

/**
 * Why an action was refused, for a message somebody can act on.
 *
 * "Forbidden" tells a farm manager nothing. Being told the account is on a
 * trial plan tells them to call whoever sold it to them, which is the outcome
 * this distinction exists to produce.
 */
export function refusal(grant: Grant | null, action: Action, component: Component): string | null {
  if (can(grant, action, component)) return null;
  if (!grant) return "Sign in to continue.";
  if (grant.plan === "suspended") return "This account is suspended.";
  if (action === "write" && !PLANS[grant.plan].write.includes(component)) {
    return "This account is on a trial plan and cannot make changes.";
  }
  return `Your role does not allow this.`;
}

/* ------------------------------------------------------------- scoping */

export type Scope = {
  tenantId: string;
  kind: "platform" | "municipal" | "farm";
  plan: Plan;
  role: Role;
  /** The council this farm answers to. Null for a council or the platform. */
  jurisdictionId: string | null;
};

/** Where a record lives, and who regulates that place. */
export type RecordScope = { tenantId: string; jurisdictionId: string | null };

/**
 * Which of a person's grants applies to a record, if any.
 *
 * Two ways to reach a record and they are not the same thing:
 *
 *   membership     you belong to the tenant that owns it
 *   jurisdiction   you administer the council that regulates the tenant
 *
 * The second is a mandate rather than ownership, and it is one hop and never a
 * chain — a council reaches the farms in its own district and no further. That
 * is the whole reason there is a single edge between tenants instead of a
 * hierarchy: "may they?" is answerable without walking a tree, so it cannot
 * quietly become "may they, eventually?".
 *
 * Kept pure so the rule can be tested without a database, which is what makes
 * it worth trusting.
 */
export function grantFor(grants: Scope[], record: RecordScope): Scope | null {
  const own = grants.find((g) => g.tenantId === record.tenantId);
  if (own) return own;

  if (!record.jurisdictionId) return null;
  return grants.find(
    (g) => g.kind === "municipal" && g.tenantId === record.jurisdictionId,
  ) ?? null;
}

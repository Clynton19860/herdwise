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
  //
  // Not health. A health record is a clinical statement, and an officer who
  // is not a vet should not be able to make one — the health-records route
  // already refused this, and a permission table that disagreed with the rule
  // it is meant to express is worse than no table at all.
  officer: {
    read: ALL,
    write: ["livestock", "geofences", "incidents"],
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
 * `demo` exists so somebody evaluating the platform can show it working to
 * their government without being able to run their operation on it. That means
 * reading everything and changing almost nothing — but not literally nothing,
 * because a demonstration of a livestock platform where you cannot put a tag on
 * an animal or draw a boundary is a demonstration of a slideshow.
 *
 * So two writes, chosen because they are the two things the product *is*: a tag
 * on an animal, and a boundary around it. Both are reversible, neither creates
 * a record of a real animal or a real person, and together they are enough to
 * walk a room through the whole idea.
 *
 * Everything that would let them actually operate stays closed. They cannot
 * register livestock, add owners, invite people, record health, raise incidents
 * or change settings — so the register they would need to run a farm never
 * comes into existence.
 */
const PLANS: Record<Plan, { read: boolean; write: Component[] }> = {
  full: { read: true, write: ALL },
  demo: { read: true, write: ["tags", "geofences"] },
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
    // Naming what a trial *can* do is more useful than naming what it cannot:
    // somebody hitting this is mid-demonstration and needs to know where the
    // line is, not that there is one.
    return grant.plan === "demo"
      ? "This is a trial account. It can assign tags and draw zones, but not change the register."
      : "This account cannot make that change.";
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
 * The same rule the database holds as `visible_tenants(uuid)`, and it is stated
 * twice on purpose: the application decides in memory from grants it already
 * has, and the database can answer for itself when a query needs scoping.
 * `disclosure_test.sql` asserts the database half and `permissions.test.ts` the
 * application half against the same cases, so the two cannot drift silently.
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

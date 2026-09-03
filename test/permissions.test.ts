import test from "node:test";
import assert from "node:assert/strict";
import { COMPONENTS, can, refusal, type Component, type Role } from "../lib/permissions.ts";

/**
 * The commercial requirement, held by assertions.
 *
 * An invited farm is given the platform to demonstrate to its government. It
 * must be able to show the thing working and must not be able to run its
 * operation on it for nothing — and it must not be able to lift that limit
 * itself, which is the part a permission model usually gets wrong.
 */

test("a demo tenant can show everything and change nothing", () => {
  for (const c of COMPONENTS) {
    assert.equal(can({ plan: "demo", role: "owner" }, "read", c), true, `read ${c}`);
    assert.equal(can({ plan: "demo", role: "owner" }, "write", c), false, `write ${c}`);
  }
});

test("the ceiling holds against the most powerful role there is", () => {
  // The owner of a demo tenant is the person who would lift the limit if they
  // could. They cannot: the plan is checked before the role.
  assert.equal(can({ plan: "demo", role: "owner" }, "write", "livestock"), false);
  assert.equal(can({ plan: "demo", role: "admin" }, "write", "people"), false);
  // And the same person on a paid plan can do both.
  assert.equal(can({ plan: "full", role: "owner" }, "write", "livestock"), true);
});

test("a suspended tenant cannot even read", () => {
  assert.equal(can({ plan: "suspended", role: "owner" }, "read", "livestock"), false);
  assert.equal(can({ plan: "suspended", role: "admin" }, "read", "analytics"), false);
});

test("a vet writes health records and nothing else", () => {
  const vet = { plan: "full", role: "vet" } as const;
  assert.equal(can(vet, "write", "health"), true);
  assert.equal(can(vet, "write", "livestock"), false, "not the register");
  assert.equal(can(vet, "write", "people"), false, "and certainly not access");
  assert.equal(can(vet, "read", "livestock"), true, "but must see the animal");
  assert.equal(can(vet, "read", "settings"), false, "no business in settings");
});

test("a field officer records what they observe but cannot change who has access", () => {
  const officer = { plan: "full", role: "officer" } as const;
  assert.equal(can(officer, "write", "incidents"), true);
  assert.equal(can(officer, "write", "geofences"), true);
  assert.equal(can(officer, "write", "people"), false);
  assert.equal(can(officer, "write", "settings"), false);
  assert.equal(can(officer, "write", "tags"), false, "commissioning is not their job");
});

test("a herdsman works with animals, not with the records about them", () => {
  const h = { plan: "full", role: "herdsman" } as const;
  assert.equal(can(h, "read", "tracking"), true);
  assert.equal(can(h, "write", "livestock"), true);
  assert.equal(can(h, "write", "incidents"), false);
  assert.equal(can(h, "read", "owners"), false, "other people's business");
});

test("a viewer reads everything and writes nothing, on any plan", () => {
  for (const c of COMPONENTS) {
    assert.equal(can({ plan: "full", role: "viewer" }, "read", c), true);
    assert.equal(can({ plan: "full", role: "viewer" }, "write", c), false);
  }
});

test("no grant at all means no", () => {
  assert.equal(can(null, "read", "livestock"), false);
  assert.equal(can(null, "write", "livestock"), false);
});

test("an unknown plan or role is refused rather than assumed harmless", () => {
  assert.equal(can({ plan: "enterprise" as never, role: "owner" }, "read", "livestock"), false);
  assert.equal(can({ plan: "full", role: "superuser" as never }, "read", "livestock"), false);
});

test("a refusal says which limit was hit, so somebody knows who to call", () => {
  assert.match(
    refusal({ plan: "demo", role: "owner" }, "write", "livestock") ?? "",
    /trial plan/,
    "a plan limit sends them to whoever sold it to them");
  assert.match(
    refusal({ plan: "full", role: "vet" }, "write", "settings") ?? "",
    /role/,
    "a role limit sends them to their own administrator");
  assert.match(refusal({ plan: "suspended", role: "owner" }, "read", "livestock") ?? "", /suspended/);
  assert.equal(refusal({ plan: "full", role: "owner" }, "write", "livestock"), null, "allowed is silent");
});

test("every component is decidable for every role", () => {
  // A component nobody thought about would otherwise default to "no" quietly
  // and be discovered by a farmer who cannot do their job.
  const roles: Role[] = ["owner", "admin", "manager", "officer", "vet", "herdsman", "viewer"];
  for (const role of roles) {
    for (const c of COMPONENTS as readonly Component[]) {
      assert.equal(typeof can({ plan: "full", role }, "read", c), "boolean");
      assert.equal(typeof can({ plan: "full", role }, "write", c), "boolean");
    }
  }
});

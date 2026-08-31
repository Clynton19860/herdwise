import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "test-secret-that-is-comfortably-long-enough-32";

/**
 * These exercise the request-shaping every write endpoint does before it
 * reaches the database: what it accepts, what it refuses, and what it refuses
 * to reveal. They run without a database because that is the point — the
 * guards must hold whether or not the query would have succeeded.
 */

const { requireStaff } = await import("../lib/api-auth.ts");
const { issueSession, SESSION_COOKIE } = await import("../lib/auth.ts");

const req = (cookie?: string) =>
  new Request("http://localhost/api/test", {
    headers: cookie ? { cookie } : {},
  });

test("no cookie means no session", async () => {
  assert.equal(await requireStaff(req()), null);
});

test("an unrelated cookie means no session", async () => {
  assert.equal(await requireStaff(req("other=value; another=thing")), null);
});

test("a forged session cookie is refused before any database call", async () => {
  // If this reached the database it would be a query for a staff row named by
  // the attacker. The signature check has to happen first.
  const forged = Buffer.from(
    JSON.stringify({ sub: "attacker", v: 0, exp: Date.now() + 60_000 }),
  ).toString("base64url");
  assert.equal(await requireStaff(req(`${SESSION_COOKIE}=${forged}.badsig`)), null);
});

test("the session cookie is matched exactly, not by substring", async () => {
  // A cookie called `not_herdwise_session` must not satisfy a look-up for
  // `herdwise_session`.
  const token = issueSession("00000000-0000-4000-8000-000000000001", 0);
  const staff = await requireStaff(req(`not_${SESSION_COOKIE}=${token}`));
  assert.equal(staff, null);
});

/* ------------------------------------------------- geofence ring checks */

const { POST: createZone } = await import("../app/api/geofences/route.ts");

const zone = (body: unknown) =>
  new Request("http://localhost/api/geofences", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("creating a zone without a session is refused", async () => {
  const res = await createZone(zone({ name: "X", ring: [[28, -26], [28.1, -26], [28.1, -26.1]] }));
  assert.equal(res.status, 401);
});

test("an unauthenticated caller learns nothing about why", async () => {
  // The 401 must not leak validation detail — that would let an unauthenticated
  // caller probe the shape of the API.
  const res = await createZone(zone({}));
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.match(body.error, /sign in/i);
});

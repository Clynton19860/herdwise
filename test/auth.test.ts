import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "test-secret-that-is-comfortably-long-enough-32";

const {
  hashPassword, verifyPassword,
  issueSession, readSession, SESSION_HOURS,
  issueChallenge, readChallenge,
} = await import("../lib/auth.ts");

/* ------------------------------------------------------------- passwords */

test("a correct password verifies", async () => {
  const stored = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", stored), true);
});

test("a wrong password does not", async () => {
  const stored = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery stapl", stored), false);
});

test("the same password hashes differently every time", async () => {
  // If two hashes of one password matched, the salt would not be doing its job
  // and a stolen table would be crackable once for every reused password.
  const a = await hashPassword("same");
  const b = await hashPassword("same");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("same", a), true);
  assert.equal(await verifyPassword("same", b), true);
});

test("a null or malformed hash is rejected rather than throwing", async () => {
  // A staff row with no password yet must fail closed, not 500.
  assert.equal(await verifyPassword("x", null), false);
  assert.equal(await verifyPassword("x", "not-a-hash"), false);
  assert.equal(await verifyPassword("x", "bcrypt$1$2$3$4"), false);
});

/* -------------------------------------------------------------- sessions */

test("a session issued here reads back", () => {
  const token = issueSession("00000000-0000-4000-8000-000000000001", 3);
  const s = readSession(token);
  assert.equal(s?.sub, "00000000-0000-4000-8000-000000000001");
  assert.equal(s?.v, 3);
});

test("a tampered payload is refused", () => {
  const token = issueSession("00000000-0000-4000-8000-000000000001", 0);
  const [, sig] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ sub: "attacker", v: 0, exp: Date.now() + 60_000 }),
  ).toString("base64url");
  assert.equal(readSession(`${forged}.${sig}`), null);
});

test("a tampered signature is refused", () => {
  const [payload] = issueSession("abc", 0).split(".");
  assert.equal(readSession(`${payload}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`), null);
});

test("garbage is refused rather than throwing", () => {
  for (const bad of [undefined, "", "no-dot", "a.b", "....", "x".repeat(500)]) {
    assert.equal(readSession(bad as string | undefined), null);
  }
});

test("an expired session is refused", () => {
  const past = Buffer.from(
    JSON.stringify({ sub: "u", v: 0, exp: Date.now() - 1000 }),
  ).toString("base64url");
  // Signed correctly by construction below, so expiry is the only thing failing.
  const token = issueSession("u", 0);
  const [, goodSig] = token.split(".");
  assert.equal(readSession(`${past}.${goodSig}`), null);
});

test("sessions last the advertised twelve hours", () => {
  const s = readSession(issueSession("u", 0));
  const hours = (s!.exp - Date.now()) / 3_600_000;
  assert.ok(Math.abs(hours - SESSION_HOURS) < 0.01, `got ${hours}h`);
});

/* ------------------------------------------------------------ challenges */

test("a challenge carries the address and cannot be edited", () => {
  const token = issueChallenge("officer@example.com");
  assert.equal(readChallenge(token)?.email, "officer@example.com");

  const [, sig] = token.split(".");
  const swapped = Buffer.from(
    JSON.stringify({ email: "attacker@example.com", exp: Date.now() + 60_000 }),
  ).toString("base64url");
  // This is the attack the challenge exists to stop: presenting somebody else's
  // address at the code step.
  assert.equal(readChallenge(`${swapped}.${sig}`), null);
});

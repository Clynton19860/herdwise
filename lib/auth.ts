import "server-only";
import {
  createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/**
 * Sign-in for Herdwise: a password, then a six-digit code.
 *
 * Deliberately built here rather than on Supabase Auth. Every page in this app
 * reads through a server-side connection pool, not PostgREST, so a Supabase
 * session in the browser would be a second identity system running alongside
 * the one the database already models in `staff`. One is enough.
 *
 * No new dependency: scrypt and HMAC both come from node's crypto module.
 */

/** `promisify` loses the options argument's typing, so wrap it directly. */
function scrypt(
  password: string, salt: Buffer, keylen: number, options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (err, key) =>
      err ? reject(err) : resolve(key)),
  );
}

/* ------------------------------------------------------------- passwords */

// Node's own guidance for interactive logins. N is the work factor; raising it
// is the lever if hardware gets faster, and the parameters are stored beside
// each hash so old passwords keep verifying after a change.
const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LEN, {
    N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p,
  });
  return ["scrypt", SCRYPT_N, SCRYPT_r, SCRYPT_p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt") return false;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = await scrypt(password, salt, expected.length, {
      N: Number(n), r: Number(r), p: Number(p),
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/* ----------------------------------------------------------------- codes */

/**
 * The six-digit code is issued, delivered and checked by Supabase Auth, so none
 * of that lives here any more. Supabase's own mailer sends it using the branded
 * templates in `supabase/templates`, which is what removed the need for a
 * third-party mail account.
 *
 * The expiry stays defined here because the login form quotes it to the person
 * waiting. It must match `otp_expiry` in `supabase/config.toml`, which is what
 * actually enforces it.
 */
export const CODE_TTL_MINUTES = 10;

/* -------------------------------------------------------------- sessions */

export const SESSION_COOKIE = "herdwise_session";
export const SESSION_HOURS = 12;

export type Session = { sub: string; v: number; exp: number };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Set a value of at least 32 characters.",
    );
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/**
 * A stateless signed cookie rather than a sessions table.
 *
 * The trade is that a cookie cannot be individually revoked before it expires.
 * `token_version` covers the case that matters: bumping it on the staff row
 * invalidates every session already issued to that person at once.
 */
export function issueSession(staffId: string, tokenVersion: number): string {
  const body: Session = {
    sub: staffId,
    v: tokenVersion,
    exp: Date.now() + SESSION_HOURS * 3_600_000,
  };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (typeof body.exp !== "number" || body.exp < Date.now()) return null;
    if (typeof body.sub !== "string" || typeof body.v !== "number") return null;
    return body;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ challenge */

/**
 * Carries step one to step two without trusting the browser with an identity.
 *
 * The code-entry request has to say who is being verified. Sending the staff id
 * back and forth would let a caller swap it for somebody else\'s, so the subject
 * travels inside a short-lived signed token instead — the client can hold it but
 * cannot alter it, and it expires with the code it belongs to.
 */
export function issueChallenge(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + CODE_TTL_MINUTES * 60_000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readChallenge(token: string | undefined): { email: string } | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      email: string; exp: number;
    };
    if (typeof body.email !== "string" || typeof body.exp !== "number") return null;
    if (body.exp < Date.now()) return null;
    return { email: body.email };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Secure in production; localhost is served over plain http during testing.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  };
}

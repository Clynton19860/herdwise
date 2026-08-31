import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Auth, used only to deliver and check the six-digit code.
 *
 * Identity still lives in `staff`, and the session is still this app's own
 * signed cookie. What Supabase provides is the part that would otherwise need a
 * mail account: it generates the code, sends it through its own mailer using the
 * branded templates in `supabase/templates`, and verifies it. No third-party
 * SMTP, no new dependency, and one place where the email design lives.
 *
 * The anon key is correct here: this runs after the password has already been
 * checked against `staff`, so the code is being sent to somebody who has proven
 * they know the password.
 *
 * Worth knowing: Supabase's built-in mailer allows two emails an hour by
 * default. That is fine for a pilot and not for a ward. Raising it means
 * attaching a custom SMTP server in the project settings — no code changes.
 */
function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Sends the branded six-digit sign-in code. */
export async function sendSignInCode(email: string): Promise<{ ok: boolean; reason?: string }> {
  const { error } = await client().auth.signInWithOtp({
    email,
    options: {
      // The person already exists in `staff`; this creates their matching
      // Supabase identity the first time they sign in.
      shouldCreateUser: true,
    },
  });
  if (error) {
    console.error(`[auth] could not send code to ${email}: ${error.message}`);
    return { ok: false, reason: error.message };
  }
  return { ok: true };
}

/**
 * Sends the branded password-reset code.
 *
 * Which Supabase call is made decides which template is sent — this one reaches
 * `reset-password.html`, `sendSignInCode` reaches `magic-link.html`, and
 * `sendInviteCode` reaches `sign-up.html`. They are not interchangeable.
 */
export async function sendResetCode(email: string): Promise<{ ok: boolean }> {
  const { error } = await client().auth.resetPasswordForEmail(email);
  if (error) {
    console.error(`[auth] could not send reset code to ${email}: ${error.message}`);
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Sends the branded account-setup code.
 *
 * `signUp` is what triggers the confirmation template. The password given here
 * is random and immediately discarded: Supabase requires one, but this platform
 * keeps its own hash in `staff`, and the person chooses that at the end of the
 * flow. Nothing ever signs in with this value.
 */
export async function sendInviteCode(email: string): Promise<{ ok: boolean }> {
  const { error } = await client().auth.signUp({
    email,
    password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
  });
  if (error) {
    console.error(`[auth] could not send invite to ${email}: ${error.message}`);
    return { ok: false };
  }
  return { ok: true };
}

/** Checks a six-digit code. Returns true only if Supabase accepts it. */
export async function checkSignInCode(
  email: string,
  token: string,
  type: "email" | "recovery" | "signup" = "email",
): Promise<boolean> {
  const supabase = client();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type });
  if (error || !data.session) return false;
  // The Supabase session has done its job. This app carries its own, so end
  // Supabase's rather than leaving a second live session behind.
  await supabase.auth.signOut().catch(() => {});
  return true;
}

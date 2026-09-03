"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Email and password, and that is the whole sign-in.
 *
 * This used to ask for a six-digit code as a second step. It was removed
 * because the mailer allows two messages an hour, so somebody signing in three
 * times in a morning — which is what a ward office actually does — was locked
 * out by their own security. Codes still guard the moments that matter:
 * accepting an invitation, resetting a password, changing an email.
 */
export function LoginForm({
  testEmail,
  testPassword,
}: {
  testEmail: string | null;
  testPassword: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [email, setEmail] = useState(testEmail ?? "");
  const [password, setPassword] = useState(testPassword ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not sign in.");
        return;
      }
      // `next` only applies when it is a page this principal can open; the
      // server says where home is for them.
      router.replace(next !== "/dashboard" ? next : (data.home ?? "/dashboard"));
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <span className="h-11 w-11 rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] grid place-items-center text-emerald-950 shadow-[0_8px_24px_-8px_rgba(0,245,160,0.6)]">
          <I.Cow size={22} />
        </span>
        <div>
          <div className="text-xl font-semibold tracking-tight">
            Herd<span className="text-emerald-300">wise</span>
          </div>
          <div className="text-xs text-white/50">City of Harare · livestock platform</div>
        </div>
      </div>

      <div className="glass-solid rounded-3xl p-6 sm:p-7">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
            <p className="text-xs text-white/55 mt-1">
              Use the email and password for your Herdwise account.
            </p>
          </div>

          <label className="block">
            <span className="text-xs text-white/55">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full h-11 rounded-2xl px-3.5 glass-thin bg-transparent outline-none text-sm
                focus:ring-2 focus:ring-emerald-400/40"
            />
          </label>

          <label className="block">
            <span className="text-xs text-white/55">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full h-11 rounded-2xl px-3.5 glass-thin bg-transparent outline-none text-sm
                focus:ring-2 focus:ring-emerald-400/40"
            />
          </label>

          {error && (
            <p className="text-sm text-rose-200 flex items-start gap-2">
              <I.Alert size={14} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <div className="flex items-center justify-between text-xs text-white/45 pt-1">
            <Link href="/reset" className="hover:text-white/75 transition-colors">
              Forgot your password?
            </Link>
            <Link href="/setup" className="hover:text-white/75 transition-colors">
              Have an invitation?
            </Link>
          </div>
        </form>
      </div>

      {testEmail && (
        <div className="mt-4 glass-thin rounded-2xl p-4 text-xs text-white/65">
          <div className="flex items-center gap-2 mb-1.5">
            <Badge tone="amber">Testing credentials</Badge>
          </div>
          <div className="font-mono">{testEmail}</div>
          <div className="font-mono">{testPassword}</div>
          <p className="mt-2 text-white/45 leading-snug">
            Shown because AUTH_SHOW_CODE is set. Unset it and these disappear.
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Option = { kind: "staff" | "owner"; subjectId: string; role: string; label: string; ward: string | null };

/**
 * Email and password, and — for somebody who wears more than one hat — which.
 *
 * The six-digit second step was removed because the mailer allows two messages
 * an hour, so signing in three times in a morning locked people out of their
 * own platform. Codes still guard accepting an invitation and resetting a
 * password, which happen once.
 *
 * The second step here is a different thing entirely: it asks nothing about
 * identity, only which role to act as. Most people never see it — it appears
 * when one address holds a council post and a farm, which is exactly the case
 * the old two-table model could not express at all.
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
  const [options, setOptions] = useState<Option[] | null>(null);
  const [challenge, setChallenge] = useState("");

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
      if (data.choose) {
        setChallenge(data.challenge);
        setOptions(data.options as Option[]);
        return;
      }
      land(data.home);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function choose(o: Option) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challenge, kind: o.kind, subjectId: o.subjectId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not open that role.");
        return;
      }
      land(data.home);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  // `next` only applies when it is a page this principal can open; the server
  // says where home is for them.
  function land(home?: string) {
    router.replace(next !== "/dashboard" ? next : (home ?? "/dashboard"));
    router.refresh();
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
        {options ? (
          <div className="space-y-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Continue as</h1>
              <p className="text-xs text-white/55 mt-1">
                This account holds more than one role. Pick the one you need — you can
                sign out and back in to change it.
              </p>
            </div>

            <div className="space-y-2">
              {options.map((o) => (
                <button
                  key={`${o.kind}:${o.subjectId}`}
                  type="button"
                  disabled={busy}
                  onClick={() => choose(o)}
                  className="w-full text-left glass-thin rounded-2xl px-4 py-3 flex items-center gap-3
                    hover:bg-white/8 disabled:opacity-50 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                >
                  <span
                    aria-hidden
                    className="h-9 w-9 rounded-xl grid place-items-center shrink-0 bg-white/8"
                  >
                    {o.kind === "owner" ? <I.Cow size={16} /> : <I.Shield size={16} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm truncate">{o.label}</span>
                    <span className="block text-[11px] text-white/45 capitalize">
                      {o.kind === "owner" ? "Farm owner" : o.role}
                      {o.ward ? ` · ${o.ward}` : ""}
                    </span>
                  </span>
                  <I.ArrowRight size={14} className="ml-auto shrink-0 text-white/40" />
                </button>
              ))}
            </div>

            {error && (
              <p className="text-sm text-rose-200 flex items-start gap-2">
                <I.Alert size={14} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => { setOptions(null); setError(null); }}
              className="w-full text-xs text-white/55 hover:text-white/85 transition-colors"
            >
              Use a different account
            </button>
          </div>
        ) : (
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
        )}
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

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Two steps: a password, then a six-digit code.
 *
 * The second step is the point — a leaked password on its own is not enough to
 * get in. The form keeps the challenge token the server issued rather than the
 * email or an id, so nothing the browser holds can be edited into somebody
 * else's sign-in.
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

  const [step, setStep] = useState<"password" | "code">("password");
  const [email, setEmail] = useState(testEmail ?? "");
  const [password, setPassword] = useState(testPassword ?? "");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function submitPassword(e: React.FormEvent) {
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
      setChallenge(data.challenge);
      setDevCode(data.code ?? null);
      setStep("code");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challenge, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That code is not right.");
        return;
      }
      router.replace(next);
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
        {step === "password" ? (
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
              <p className="text-xs text-white/55 mt-1">
                We&rsquo;ll send a six-digit code to confirm it&rsquo;s you.
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
              {busy ? "Checking…" : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Enter your code</h1>
              <p className="text-xs text-white/55 mt-1">
                Six digits, valid for ten minutes.
              </p>
            </div>

            {devCode && (
              <div className="glass-thin rounded-2xl p-3 flex items-center gap-3">
                <Badge tone="amber">Testing</Badge>
                <span className="text-sm">
                  Your code is <strong className="font-mono tracking-[0.2em]">{devCode}</strong>
                </span>
              </div>
            )}

            <label className="block">
              <span className="text-xs text-white/55">Verification code</span>
              <input
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1.5 w-full h-14 rounded-2xl px-3.5 glass-thin bg-transparent outline-none
                  text-2xl font-mono tracking-[0.45em] text-center focus:ring-2 focus:ring-emerald-400/40"
              />
            </label>

            {error && (
              <p className="text-sm text-rose-200 flex items-start gap-2">
                <I.Alert size={14} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={busy || code.length !== 6}
            >
              {busy ? "Verifying…" : "Sign in"}
            </Button>

            <button
              type="button"
              onClick={() => { setStep("password"); setCode(""); setError(null); }}
              className="w-full text-xs text-white/55 hover:text-white/85 transition-colors"
            >
              Use a different email
            </button>
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
            Shown because AUTH_SHOW_CODE is set. Unset it and these disappear, along
            with the code on the next screen.
          </p>
        </div>
      )}
    </div>
  );
}

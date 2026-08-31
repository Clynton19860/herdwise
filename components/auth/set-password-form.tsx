"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

/**
 * Resetting a forgotten password and completing an invitation are the same
 * three steps — prove the address, prove the code, choose a password — so they
 * are the same form. Only the words and the kind of code differ, and both come
 * from `flow`.
 */
export function SetPasswordForm({ flow }: { flow: "reset" | "invite" }) {
  const router = useRouter();
  const copy =
    flow === "reset"
      ? {
          title: "Reset your password",
          lead: "Enter your email and we'll send a six-digit code.",
          step2: "Enter the code we emailed you, then choose a new password.",
          done: "Password changed. You can sign in with it now.",
        }
      : {
          title: "Set up your account",
          lead: "Enter the email your invitation was sent to. The code is already in your inbox.",
          step2: "Enter the code from your invitation, then choose a password.",
          done: "Your account is ready. Sign in to continue.",
        };

  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // An invitation's code was already sent when the account was created, so
      // that flow only needs a challenge to carry the address forward. Asking
      // /api/auth/reset would send a recovery code, which cannot finish a sign-up.
      const res = await fetch(flow === "reset" ? "/api/auth/reset" : "/api/auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send a code.");
        return;
      }
      setChallenge(data.challenge);
      setStep("code");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challenge, code, password, flow }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not set your password.");
        return;
      }
      setStep("done");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1.5 w-full h-11 rounded-2xl px-3.5 glass-thin bg-transparent outline-none text-sm focus:ring-2 focus:ring-emerald-400/40";

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <span className="h-11 w-11 rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] grid place-items-center text-emerald-950">
          <I.Cow size={22} />
        </span>
        <div className="text-xl font-semibold tracking-tight">
          Herd<span className="text-emerald-300">wise</span>
        </div>
      </div>

      <div className="glass-solid rounded-3xl p-6 sm:p-7">
        {step === "done" ? (
          <div className="text-center py-2">
            <I.Check size={26} className="mx-auto text-emerald-300" />
            <h1 className="mt-3 text-lg font-semibold tracking-tight">{copy.done}</h1>
            <Button
              variant="primary"
              className="w-full mt-5"
              onClick={() => router.push("/login")}
            >
              Go to sign in
            </Button>
          </div>
        ) : step === "email" ? (
          <form onSubmit={requestCode} className="space-y-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{copy.title}</h1>
              <p className="text-xs text-white/55 mt-1">{copy.lead}</p>
            </div>
            <label className="block">
              <span className="text-xs text-white/55">Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
              />
            </label>
            {error && (
              <p className="text-sm text-rose-200 flex items-start gap-2">
                <I.Alert size={14} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              {busy ? "Sending…" : flow === "reset" ? "Send code" : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Choose a password</h1>
              <p className="text-xs text-white/55 mt-1">{copy.step2}</p>
            </div>

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
                className="mt-1.5 w-full h-13 rounded-2xl px-3.5 py-2.5 glass-thin bg-transparent outline-none
                  text-xl font-mono tracking-[0.4em] text-center focus:ring-2 focus:ring-emerald-400/40"
              />
            </label>

            <label className="block">
              <span className="text-xs text-white/55">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
              />
              <span className="mt-1 block text-[11px] text-white/40">
                At least 10 characters. Length beats punctuation — a short phrase you
                will remember is stronger than a mangled word.
              </span>
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
              disabled={busy || code.length !== 6 || password.length < 10}
            >
              {busy ? "Saving…" : "Set password"}
            </Button>
          </form>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-white/45">
        <Link href="/login" className="hover:text-white/75 transition-colors">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

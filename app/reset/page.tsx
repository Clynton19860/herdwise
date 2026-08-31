import { SetPasswordForm } from "@/components/auth/set-password-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset your password — Herdwise" };

export default function ResetPage() {
  return (
    <main className="min-h-dvh grid place-items-center px-4 py-10">
      <SetPasswordForm flow="reset" />
    </main>
  );
}

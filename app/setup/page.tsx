import { SetPasswordForm } from "@/components/auth/set-password-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your account — Herdwise" };

export default function SetupPage() {
  return (
    <main className="min-h-dvh grid place-items-center px-4 py-10">
      <SetPasswordForm flow="invite" />
    </main>
  );
}

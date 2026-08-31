import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — Herdwise",
};

/**
 * The test credentials are rendered only when AUTH_SHOW_CODE is set, so they
 * cannot reach a deployment that does not opt in. They are read on the server
 * and passed down; the values never appear in the client bundle otherwise.
 */
export default function LoginPage() {
  const showTest = process.env.AUTH_SHOW_CODE === "1";
  return (
    <main className="min-h-dvh grid place-items-center px-4 py-10">
      <LoginForm
        testEmail={showTest ? process.env.AUTH_TEST_EMAIL ?? null : null}
        testPassword={showTest ? process.env.AUTH_TEST_PASSWORD ?? null : null}
      />
    </main>
  );
}

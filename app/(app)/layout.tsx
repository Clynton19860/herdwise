import { Sidebar } from "@/components/app/sidebar";
import { MobileNavProvider } from "@/components/app/mobile-nav";
import { AskHerdwise } from "@/components/ai/ask-herdwise";
import { DatabaseSetupNotice } from "@/components/app/db-setup-notice";
import { redirect } from "next/navigation";
import { getAssistantContext, isDatabaseConfigured } from "@/lib/db";
import { currentStaff } from "@/lib/session";

/**
 * Everything under this group reads live telemetry, so nothing here can be
 * prerendered at build time. Applies to every child route.
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = isDatabaseConfigured();

  /**
   * The real guard. `proxy.ts` only checks that a cookie is present, which is
   * cheap and runs at the edge; this verifies the signature, that the account is
   * still active, and that the session has not been revoked. Everything below
   * reads live data, so it must not render for a visitor who is not signed in.
   */
  const staff = configured ? await currentStaff() : null;
  if (configured && !staff) redirect("/login");

  const operator = staff
    ? {
        name: staff.fullName,
        role: staff.role,
        ward: staff.ward,
        initials: staff.fullName
          .replace(/^(Insp\.|Sgt\.|Dr\.|Mr\.|Mrs\.|Ms\.)\s*/i, "")
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      }
    : null;

  const assistant = configured
    ? await getAssistantContext()
    : { tag: null, ward: null };

  return (
    <MobileNavProvider operator={operator}>
      <div className="flex min-h-dvh gap-4 lg:gap-5 p-3 sm:p-4 lg:p-5">
        <Sidebar operator={operator} />
        {/* Bottom padding keeps the last card clear of the floating assistant. */}
        <main className="page-enter flex-1 min-w-0 space-y-4 sm:space-y-5 lg:space-y-6 pb-24">
          {configured ? children : <DatabaseSetupNotice />}
        </main>
      </div>
      {/* Only offered where a model key is configured. */}
      <AskHerdwise
        enabled={Boolean(process.env.ANTHROPIC_API_KEY)}
        sampleTag={assistant.tag}
        sampleWard={assistant.ward}
      />
    </MobileNavProvider>
  );
}

import { Sidebar } from "@/components/app/sidebar";
import { MobileNavProvider } from "@/components/app/mobile-nav";
import { AskHerdwise } from "@/components/ai/ask-herdwise";
import { DatabaseSetupNotice } from "@/components/app/db-setup-notice";
import { getAssistantContext, getOperator, isDatabaseConfigured } from "@/lib/db";

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
  // The shell shows a real staff row and the assistant offers suggestions that
  // name real records — both are read here so nothing downstream invents them.
  const configured = isDatabaseConfigured();
  const [operator, assistant] = configured
    ? await Promise.all([getOperator(), getAssistantContext()])
    : [null, { tag: null, ward: null }];

  return (
    <MobileNavProvider operator={operator}>
      <div className="flex min-h-dvh gap-4 lg:gap-5 p-3 sm:p-4 lg:p-5">
        <Sidebar operator={operator} />
        <main className="page-enter flex-1 min-w-0 space-y-4 sm:space-y-5 lg:space-y-6">
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

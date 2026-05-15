import { Sidebar } from "@/components/app/sidebar";
import { MobileNavProvider } from "@/components/app/mobile-nav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileNavProvider>
      <div className="flex min-h-dvh gap-4 lg:gap-5 p-3 sm:p-4 lg:p-5">
        <Sidebar />
        <main className="page-enter flex-1 min-w-0 space-y-4 sm:space-y-5 lg:space-y-6">
          {children}
        </main>
      </div>
    </MobileNavProvider>
  );
}

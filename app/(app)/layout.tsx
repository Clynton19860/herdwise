import { Sidebar } from "@/components/app/sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh gap-4 lg:gap-5 p-4 lg:p-5">
      <Sidebar />
      <main className="page-enter flex-1 min-w-0 space-y-5 lg:space-y-6">
        {children}
      </main>
    </div>
  );
}

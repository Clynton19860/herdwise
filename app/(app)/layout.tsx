import { Sidebar } from "@/components/app/sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 lg:pr-6 lg:py-4 lg:pl-0 space-y-4">
        {children}
      </main>
    </div>
  );
}

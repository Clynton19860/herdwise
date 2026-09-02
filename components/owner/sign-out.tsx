"use client";

import { useRouter } from "next/navigation";
import { I } from "@/components/ui/icon";

export function OwnerSignOut() {
  const router = useRouter();
  return (
    <button
      aria-label="Sign out"
      onClick={async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch {
          // Signing out locally still matters if the request failed.
        }
        router.push("/login");
        router.refresh();
      }}
      className="h-9 w-9 grid place-items-center rounded-xl text-white/55 hover:text-rose-300 hover:bg-rose-400/10 transition-colors shrink-0"
    >
      <I.Logout size={16} />
    </button>
  );
}

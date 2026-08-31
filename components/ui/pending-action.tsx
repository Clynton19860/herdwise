import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

/**
 * An action the interface offers but the platform cannot perform yet.
 *
 * These controls — acknowledge, escalate, resolve, archive, notify, add record —
 * all write, and all of them need to record *who* did it. Without authentication
 * there is no answer to that, so none of them can be wired up honestly.
 *
 * Leaving them looking live is the worse option: a button that answers a click
 * by doing nothing teaches people not to trust anything else on the screen. They
 * render disabled, with a note beside the group saying why, so the intent stays
 * visible without the affordance lying about it.
 *
 * Takes exactly Button's props, so a call site changes by name only.
 */
export function PendingAction(props: ComponentProps<typeof Button>) {
  return <Button {...props} disabled />;
}

/** Explains a group of PendingAction controls. */
export function PendingNote({ children }: { children?: React.ReactNode }) {
  return (
    <p className="text-[11px] text-white/40 leading-snug">
      {children ?? "These actions record who performed them, so they need sign-in — coming next."}
    </p>
  );
}

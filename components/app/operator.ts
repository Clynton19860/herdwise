import type { Operator } from "@/lib/db";

/**
 * How the shell labels the person at the keyboard.
 *
 * There is no authentication yet, so there is no authenticated identity to
 * show. The shell used to hardcode an officer's name that appeared in no table,
 * which reads as a real account rather than as the placeholder it was. Until
 * auth lands, show a genuine staff row — and when there is none, say plainly
 * that nobody is signed in.
 */
export function operatorLabel(operator?: Operator | null) {
  if (!operator) {
    return { initials: "—", name: "Not signed in", sub: "Authentication pending" };
  }
  return {
    initials: operator.initials,
    name: operator.name,
    sub: [operator.role.replace(/^./, (c) => c.toUpperCase()), operator.ward]
      .filter(Boolean)
      .join(" · "),
  };
}

import Link from "next/link";
import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { I } from "@/components/ui/icon";
import { BatteryBar } from "@/components/app/indicators";
import { getFleetStats, getTagInventory } from "@/lib/db";
import { formatShortDateTime } from "@/lib/time";

/**
 * The tag inventory.
 *
 * Ten tags were configured onto the gateway over one afternoon and nine of them
 * could not be seen anywhere in this application, because every device figure on
 * every screen was derived from the animal list. A tag that had arrived but was
 * not yet on an animal did not exist to the interface.
 *
 * This page answers the four questions somebody running a rollout actually asks:
 * did it arrive, is it charged, can it see satellites, and what is it on.
 */
export const dynamic = "force-dynamic";

function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

/** "now", "4 min", "3 h", "2 d" — a rollout is watched in minutes, not dates. */
function ago(iso: string | null): string {
  const m = minutesSince(iso);
  if (m === null) return "never";
  if (m < 1) return "now";
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} d`;
}

export default async function TagsPage() {
  const [tags, fleet] = await Promise.all([getTagInventory(), getFleetStats()]);

  return (
    <>
      <Topbar
        title="Tags"
        subtitle={
          fleet.total === 0
            ? "No tags have reached the gateway yet"
            : `${fleet.total} tag${fleet.total === 1 ? "" : "s"} known · ${fleet.online} reporting now`
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <GlassCard className="p-5">
          <div className="text-xs text-white/55">Reporting now</div>
          <div className="text-3xl font-semibold tracking-tight mt-1 text-emerald-300">
            {fleet.online}
          </div>
          <div className="text-[11px] text-white/40 mt-1">seen in the last 10 minutes</div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="text-xs text-white/55">Not reporting</div>
          <div className="text-3xl font-semibold tracking-tight mt-1">
            {fleet.total - fleet.online}
          </div>
          <div className="text-[11px] text-white/40 mt-1">of {fleet.total} known</div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="text-xs text-white/55">Unassigned</div>
          <div className="text-3xl font-semibold tracking-tight mt-1 text-cyan-300">
            {fleet.unassigned}
          </div>
          <div className="text-[11px] text-white/40 mt-1">spare, ready for an animal</div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="text-xs text-white/55">Battery under 30%</div>
          <div className={`text-3xl font-semibold tracking-tight mt-1 ${
            fleet.lowBattery > 0 ? "text-amber-200" : ""}`}>
            {fleet.lowBattery}
          </div>
          <div className="text-[11px] text-white/40 mt-1">need charge before configuring</div>
        </GlassCard>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        {tags.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-sm text-white/70">No tags yet</div>
            <p className="text-xs text-white/45 mt-1.5 max-w-sm mx-auto leading-relaxed">
              A tag appears here the moment it opens a session with the gateway. Nothing
              needs registering first — the gateway records an unknown IMEI on contact.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-white/45">
                  <th className="px-4 py-3 font-medium">IMEI</th>
                  <th className="px-4 py-3 font-medium">Battery</th>
                  <th className="px-4 py-3 font-medium">Signal</th>
                  <th className="px-4 py-3 font-medium">Last contact</th>
                  <th className="px-4 py-3 font-medium">GPS</th>
                  <th className="px-4 py-3 font-medium">On</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((t) => {
                  const online = (minutesSince(t.lastSeenAt) ?? 9e9) < 10;
                  return (
                    <tr key={t.id} className="border-t border-white/8 hover:bg-white/4 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              online ? "bg-emerald-400" : "bg-white/25"}`}
                          />
                          <span className="font-mono text-[13px]">{t.imei}</span>
                        </div>
                        <span className="sr-only">{online ? "reporting" : "not reporting"}</span>
                      </td>
                      <td className="px-4 py-3">
                        {t.batteryPct == null
                          ? <span className="text-white/35">—</span>
                          : <div className="w-24"><BatteryBar value={t.batteryPct} /></div>}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-white/70">
                        {t.signalPct == null ? "—" : `${t.signalPct}%`}
                      </td>
                      <td className="px-4 py-3">
                        <div className="tabular-nums">{ago(t.lastSeenAt)}</div>
                        {t.lastSeenAt && (
                          <div className="text-[11px] text-white/40">
                            {formatShortDateTime(t.lastSeenAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.fixes === 0 ? (
                          <span className="text-white/35">no fix yet</span>
                        ) : (
                          <div>
                            <div className="tabular-nums">
                              {t.satellites != null ? `${t.satellites} sats` : "fixed"}
                            </div>
                            <div className="text-[11px] text-white/40 tabular-nums">
                              {t.fixes} position{t.fixes === 1 ? "" : "s"}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.animalId ? (
                          <Link
                            href={`/livestock/${t.animalId}`}
                            className="text-emerald-300 hover:text-emerald-200 transition-colors"
                          >
                            {t.animalTag ?? t.animalName ?? "an animal"}
                            {t.ownerName && (
                              <span className="block text-[11px] text-white/40">{t.ownerName}</span>
                            )}
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-cyan-200/90 text-[13px]">
                            <I.Alert size={12} />
                            unassigned
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {fleet.unassigned > 0 && (
        <p className="mt-4 text-xs text-white/45 leading-relaxed max-w-2xl">
          {fleet.unassigned} tag{fleet.unassigned === 1 ? " is" : "s are"} not on an animal yet.
          A tag is attached from the animal it belongs to — open the animal and use{" "}
          <span className="text-white/70">Assign tag</span>, or register a new animal and
          choose the tag at the device step.
        </p>
      )}
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";
import { StatusBadge, BatteryBar } from "@/components/app/indicators";
import { FieldMap } from "@/components/map/field-map";
import { formatShortDateTime } from "@/lib/time";
import { getHerd, getHerdMap, getHerdParcels, getOwnerBreaches } from "@/lib/db";
import { currentPrincipal } from "@/lib/principal";

export const dynamic = "force-dynamic";
export const metadata = { title: "My herd — Herdwise" };

/**
 * A farmer's own herd, and nothing else.
 *
 * Every query below takes this owner's id. There is no filter applied after the
 * fact and no "all animals" query anywhere on this page — the scope is in the
 * function signatures.
 */
export default async function MyHerdPage() {
  const principal = await currentPrincipal();
  if (principal?.kind !== "owner") redirect("/login?next=/my");

  const [herd, mapAnimals, parcels, breaches] = await Promise.all([
    getHerd(principal.id),
    getHerdMap(principal.id),
    getHerdParcels(principal.id),
    getOwnerBreaches(principal.id),
  ]);

  const open = breaches.filter((b) => !b.closed_at);
  const reporting = herd.filter((a) => a.device.lastSyncMin < 180).length;
  const lowBattery = herd.filter((a) => a.device.battery > 0 && a.device.battery < 25);

  return (
    <>
      {open.length > 0 && (
        <GlassCard className="p-5 border-rose-400/30">
          <div className="flex items-start gap-3">
            <I.Alert size={20} className="text-rose-300 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                {open.length === 1 ? "An animal is outside its area" : `${open.length} animals are outside their areas`}
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-white/75">
                {open.map((b) => (
                  <li key={b.id}>
                    <b>{b.tag}</b> left {b.parcel ?? "its area"} at {formatShortDateTime(b.opened_at)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-white/55">
                The ward office has been notified.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="My animals" value={String(herd.length)} />
        <Stat label="Reporting" value={`${reporting} of ${herd.length}`} />
        <Stat label="Outside their area" value={String(open.length)} tone={open.length ? "coral" : undefined} />
        <Stat label="Batteries low" value={String(lowBattery.length)} tone={lowBattery.length ? "amber" : undefined} />
      </div>

      <GlassCard className="p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-3 px-1">
          <h2 className="text-base font-semibold tracking-tight">Where they are</h2>
          <Badge tone="veld" dot>Live</Badge>
        </div>
        <div className="h-[300px] sm:h-[420px]">
          <FieldMap animals={mapAnimals} parcels={parcels} className="h-full w-full" />
        </div>
      </GlassCard>

      <div>
        <h2 className="text-base font-semibold tracking-tight px-1 mb-3">My animals</h2>
        {herd.length === 0 ? (
          <GlassCard className="p-10 text-center">
            <I.Cow size={26} className="mx-auto text-white/35" />
            <div className="mt-3 text-sm">No animals registered yet</div>
            <p className="mt-1 text-xs text-white/55">
              Your ward office registers animals against your name. They will appear here.
            </p>
          </GlassCard>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {herd.map((a) => (
              <GlassCard key={a.id} className="p-5">
                <div className="flex items-start gap-3">
                  <span className="h-11 w-11 rounded-2xl glass-thin grid place-items-center text-emerald-300 shrink-0">
                    <I.Cow size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold tracking-tight truncate">{a.name ?? a.tag}</div>
                    <div className="text-xs text-white/50 font-mono">{a.tag}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Field label="Area" value={a.location.zone} />
                  <Field label="Species" value={a.species} />
                </div>
                <div className="mt-4 flex items-center gap-3 text-xs text-white/55">
                  <span className="flex items-center gap-1.5" title={`Battery ${a.device.battery}%`}>
                    <span className="sr-only">Battery</span>
                    <BatteryBar value={a.device.battery} />
                  </span>
                  <span className="ml-auto">
                    {a.device.lastSyncMin < 60
                      ? `seen ${a.device.lastSyncMin}m ago`
                      : `seen ${Math.round(a.device.lastSyncMin / 60)}h ago`}
                  </span>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-white/35 pt-2">
        <Link href="/my/profile" className="hover:text-white/60 transition-colors">My details</Link>
      </p>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "coral" | "amber" }) {
  const colour = tone === "coral" ? "text-rose-300" : tone === "amber" ? "text-amber-300" : "";
  return (
    <GlassCard className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold tracking-tighter tabular-nums ${colour}`}>{value}</div>
    </GlassCard>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/45">{label}</div>
      <div className="mt-0.5 truncate">{value}</div>
    </div>
  );
}

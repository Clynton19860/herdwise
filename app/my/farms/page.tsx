import { redirect } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";
import { getWards } from "@/lib/db";
import { canAppoint, currentPrincipal } from "@/lib/principal";
import { CreateFarm } from "@/components/owner/create-farm";
import { FarmPeople } from "@/components/owner/farm-people";

export const dynamic = "force-dynamic";
export const metadata = { title: "My farms — Herdwise" };

/**
 * The places this person runs, and who works on each.
 *
 * A farm is the unit of tenancy: its areas, animals and people belong to it, and
 * no farm can see another. Somebody can run more than one, and a vet may attend
 * several without belonging to any of them.
 */
export default async function MyFarmsPage() {
  const principal = await currentPrincipal();
  if (principal?.kind !== "owner") redirect("/login?next=/my/farms");

  const wards = await getWards();

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-1 flex-wrap">
        <h1 className="text-lg font-semibold tracking-tight">My farms</h1>
        <CreateFarm wards={wards.map((w) => w.name)} firstTime={principal.farms.length === 0} />
      </div>

      {principal.farms.map((farm) => (
        <GlassCard key={farm.id} className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold tracking-tight">{farm.name}</h2>
              <p className="text-xs text-white/55 mt-0.5">
                {[farm.district, farm.ward].filter(Boolean).join(" \u00b7 ") || "No district recorded"}
              </p>
            </div>
            <Badge tone={farm.role === "owner" ? "veld" : "violet"}>{farm.role}</Badge>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <Tile label="Animals" value={farm.animals} />
            <Tile label="Areas" value={farm.areas} />
            <Tile label="People" value={farm.members} />
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold tracking-tight mb-3">Who works here</h3>
            <FarmPeople farmId={farm.id} canAppoint={canAppoint(principal, farm.id)} />
          </div>
        </GlassCard>
      ))}

      {principal.farms.length === 0 && (
        <GlassCard className="p-10 text-center">
          <I.Layers size={26} className="mx-auto text-white/35" />
          <div className="mt-3 text-sm">No farms yet</div>
          <p className="mt-1 text-xs text-white/55">
            Create one and everything else hangs off it.
          </p>
        </GlassCard>
      )}
    </>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-thin rounded-2xl p-3 text-center">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/45 mt-0.5">{label}</div>
    </div>
  );
}

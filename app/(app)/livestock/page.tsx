import Link from "next/link";
import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Button, LinkButton } from "@/components/ui/button";
import { I } from "@/components/ui/icon";
import { StatusBadge, BatteryBar } from "@/components/app/indicators";
import { animals, owners, findOwner } from "@/lib/data";

const speciesCounts = animals.reduce<Record<string, number>>((acc, a) => {
  acc[a.species] = (acc[a.species] ?? 0) + 1;
  return acc;
}, {});

const filters = [
  { label: "All",           count: animals.length, active: true },
  { label: "Cattle",        count: speciesCounts.Cattle ?? 0 },
  { label: "Goats",         count: speciesCounts.Goat ?? 0 },
  { label: "Sheep",         count: speciesCounts.Sheep ?? 0 },
  { label: "Donkey",        count: speciesCounts.Donkey ?? 0 },
  { label: "Alerts",        count: animals.filter((a) => a.status === "Alert").length },
  { label: "Quarantined",   count: animals.filter((a) => a.status === "Quarantined").length },
];

export default function LivestockPage() {
  return (
    <>
      <Topbar
        title="Livestock registry"
        subtitle={`${animals.length} animals tracked in the pilot — ${owners.length} farmers`}
      />

      {/* ===== Action bar ===== */}
      <GlassCard className="p-3 flex flex-wrap items-center gap-2 sticky top-5 z-10">
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.label}
              className={`h-9 px-3.5 rounded-2xl text-sm font-medium transition-colors flex items-center gap-2
                ${f.active
                  ? "glass text-white"
                  : "text-white/65 hover:text-white hover:bg-white/6"}`}
            >
              {f.label}
              <span className="text-[10px] font-mono px-1.5 rounded-md bg-white/10 text-white/70">
                {f.count}
              </span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="glass" iconLeft={<I.Filter size={14} />}>
            More filters
          </Button>
          <LinkButton href="/livestock/new" size="sm" variant="primary" iconLeft={<I.Plus size={14} />}>
            Register animal
          </LinkButton>
        </div>
      </GlassCard>

      {/* ===== Animal grid ===== */}
      <div className="grid-stagger grid md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
        {animals.map((a) => {
          const owner = findOwner(a.ownerId);
          return (
            <GlassCard
              key={a.id}
              hover
              className="p-6 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl glass-thin grid place-items-center">
                    <SpeciesIcon species={a.species} />
                  </div>
                  <div>
                    <div className="text-base font-semibold leading-tight">
                      {a.name ?? "Unnamed"}
                    </div>
                    <div className="text-xs font-mono text-white/60 leading-tight">
                      {a.tag}
                    </div>
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <Field label="Breed" value={a.breed} />
                <Field label="Sex" value={a.sex} />
                <Field label="Age" value={`${a.ageMonths} mo`} />
                <Field label="Weight" value={`${a.weightKg} kg`} />
                <Field label="Zone" value={a.location.zone} />
                <Field label="Device" value={a.device.type} />
              </dl>

              <div className="mt-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-xs text-white/55">
                  <div className="flex items-center gap-1.5">
                    <I.Wifi size={14} />
                    {a.device.signal}%
                  </div>
                  <BatteryBar value={a.device.battery} />
                </div>
                <Link
                  href={`/livestock/${a.id}`}
                  className="text-sm text-emerald-200 hover:text-emerald-100 inline-flex items-center gap-1"
                >
                  Open
                  <I.ArrowRight size={14} />
                </Link>
              </div>

              <div className="mt-5 pt-5 border-t border-white/8 flex items-center justify-between text-xs text-white/55">
                <span className="truncate">
                  Owner · <span className="text-white/80">{owner?.fullName}</span>
                </span>
                <span className="truncate">{owner?.ward}</span>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-white/45">{label}</dt>
      <dd className="mt-0.5 text-white/90">{value}</dd>
    </div>
  );
}

function SpeciesIcon({ species }: { species: string }) {
  if (species === "Cattle") return <I.Cow size={22} className="text-emerald-300" />;
  if (species === "Goat")   return <I.Cow size={22} className="text-amber-300" />;
  if (species === "Sheep")  return <I.Cow size={22} className="text-cyan-300" />;
  if (species === "Donkey") return <I.Cow size={22} className="text-violet-300" />;
  return <I.Cow size={22} className="text-white/80" />;
}

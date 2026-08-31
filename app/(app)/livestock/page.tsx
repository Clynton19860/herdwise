import Link from "next/link";
import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { LinkButton } from "@/components/ui/button";
import { I } from "@/components/ui/icon";
import { StatusBadge, BatteryBar } from "@/components/app/indicators";
import { PAGE_SIZE, countRows, getAnimals, getOwners } from "@/lib/db";
import { Pager } from "@/components/app/pager";
import type { Animal } from "@/lib/types";

/**
 * The filter tabs used to be buttons with no handler on a server component, so
 * every one of them showed the whole register. They are links carrying the
 * choice in the URL now, which keeps the page server-rendered, makes a filtered
 * view shareable, and means the back button behaves.
 */
type Params = Promise<{ view?: string; page?: string }>;

const FILTERS = [
  { label: "All",         match: () => true },
  { label: "Cattle",      match: (a: Animal) => a.species === "Cattle" },
  { label: "Goats",       match: (a: Animal) => a.species === "Goat" },
  { label: "Sheep",       match: (a: Animal) => a.species === "Sheep" },
  { label: "Donkey",      match: (a: Animal) => a.species === "Donkey" },
  { label: "Alerts",      match: (a: Animal) => a.status === "Alert" },
  { label: "Quarantined", match: (a: Animal) => a.status === "Quarantined" },
];

export default async function LivestockPage({ searchParams }: { searchParams: Params }) {
  const { view, page: pageParam } = await searchParams;
  const page = Math.max(0, (Number(pageParam) || 1) - 1);
  // The filter counts describe the whole register, so they are counted rather
  // than measured against the page that happens to be loaded.
  const [all, owners, total] = await Promise.all([
    getAnimals(page), getOwners(), countRows("animals"),
  ]);
  const findOwner = (id: string) => owners.find((o) => o.id === id);

  const active = FILTERS.find((f) => f.label === view) ?? FILTERS[0];
  const animals = all.filter(active.match);

  const filters = FILTERS.map((f) => ({
    label: f.label,
    count: all.filter(f.match).length,
    active: f.label === active.label,
  }));
  return (
    <>
      <Topbar
        title="Livestock registry"
        subtitle={
          `${animals.length} ${animals.length === 1 ? "animal" : "animals"} tracked in the pilot` +
          ` — ${owners.length} ${owners.length === 1 ? "farmer" : "farmers"}`
        }
      />

      {/* ===== Action bar ===== */}
      <GlassCard className="p-3 flex flex-wrap items-center gap-2 sticky top-5 z-10">
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map((f) => (
            <Link
              key={f.label}
              href={f.label === "All" ? "/livestock" : `/livestock?view=${encodeURIComponent(f.label)}`}
              aria-current={f.active ? "page" : undefined}
              className={`h-9 px-3.5 rounded-2xl text-sm font-medium transition-colors flex items-center gap-2
                ${f.active
                  ? "glass text-white"
                  : "text-white/65 hover:text-white hover:bg-white/6"}`}
            >
              {f.label}
              <span className="text-[10px] font-mono px-1.5 rounded-md bg-white/10 text-white/70">
                {f.count}
              </span>
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LinkButton href="/livestock/new" size="sm" variant="primary" iconLeft={<I.Plus size={14} />}>
            Register animal
          </LinkButton>
        </div>
      </GlassCard>

      {/* ===== Animal grid ===== */}
      {animals.length === 0 && (
        <GlassCard className="p-10 text-center">
          <I.Cow size={26} className="mx-auto text-white/35" />
          <div className="mt-3 text-sm">
            {all.length === 0 ? "No animals registered yet" : `No animals under “${active.label}”`}
          </div>
          <p className="mt-1 text-xs text-white/55">
            {all.length === 0
              ? "Register an animal to start tracking it."
              : "Try another filter, or clear it to see the whole register."}
          </p>
        </GlassCard>
      )}

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
                <Field label="Age" value={a.ageMonths != null ? `${a.ageMonths} mo` : "—"} />
                <Field label="Weight" value={a.weightKg != null ? `${a.weightKg} kg` : "—"} />
                <Field label="Zone" value={a.location.zone} />
                <Field label="Device" value={a.device.type} />
              </dl>

              <div className="mt-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-xs text-white/55">
                  <div className="flex items-center gap-1.5" title={`Signal ${a.device.signal}%`}>
                    <I.Wifi size={14} aria-hidden />
                    <span className="sr-only">Signal</span>
                    {a.device.signal}%
                  </div>
                  <div className="flex items-center gap-1.5" title={`Battery ${a.device.battery}%`}>
                    <span className="sr-only">Battery</span>
                    <BatteryBar value={a.device.battery} />
                  </div>
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
      <Pager
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        basePath="/livestock"
        params={{ view }}
      />
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

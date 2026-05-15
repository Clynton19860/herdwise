import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { I } from "@/components/ui/icon";
import { Sparkline } from "@/components/charts/sparkline";
import { Ring } from "@/components/charts/ring";
import { StatusBadge, BatteryBar } from "@/components/app/indicators";
import { animals, findOwner, incidents } from "@/lib/data";

export function generateStaticParams() {
  return animals.map((a) => ({ id: a.id }));
}

type Params = Promise<{ id: string }>;

export default async function AnimalDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const animal = animals.find((a) => a.id === id);
  if (!animal) notFound();
  const owner = findOwner(animal.ownerId);
  const animalIncidents = incidents.filter((i) => i.animalId === animal.id);

  // Synthesised time series for the visuals
  const heartSeries = [62, 64, 61, 66, 70, 68, animal.health.heartRateBpm];
  const tempSeries = [38.4, 38.5, 38.6, 38.8, 39.0, 39.1, animal.health.temperatureC];

  return (
    <>
      <Topbar
        title={animal.name ? `${animal.name} · ${animal.tag}` : animal.tag}
        subtitle={`${animal.breed} · ${animal.species} · ${animal.sex} · ${animal.ageMonths} months`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/livestock"
          className="inline-flex items-center gap-1.5 text-sm text-white/65 hover:text-white"
        >
          <I.ArrowRight size={14} className="rotate-180" />
          Back to registry
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="glass" iconLeft={<I.Bell size={14} />}>
            Subscribe
          </Button>
          <Button size="sm" variant="primary" iconLeft={<I.Plus size={14} />}>
            New health record
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        {/* Profile */}
        <GlassCard className="p-6 lg:p-7 lg:col-span-1">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-3xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] grid place-items-center text-emerald-950 shadow-[0_10px_30px_-10px_rgba(0,245,160,0.5)]">
              <I.Cow size={32} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-white/45">Animal ID</div>
              <div className="font-mono text-lg">{animal.tag}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <StatusBadge status={animal.status} />
            <span className="chip">{animal.species}</span>
            <span className="chip">{animal.breed}</span>
            <span className="chip">{animal.color}</span>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <Field label="Sex" value={animal.sex} />
            <Field label="Age" value={`${animal.ageMonths} months`} />
            <Field label="Weight" value={`${animal.weightKg} kg`} />
            <Field label="Registered" value={animal.registeredOn} />
          </dl>

          <div className="mt-6 pt-6 border-t border-white/8">
            <div className="text-[11px] uppercase tracking-wider text-white/45">
              Registered owner
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-[linear-gradient(135deg,#ffd57a,#ff9b3a)] text-emerald-950 font-semibold grid place-items-center">
                {owner?.fullName
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{owner?.fullName}</div>
                <div className="text-xs text-white/55 truncate">{owner?.ward}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-white/55 font-mono">{owner?.phone}</div>
          </div>
        </GlassCard>

        {/* Telemetry */}
        <GlassCard className="p-6 lg:p-7 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Live telemetry</h3>
              <p className="text-xs text-white/55">
                Updated {animal.device.lastSyncMin} min ago · {animal.device.type} · serial {animal.device.serial}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <BatteryBar value={animal.device.battery} />
              <div className="flex items-center gap-1.5 text-xs text-white/65">
                <I.Wifi size={14} />
                {animal.device.signal}%
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <TelemetryCard
              title="Heart rate"
              value={`${animal.health.heartRateBpm}`}
              unit="bpm"
              series={heartSeries}
              color="#ff8a8a"
              icon={<I.Heart size={16} />}
            />
            <TelemetryCard
              title="Temperature"
              value={`${animal.health.temperatureC.toFixed(1)}`}
              unit="°C"
              series={tempSeries}
              color="#ffb547"
              icon={<I.Activity size={16} />}
            />
            <div className="glass-thin rounded-2xl p-4 flex items-center gap-4">
              <Ring value={animal.device.battery} label={`${animal.device.battery}%`} sublabel="Battery" size={108} thickness={10} />
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-6">
                  <span className="text-white/55">Signal</span>
                  <span className="font-mono">{animal.device.signal}%</span>
                </div>
                <div className="flex justify-between gap-6">
                  <span className="text-white/55">Speed</span>
                  <span className="font-mono">{animal.location.speedKph} km/h</span>
                </div>
                <div className="flex justify-between gap-6">
                  <span className="text-white/55">Heading</span>
                  <span className="font-mono">{animal.location.heading}°</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-medium text-white/80 mb-2">Position</h4>
            <div className="map-canvas topo-lines relative overflow-hidden rounded-3xl border border-white/10 h-[260px]">
              <div className="absolute inset-0 grid-lines opacity-30" />
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${animal.location.x}%`, top: `${animal.location.y}%` }}
              >
                <span className="relative inline-flex h-3.5 w-3.5">
                  <span className="absolute inset-0 rounded-full bg-emerald-300 opacity-70 animate-pulse-ring" />
                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-300 ring-4 ring-emerald-400/30 shadow-[0_0_16px_currentColor]" />
                </span>
              </div>
              <div className="absolute bottom-3 left-3 chip">{animal.location.zone}</div>
              <div className="absolute top-3 right-3 chip">
                {animal.location.x.toFixed(1)}°E · {animal.location.y.toFixed(1)}°S
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Health & Incidents */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <GlassCard className="p-6 lg:p-7 lg:col-span-2">
          <h3 className="text-base font-semibold tracking-tight">Health record</h3>
          <p className="text-xs text-white/55">Vaccination, treatment & quarantine history</p>

          <ul className="mt-5 relative pl-6 space-y-5 before:content-[''] before:absolute before:left-2 before:top-1 before:bottom-1 before:w-px before:bg-white/10">
            <Timeline
              date={animal.health.lastVaccination}
              title="FMD booster — administered"
              body="Foot-and-mouth disease booster administered by Dr. R. Chivasa."
              tone="veld"
            />
            <Timeline
              date="2026-01-08"
              title="Annual deworming"
              body="Routine deworming during dry season ward sweep."
              tone="cyan"
            />
            <Timeline
              date="2025-08-22"
              title="Brucellosis test"
              body="Test negative. Cleared for breeding programme."
              tone="violet"
            />
            <Timeline
              date={animal.health.nextVaccination}
              title="Next FMD booster — scheduled"
              body="Scheduled at ward clinic. Owner notified via SMS."
              tone="amber"
            />
          </ul>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-base font-semibold tracking-tight">Linked incidents</h3>
          <p className="text-xs text-white/55">All incidents referencing this animal</p>

          {animalIncidents.length === 0 ? (
            <div className="mt-6 glass-thin rounded-2xl p-5 text-center">
              <I.Check size={22} className="mx-auto text-emerald-300" />
              <div className="mt-2 text-sm">No incidents on record</div>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {animalIncidents.map((i) => (
                <li key={i.id} className="glass-thin rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs text-white/55">
                    <span className="font-mono">{i.ref}</span>
                    <StatusBadge status={i.severity} />
                  </div>
                  <div className="mt-1 text-sm font-medium">{i.type}</div>
                  <div className="text-xs text-white/65 mt-1 leading-snug">{i.notes}</div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
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

function TelemetryCard({
  title,
  value,
  unit,
  series,
  color,
  icon,
}: {
  title: string;
  value: string;
  unit: string;
  series: number[];
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass-thin rounded-2xl p-4">
      <div className="flex items-center justify-between text-sm text-white/65">
        <span className="flex items-center gap-1.5">
          <span style={{ color }}>{icon}</span>
          {title}
        </span>
        <span className="font-mono text-xs">7d</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
        <span className="text-white/55 text-sm">{unit}</span>
      </div>
      <div className="mt-1">
        <Sparkline data={series} color={color} height={48} />
      </div>
    </div>
  );
}

function Timeline({
  date,
  title,
  body,
  tone,
}: {
  date: string;
  title: string;
  body: string;
  tone: "veld" | "amber" | "violet" | "cyan";
}) {
  const dot =
    tone === "veld" ? "bg-emerald-300" : tone === "amber" ? "bg-amber-300" : tone === "violet" ? "bg-violet-300" : "bg-cyan-300";
  return (
    <li className="relative">
      <span
        className={`absolute -left-[18px] top-1.5 h-2.5 w-2.5 rounded-full ${dot} shadow-[0_0_12px_currentColor]`}
      />
      <div className="text-xs text-white/55 font-mono">{date}</div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-white/65 mt-0.5">{body}</div>
    </li>
  );
}

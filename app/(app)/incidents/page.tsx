import { formatShortDateTime } from "@/lib/time";
import Link from "next/link";
import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { I } from "@/components/ui/icon";
import {
  SeverityBadge,
  IncidentStatusBadge,
} from "@/components/app/indicators";
import { getAnimals, getIncidents, getOwners } from "@/lib/db";
import type { Incident } from "@/lib/types";

/** Same pattern as the registry: the choice lives in the URL, so the page stays
 *  server-rendered and a filtered view can be shared or bookmarked. */
type Params = Promise<{ view?: string }>;

const TABS = [
  { label: "All",      match: () => true },
  { label: "Active",   match: (i: Incident) => i.status === "Open" || i.status === "In progress" || i.status === "Escalated" },
  { label: "Critical", match: (i: Incident) => i.severity === "Critical" },
  { label: "Theft",    match: (i: Incident) => i.type === "Theft" },
  { label: "Boundary", match: (i: Incident) => i.type === "Boundary breach" },
  { label: "Disease",  match: (i: Incident) => i.type === "Disease alert" },
];

export default async function IncidentsPage({ searchParams }: { searchParams: Params }) {
  const { view } = await searchParams;
  const [all, animals, owners] = await Promise.all([
    getIncidents(), getAnimals(), getOwners(),
  ]);
  const activeTab = TABS.find((t) => t.label === view) ?? TABS[0];
  const incidents = all.filter(activeTab.match);
  const findAnimal = (id: string) => animals.find((a) => a.id === id);
  const findOwner = (id: string) => owners.find((o) => o.id === id);

  // The summary tiles describe the whole register, not the current filter.
  const summary = {
    open: all.filter((i) => i.status === "Open").length,
    inProgress: all.filter((i) => i.status === "In progress").length,
    escalated: all.filter((i) => i.status === "Escalated").length,
    resolved: all.filter((i) => i.status === "Resolved").length,
  };
  return (
    <>
      <Topbar
        title="Incident management"
        subtitle="By-law enforcement, theft recovery, disease alerts"
      />

      <div className="grid-stagger grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5">
        <Summary label="Open"        value={summary.open}        tone="amber"  />
        <Summary label="In progress" value={summary.inProgress}  tone="cyan"   />
        <Summary label="Escalated"   value={summary.escalated}   tone="coral"  />
        <Summary label="Resolved"    value={summary.resolved}    tone="veld"   />
      </div>

      <GlassCard className="p-3 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Tab
            key={t.label}
            label={t.label}
            count={all.filter(t.match).length}
            href={t.label === "All" ? "/incidents" : `/incidents?view=${encodeURIComponent(t.label)}`}
            active={t.label === activeTab.label}
          />
        ))}

        <div className="ml-auto flex items-center gap-2">
          <LinkButton href="/incidents/new" size="sm" variant="primary" iconLeft={<I.Plus size={14} />}>Report incident</LinkButton>
        </div>
      </GlassCard>

      <GlassCard className="p-2">
        <div className="overflow-x-auto pretty-scroll">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-white/45">
                <th className="px-4 py-3 font-medium">Ref</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Animal</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Officer</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {/* An empty register showed seven column headings above blank space. */}
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <I.Check size={24} className="mx-auto text-emerald-300" />
                    <div className="mt-3 text-sm">
                      {all.length === 0 ? "No incidents reported" : `No incidents under “${activeTab.label}”`}
                    </div>
                    <p className="mt-1 text-xs text-white/55">
                      Breaches, thefts and injuries raised by officers appear here.
                    </p>
                  </td>
                </tr>
              )}
              {incidents.map((i) => {
                const a = i.animalId ? findAnimal(i.animalId) : undefined;
                const o = i.ownerId ? findOwner(i.ownerId) : undefined;
                return (
                  <tr
                    key={i.id}
                    className="border-t border-white/5 hover:bg-white/3 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/incidents/${i.id}`} className="text-emerald-200 hover:text-emerald-100 transition-colors">
                        {i.ref}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{i.type}</td>
                    <td className="px-4 py-3"><SeverityBadge severity={i.severity} /></td>
                    <td className="px-4 py-3"><IncidentStatusBadge status={i.status} /></td>
                    <td className="px-4 py-3">
                      {a ? (
                        <span className="font-mono text-xs">{a.tag}</span>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 truncate max-w-[180px]">{o?.fullName ?? "—"}</td>
                    <td className="px-4 py-3 text-white/75">{i.officer}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/65">
                      {formatShortDateTime(i.reportedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Detailed cards */}
      <div className="grid-stagger grid lg:grid-cols-2 gap-4 lg:gap-5">
        {incidents.slice(0, 4).map((i) => (
          <Link key={i.id} href={`/incidents/${i.id}`} className="block">
          <GlassCard hover className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-white/55">{i.ref}</span>
                <SeverityBadge severity={i.severity} />
                <IncidentStatusBadge status={i.status} />
              </div>
              <Badge tone="neutral">{i.officer}</Badge>
            </div>
            <h3 className="mt-3 text-lg font-semibold tracking-tight">{i.type}</h3>
            <p className="mt-1 text-sm text-white/65 leading-snug">{i.notes}</p>
            <div className="mt-4 flex items-center gap-3 text-xs text-white/55">
              <div className="flex items-center gap-1.5">
                <I.Pin size={14} className="text-emerald-300" />
                {i.location.label}
              </div>
              <div className="flex items-center gap-1.5">
                <I.Calendar size={14} />
                {formatShortDateTime(i.reportedAt)}
              </div>
            </div>
          </GlassCard>
          </Link>
        ))}
      </div>
    </>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "cyan" | "coral" | "veld";
}) {
  const color =
    tone === "amber" ? "#ffb547" : tone === "cyan" ? "#5be7ff" : tone === "coral" ? "#ff8a8a" : "#00f5a0";
  return (
    <GlassCard hover className="p-6 relative overflow-hidden">
      <div
        className="absolute -top-12 -right-12 h-40 w-40 rounded-full blur-3xl opacity-30"
        style={{ background: color }}
      />
      <div className="relative">
        <div className="text-xs uppercase tracking-[0.14em] text-white/55">{label}</div>
        <div className="mt-3 text-4xl font-semibold tracking-tighter" style={{ color }}>
          {value}
        </div>
      </div>
    </GlassCard>
  );
}

function Tab({
  label, count, href, active,
}: { label: string; count: number; href: string; active?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`h-9 px-3.5 rounded-2xl text-sm font-medium transition-colors flex items-center gap-2
        ${active ? "glass text-white" : "text-white/65 hover:text-white hover:bg-white/6"}`}
    >
      {label}
      <span className="text-[10px] font-mono px-1.5 rounded-md bg-white/10 text-white/70">
        {count}
      </span>
    </Link>
  );
}

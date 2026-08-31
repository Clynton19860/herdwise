import Link from "next/link";
import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { I } from "@/components/ui/icon";
import { PAGE_SIZE, countRows, getAnimals, getOwners } from "@/lib/db";
import { Pager } from "@/components/app/pager";

type Params = Promise<{ page?: string }>;

export default async function OwnersPage({ searchParams }: { searchParams: Params }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(0, (Number(pageParam) || 1) - 1);
  const [animals, owners, total] = await Promise.all([
    getAnimals(), getOwners(page), countRows("owners"),
  ]);
  const totalHerd = owners.reduce((s, o) => s + o.herdSize, 0);

  return (
    <>
      <Topbar
        title="Livestock owners"
        subtitle={`${owners.length} farmers · ${totalHerd} animals under management`}
      />

      <div className="grid-stagger grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <Kpi label="Registered farmers" value={owners.length.toString()} hint="National ID verified" />
        <Kpi label="Active wards" value={String(new Set(owners.map((o) => o.ward)).size)} hint="with registered stock" />
        <Kpi label="Total herd" value={totalHerd.toLocaleString()} hint="animals managed" />
        <Kpi label="Avg. herd" value={(totalHerd / owners.length).toFixed(1)} hint="head per farmer" />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge tone="veld" dot>All</Badge>
          <Badge tone="violet">Top earners</Badge>
          <Badge tone="amber">Verification pending</Badge>
        </div>
        <LinkButton href="/owners/new" size="sm" variant="primary" iconLeft={<I.Plus size={14} />}>
          Register owner
        </LinkButton>
      </div>

      <div className="grid-stagger grid md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
        {owners.map((o, i) => {
          const herd = animals.filter((a) => a.ownerId === o.id);
          const alerts = herd.filter((a) => a.status !== "Healthy").length;
          return (
            <Link key={o.id} href={`/owners/${o.id}`} className="block">
            <GlassCard hover className="p-6">
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-12 rounded-2xl grid place-items-center text-emerald-950 font-semibold text-base"
                  style={{
                    background:
                      i % 3 === 0
                        ? "linear-gradient(135deg,#00f5a0,#5be7ff)"
                        : i % 3 === 1
                          ? "linear-gradient(135deg,#ffd57a,#ff9b3a)"
                          : "linear-gradient(135deg,#b3a7ff,#8c7cff)",
                  }}
                >
                  {o.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="min-w-0">
                  <div className="font-medium leading-tight truncate">{o.fullName}</div>
                  <div className="text-xs text-white/55 leading-tight truncate">
                    {o.ward}
                  </div>
                </div>
                <div className="ml-auto">
                  {alerts > 0 ? (
                    <Badge tone="coral" dot>
                      {alerts} alerts
                    </Badge>
                  ) : (
                    <Badge tone="veld">All healthy</Badge>
                  )}
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <Field label="National ID" value={o.nationalId} mono />
                <Field label="Phone" value={o.phone} mono />
                <Field label="Herd size" value={`${o.herdSize} head`} />
                <Field label="Registered" value={o.registeredOn} mono />
              </dl>

              <div className="mt-6 pt-5 border-t border-white/8 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {herd.slice(0, 5).map((a) => (
                    <span
                      key={a.id}
                      className="h-8 w-8 rounded-2xl glass-thin grid place-items-center text-emerald-300"
                      title={a.tag}
                    >
                      <I.Cow size={14} />
                    </span>
                  ))}
                  {herd.length > 5 && (
                    <span className="h-8 w-8 rounded-2xl glass-thin grid place-items-center text-xs text-white/70">
                      +{herd.length - 5}
                    </span>
                  )}
                </div>
                <span className="text-xs text-emerald-200 inline-flex items-center gap-1">
                  View profile <I.ArrowRight size={12} />
                </span>
              </div>
            </GlassCard>
            </Link>
          );
        })}
      </div>

    <Pager page={page} pageSize={PAGE_SIZE} total={total} basePath="/owners" />
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-white/45">{label}</dt>
      <dd className={`mt-0.5 text-white/90 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <GlassCard hover className="p-6">
      <div className="text-xs uppercase tracking-[0.14em] text-white/55">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tighter">{value}</div>
      <div className="text-xs text-white/45 mt-1">{hint}</div>
    </GlassCard>
  );
}

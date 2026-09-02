import { redirect } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { I } from "@/components/ui/icon";
import { formatShortDateTime } from "@/lib/time";
import { getOwner, getOwnerIncidents } from "@/lib/db";
import { currentPrincipal } from "@/lib/principal";
import { EditRecord } from "@/components/app/edit-record";

export const dynamic = "force-dynamic";
export const metadata = { title: "My details — Herdwise" };

/**
 * What the ward office holds about this farmer, and what he may change himself.
 *
 * His phone number and address are his to correct. His national ID and ward are
 * not — those are how the register identifies and places him, and letting an
 * account edit them would let somebody quietly become a different registration.
 */
export default async function MyProfilePage() {
  const principal = await currentPrincipal();
  if (principal?.kind !== "owner") redirect("/login?next=/my/profile");

  const [owner, incidents] = await Promise.all([
    getOwner(principal.id),
    getOwnerIncidents(principal.id),
  ]);
  if (!owner) redirect("/my");

  return (
    <>
      <GlassCard className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{owner.fullName}</h1>
            <p className="text-xs text-white/55 mt-0.5">Registered livestock owner</p>
          </div>
          <EditRecord
            endpoint="/api/my/profile"
            title="Update my details"
            fields={[
              { name: "phone", label: "Phone", value: owner.phone, type: "tel" },
              { name: "address", label: "Address", value: owner.address ?? "" },
            ]}
          />
        </div>

        <dl className="mt-5 grid sm:grid-cols-2 gap-4 text-sm">
          <Row label="Phone" value={owner.phone} />
          <Row label="Address" value={owner.address ?? "Not recorded"} />
          <Row label="Ward" value={owner.ward} />
          <Row label="National ID" value={owner.nationalId} />
        </dl>

        <p className="mt-5 text-[11px] text-white/40 leading-snug">
          Your ward and national ID are held by the ward office and cannot be changed
          here. Contact them if either is wrong.
        </p>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <h2 className="text-base font-semibold tracking-tight">Incidents involving my animals</h2>
        {incidents.length === 0 ? (
          <div className="mt-4 glass-thin rounded-2xl p-6 text-center">
            <I.Check size={22} className="mx-auto text-emerald-300" />
            <div className="mt-2 text-sm">Nothing reported</div>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {incidents.map((i) => (
              <li key={i.id} className="glass-thin rounded-2xl p-4 flex items-start gap-3">
                <I.Alert size={16} className="text-amber-300 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{i.type}</div>
                  <div className="text-xs text-white/50 font-mono mt-0.5">
                    {i.ref} · {formatShortDateTime(i.reportedAt)}
                  </div>
                </div>
                <span className="text-xs text-white/55 capitalize">{i.status}</span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-white/45">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

import { Logo } from "@/components/ui/logo";
import { LinkButton } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";
import { MiniMap } from "@/components/marketing/mini-map";
import { platformStats } from "@/lib/data";
import Link from "next/link";

const navItems = [
  { href: "#platform", label: "Platform" },
  { href: "#ecosystem", label: "Ecosystem" },
  { href: "#pilot", label: "Pilot" },
  { href: "#stack", label: "Stack" },
];

const features = [
  {
    icon: <I.Pin size={22} />,
    title: "Real-time tracking",
    body: "AirTag, smart collar and ear-tag fleet fused into a single live map with sub-10 second updates.",
    tone: "veld" as const,
  },
  {
    icon: <I.Shield size={22} />,
    title: "Smart geofencing",
    body: "Polygon grazing zones, restricted areas and dynamic municipal buffers — breach the line, instant alert.",
    tone: "amber" as const,
  },
  {
    icon: <I.Stethoscope size={22} />,
    title: "Veterinary intelligence",
    body: "Heart rate, body temperature and behavioural anomalies feed AI models that surface disease early.",
    tone: "coral" as const,
  },
  {
    icon: <I.Users size={22} />,
    title: "Farmer & officer apps",
    body: "Offline-first mobile experiences for field officers, vets and livestock owners — beautifully simple.",
    tone: "violet" as const,
  },
  {
    icon: <I.Activity size={22} />,
    title: "By-law enforcement",
    body: "Citations, impoundment workflows and mobile-money fines wired into one transparent ledger.",
    tone: "cyan" as const,
  },
  {
    icon: <I.Sparkle size={22} />,
    title: "AI co-pilot",
    body: "Predictive grazing, theft-risk scoring and a herd assistant trained on Zimbabwean livestock patterns.",
    tone: "aurora" as const,
  },
];

const phases = [
  {
    label: "Phase 1",
    title: "Foundational tracking",
    items: [
      "Animal & owner registration",
      "AirTag pairing & GPS sync",
      "Smart geofences",
      "Incident management",
      "Officer mobile app",
    ],
  },
  {
    label: "Phase 2",
    title: "Smart collars",
    items: [
      "IoT health telemetry",
      "Heart rate · temperature",
      "Behavioural anomaly AI",
      "Grazing optimisation",
      "Breeding analytics",
    ],
  },
  {
    label: "Phase 3",
    title: "National ecosystem",
    items: [
      "Veterinary integrations",
      "Insurance & finance APIs",
      "Carbon & climate analytics",
      "Cross-border traceability",
      "Smart farming OS",
    ],
  },
];

const stack = [
  { label: "Frontend", value: "Next.js 16 · React 19 · Tailwind 4 · PWA" },
  { label: "Backend", value: "Supabase · PostgreSQL · PostGIS · Realtime" },
  { label: "IoT", value: "MQTT · Apple Find My · Edge telemetry" },
  { label: "Mobile", value: "React Native · Expo · Offline sync" },
  { label: "Infra", value: "AWS / Azure · CDN · Object storage" },
  { label: "Security", value: "RLS · MFA · End-to-end encryption" },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen">
      {/* ========== Top nav ========== */}
      <header className="fixed top-4 inset-x-4 z-50 flex justify-center">
        <nav className="glass-heavy w-full max-w-6xl rounded-2xl px-4 py-2.5 flex items-center gap-6">
          <Logo size="sm" />
          <ul className="hidden md:flex items-center gap-1 text-sm text-white/75">
            {navItems.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="px-3 py-2 rounded-xl hover:bg-white/8 hover:text-white transition-colors"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex text-sm text-white/80 hover:text-white px-3 py-2 rounded-xl hover:bg-white/8 transition-colors"
            >
              Sign in
            </Link>
            <LinkButton href="/dashboard" size="sm" iconRight={<I.ArrowRight size={16} />}>
              Open dashboard
            </LinkButton>
          </div>
        </nav>
      </header>

      {/* ========== Hero ========== */}
      <section className="relative px-6 pt-36 pb-16 md:pt-44 md:pb-24">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-7 space-y-7">
            <Badge tone="aurora" dot>
              City of Harare · Smart Agriculture Initiative
            </Badge>
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-balance leading-[1.02]">
              The intelligent <span className="gradient-text">livestock</span> nervous system for Harare.
            </h1>
            <p className="text-lg md:text-xl text-white/70 max-w-2xl text-pretty">
              Herdwise unifies GPS trackers, smart collars and municipal officers into a
              single glass-native platform — so cattle stay healthy, herds stay home, and
              by-laws stay enforced.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <LinkButton href="/dashboard" size="lg" iconRight={<I.ArrowRight />}>
                Open the live dashboard
              </LinkButton>
              <LinkButton href="#platform" size="lg" variant="glass" iconLeft={<I.Sparkle size={18} />}>
                Explore the platform
              </LinkButton>
            </div>

            {/* Trust strip */}
            <div className="pt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/60">
              <div className="flex items-center gap-2">
                <I.Shield size={16} className="text-emerald-300" />
                Built on Supabase · row-level security
              </div>
              <div className="flex items-center gap-2">
                <I.Wifi size={16} className="text-cyan-300" />
                Offline-first across rural wards
              </div>
              <div className="flex items-center gap-2">
                <I.Globe size={16} className="text-violet-300" />
                Zimbabwe data sovereignty
              </div>
            </div>
          </div>

          {/* Hero map card */}
          <div className="lg:col-span-5">
            <GlassCard className="p-3 ring-glow">
              <MiniMap className="h-[420px] md:h-[460px]" />

              <div className="mt-3 grid grid-cols-3 gap-3 px-1">
                <HeroStat label="Tracked" value="12,846" tone="text-emerald-300" />
                <HeroStat label="Live devices" value="11,402" tone="text-cyan-300" />
                <HeroStat label="Uptime" value="99.96%" tone="text-amber-200" />
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Floating live ticker */}
        <div className="mx-auto max-w-7xl mt-16">
          <GlassCard tone="thin" className="px-4 py-3 overflow-hidden">
            <div className="flex items-center gap-3">
              <Badge tone="veld" dot>Live feed</Badge>
              <div className="scroll-fade-x overflow-hidden flex-1">
                <div className="flex gap-10 animate-ticker whitespace-nowrap text-sm text-white/70">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-10">
                      <span><span className="text-emerald-300 font-medium">SC-X204-118</span> position update · Hatcliffe</span>
                      <span><span className="text-amber-300 font-medium">Geofence</span> Mabvuku Buffer — 22 / 50</span>
                      <span><span className="text-rose-300 font-medium">Anomaly</span> HRE-CTL-00302 elevated temp</span>
                      <span><span className="text-cyan-300 font-medium">Vax</span> 14 animals · Ward 18</span>
                      <span><span className="text-violet-300 font-medium">Owner</span> Chiedza Marufu joined</span>
                      <span><span className="text-emerald-300 font-medium">Patrol</span> dispatched · Kuwadzana</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ========== Platform features ========== */}
      <section id="platform" className="relative px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl space-y-4 mb-12">
            <Badge tone="veld">Platform</Badge>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-balance">
              One pane of glass for every animal, every herd, every ward.
            </h2>
            <p className="text-white/65 text-lg text-pretty">
              Designed for the operational rhythm of municipal teams, field officers and
              farmers — every workflow is collaborative, mobile and audit-grade.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <GlassCard key={f.title} className="p-6 group hover:-translate-y-0.5 transition-transform">
                <div className="flex items-start justify-between">
                  <div className="h-11 w-11 rounded-2xl glass-thin flex items-center justify-center text-emerald-200">
                    {f.icon}
                  </div>
                  <Badge tone={f.tone}>Live</Badge>
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-white/65 text-sm leading-relaxed">{f.body}</p>
                <div className="mt-6 flex items-center gap-2 text-sm text-emerald-200/90 opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more <I.ArrowRight size={14} />
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ========== Big numbers ========== */}
      <section className="relative px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <GlassCard tone="heavy" className="p-10 md:p-14 relative overflow-hidden">
            <div className="absolute -top-32 -right-32 h-72 w-72 rounded-full bg-emerald-400/30 blur-3xl animate-blob" />
            <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl animate-blob" />

            <div className="relative grid md:grid-cols-4 gap-8">
              <BigStat label="Animals registered" value={platformStats.registered.toLocaleString()} hint="across 27 wards" />
              <BigStat label="Live devices" value={platformStats.liveDevices.toLocaleString()} hint="GPS + AirTag" />
              <BigStat label="Active geofences" value={`${platformStats.geofencesActive}`} hint="grazing · restricted · buffer" />
              <BigStat label="Avg. response" value={`${platformStats.averageResponseMin}m`} hint="incident → on-site" />
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ========== Roadmap / Ecosystem ========== */}
      <section id="ecosystem" className="relative px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl space-y-4 mb-12">
            <Badge tone="violet">Ecosystem</Badge>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-balance">
              From basic tracking to a national smart livestock ecosystem.
            </h2>
            <p className="text-white/65 text-lg">
              A pragmatic three-phase rollout: prove the core, scale the intelligence,
              connect the country.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {phases.map((p, idx) => (
              <GlassCard key={p.label} className="p-6 relative overflow-hidden">
                <div
                  className="absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl opacity-40"
                  style={{
                    background:
                      idx === 0
                        ? "rgba(0,245,160,0.4)"
                        : idx === 1
                          ? "rgba(91,231,255,0.4)"
                          : "rgba(140,124,255,0.4)",
                  }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <Badge tone={idx === 0 ? "veld" : idx === 1 ? "cyan" : "violet"}>
                      {p.label}
                    </Badge>
                    <span className="text-xs text-white/50">{idx + 1} / 3</span>
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight">{p.title}</h3>
                  <ul className="mt-5 space-y-2.5">
                    {p.items.map((it) => (
                      <li key={it} className="flex items-center gap-3 text-sm text-white/80">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_currentColor]" />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ========== Pilot strip ========== */}
      <section id="pilot" className="relative px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <GlassCard tone="veld" className="p-10 md:p-14 relative overflow-hidden">
            <div className="absolute inset-0 opacity-30 grid-lines pointer-events-none" />
            <div className="relative grid md:grid-cols-2 gap-10 items-center">
              <div>
                <Badge tone="aurora">Recommended pilot</Badge>
                <h3 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight text-balance">
                  500–2,000 head, 50–100 farmers, 6 months.
                </h3>
                <p className="mt-4 text-white/70 max-w-xl">
                  Validate tracking accuracy, geofencing, enforcement workflows and farmer
                  adoption across Harare’s peri-urban livestock zones before scaling to the
                  full municipal footprint.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <LinkButton href="/dashboard" size="lg">Launch pilot dashboard</LinkButton>
                  <LinkButton href="#stack" size="lg" variant="outline">Review the stack</LinkButton>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <PilotKpi label="Pilot region" value="Harare peri-urban" />
                <PilotKpi label="Duration" value="3 – 6 months" />
                <PilotKpi label="Livestock" value="500 – 2,000" />
                <PilotKpi label="Farmers" value="50 – 100" />
                <PilotKpi label="Officers" value="2 enforcement teams" />
                <PilotKpi label="Target uptime" value="99.9%" />
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ========== Stack ========== */}
      <section id="stack" className="relative px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl space-y-4 mb-10">
            <Badge tone="cyan">Engineering</Badge>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
              Modern, sovereign, audit-grade.
            </h2>
            <p className="text-white/65 text-lg">
              A cloud-native architecture chosen for African field conditions and
              regulatory environments.
            </p>
          </div>

          <GlassCard className="divide-y divide-white/8 overflow-hidden">
            {stack.map((s) => (
              <div
                key={s.label}
                className="grid grid-cols-3 md:grid-cols-5 px-6 py-5 hover:bg-white/3 transition-colors"
              >
                <div className="col-span-1 text-white/55 text-sm uppercase tracking-wider">
                  {s.label}
                </div>
                <div className="col-span-2 md:col-span-4 text-white/90 font-mono text-sm">
                  {s.value}
                </div>
              </div>
            ))}
          </GlassCard>
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-5xl text-center">
          <GlassCard tone="heavy" className="p-12 md:p-16 relative overflow-hidden">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-64 w-[80%] rounded-full bg-emerald-400/30 blur-3xl" />
            <div className="relative space-y-6">
              <h2 className="text-4xl md:text-6xl font-semibold tracking-tight text-balance">
                Step into <span className="gradient-text">Africa&rsquo;s</span> smartest livestock platform.
              </h2>
              <p className="text-white/70 text-lg max-w-2xl mx-auto">
                A working preview, populated with realistic municipal data, is one click
                away. Connect Supabase whenever you&rsquo;re ready.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <LinkButton href="/dashboard" size="lg" iconRight={<I.ArrowRight />}>
                  Open dashboard
                </LinkButton>
                <LinkButton href="/tracking" size="lg" variant="glass" iconLeft={<I.Map size={18} />}>
                  See the live map
                </LinkButton>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ========== Footer ========== */}
      <footer className="relative px-6 pb-10 pt-4">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-sm text-white/50">
              · A platform by ITTHYNK Smart Solutions for the City of Harare
            </span>
          </div>
          <div className="text-xs text-white/40 font-mono">
            © {new Date().getFullYear()} Herdwise · v1.0 · Zimbabwe
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="glass-thin rounded-2xl px-4 py-3">
      <div className={`text-xl font-semibold tracking-tight ${tone}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-white/50 mt-0.5">
        {label}
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <div className="text-5xl md:text-6xl font-semibold tracking-tighter gradient-text">
        {value}
      </div>
      <div className="mt-2 text-sm uppercase tracking-wider text-white/55">{label}</div>
      <div className="text-xs text-white/40 mt-0.5">{hint}</div>
    </div>
  );
}

function PilotKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-thin rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wider text-white/55">{label}</div>
      <div className="mt-1.5 text-lg font-medium">{value}</div>
    </div>
  );
}

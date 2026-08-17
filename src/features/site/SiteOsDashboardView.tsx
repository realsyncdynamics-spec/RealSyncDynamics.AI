import { ArrowRight, Bot, CircleCheck, FileCheck2, Gauge, Radar, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const AREAS = [
  {
    eyebrow: '01 · command center',
    title: 'Governance posture',
    description: 'One operational view of risk, drift, controls and evidence across your governed environment.',
    metric: '94.2%',
    metricLabel: 'governance score',
    icon: Gauge,
    href: '/app',
  },
  {
    eyebrow: '02 · AI systems',
    title: 'AI inventory & risk',
    description: 'Discover AI systems, classify use cases and keep risk ownership connected to every deployment.',
    metric: '17',
    metricLabel: 'systems classified',
    icon: Sparkles,
    href: '/ai-act',
  },
  {
    eyebrow: '03 · monitoring',
    title: 'Continuous monitoring',
    description: 'Detect website drift, policy regressions, new AI endpoints and compliance signals continuously.',
    metric: '12',
    metricLabel: 'open incidents',
    icon: Radar,
    href: '/monitoring',
  },
  {
    eyebrow: '04 · evidence',
    title: 'Evidence & audit trail',
    description: 'Seal findings into a replay-ready evidence chain and generate audit material when you need it.',
    metric: '4,128',
    metricLabel: 'evidence records',
    icon: FileCheck2,
    href: '/evidence',
  },
  {
    eyebrow: '05 · policy',
    title: 'Policies & controls',
    description: 'Turn findings into accountable controls, policy changes and remediation workflows.',
    metric: '86',
    metricLabel: 'active controls',
    icon: ShieldCheck,
    href: '/governance',
  },
  {
    eyebrow: '06 · agents',
    title: 'Governance agents',
    description: 'Let detection, classification, evidence and policy agents operate continuously inside one runtime.',
    metric: '4',
    metricLabel: 'agents running',
    icon: Bot,
    href: '/agents',
  },
] as const;

export function SiteOsDashboardView() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="relative overflow-hidden border-b border-white/10 bg-slate-950">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_72%_35%,rgba(34,211,238,.12),transparent_34%),radial-gradient(circle_at_25%_0%,rgba(59,130,246,.08),transparent_28%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
          <div className="max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[.18em] text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
              RealSyncDynamics.AI · Governance Runtime
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-[-.035em] text-white sm:text-6xl lg:text-7xl">
              AI Governance. <span className="text-cyan-300">Continuous by design.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Your governance operating plane for AI systems, data flows and digital infrastructure. Detect change, govern risk and keep audit-ready evidence continuously.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/app" className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200">
                Open governance workspace <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/audit" className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[.03] px-5 py-3 text-sm font-medium text-slate-100 transition hover:border-white/25 hover:bg-white/[.06]">
                Run a governance scan
              </Link>
            </div>
          </div>

          <div className="mt-14 grid max-w-5xl grid-cols-2 border-y border-white/10 sm:grid-cols-4">
            <Stat label="Governance score" value="94.2%" />
            <Stat label="AI systems" value="17" />
            <Stat label="Open incidents" value="12" />
            <Stat label="Evidence sealed" value="4,128" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="mb-10 max-w-3xl">
          <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-slate-500">Customer workspace</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Everything your governance team operates.</h2>
          <p className="mt-3 text-base leading-7 text-slate-400">Six connected areas. One runtime. No fragmented compliance tooling.</p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 xl:grid-cols-3">
          {AREAS.map(({ eyebrow, title, description, metric, metricLabel, icon: Icon, href }) => (
            <Link key={title} to={href} className="group flex min-h-[270px] flex-col bg-slate-950 p-6 transition hover:bg-slate-900/90">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[.16em] text-slate-500">{eyebrow}</span>
                <Icon className="h-4 w-4 text-slate-500 transition group-hover:text-cyan-300" />
              </div>
              <h3 className="mt-8 text-xl font-semibold tracking-tight text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
              <div className="mt-auto flex items-end justify-between border-t border-white/10 pt-5">
                <div>
                  <div className="text-2xl font-semibold tabular-nums text-white">{metric}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{metricLabel}</div>
                </div>
                <CircleCheck className="h-4 w-4 text-emerald-400/80" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-white/10 px-4 py-5 last:border-r-0 sm:px-6">
      <div className="text-[10px] uppercase tracking-[.15em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-white sm:text-3xl">{value}</div>
    </div>
  );
}

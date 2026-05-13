import { Link } from 'react-router-dom';
import { BrainCircuit, ShieldAlert, Activity, FileCheck2, ArrowRight } from 'lucide-react';

const SCORES = [
  {
    icon: BrainCircuit,
    label: 'AI Exposure Score',
    value: 47,
    delta: '+3',
    deltaTone: 'rose' as const,
    body: 'Wie viele KI-Usecases laufen, welche Klassifizierung, welche Datenbasis.',
  },
  {
    icon: ShieldAlert,
    label: 'Privacy Risk Score',
    value: 32,
    delta: '−4',
    deltaTone: 'emerald' as const,
    body: 'Aggregiert Tracker-vor-Consent, US-Transfers, ungemeldete Incidents.',
  },
  {
    icon: Activity,
    label: 'Governance Maturity',
    value: 68,
    delta: '+5',
    deltaTone: 'emerald' as const,
    body: 'Policy-Coverage, Evidence-Frequenz, Approval-SLAs, Drift-Reaktionszeit.',
  },
  {
    icon: FileCheck2,
    label: 'Evidence Readiness',
    value: 81,
    delta: '+2',
    deltaTone: 'emerald' as const,
    body: 'Annex-IV-Packs lieferbar, Hash-Chain intakt, TSA-Timestamps aktuell.',
  },
];

const PERSONAS = [
  { who: 'Geschäftsführung',    what: 'AI-Exposure auf einen Blick · Stripe Audit-Anfragen beantwortbar' },
  { who: 'DSB / DPO',            what: 'Privacy-Drift pro Asset · DSR-Status · 72h-Incident-Frist live' },
  { who: 'CTO',                  what: 'Welche Modelle laufen wo · welche Konnektoren · Cost pro Tenant' },
  { who: 'Compliance-Team',      what: 'Approval-Queue · Vendor-Reviews · Quartals-Reports auf Knopfdruck' },
];

export function ExecutiveCommandCenterSection() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Executive Command Center
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            Board-ready Governance für AI und digitale Systeme.
          </h2>
          <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed">
            Vier konsolidierte Scores statt 40 Charts. Differenzen zur Vorwoche, Drilldown auf
            den verursachenden Event. Geeignet für Board-Update, Stripe-Audit oder
            Investoren-DD im selben Format.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {SCORES.map((s) => {
            const Icon = s.icon;
            const deltaColor = s.deltaTone === 'emerald' ? 'text-emerald-300' : 'text-rose-300';
            return (
              <article key={s.label} className="border border-silver-700/30 bg-obsidian-900/60 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-titanium-100" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-silver-400">
                    {s.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="font-display font-bold text-4xl text-titanium-50">{s.value}</span>
                  <span className={`font-mono text-xs ${deltaColor}`}>{s.delta} w/w</span>
                </div>
                <p className="mt-3 text-[11px] text-silver-300 leading-relaxed">{s.body}</p>
              </article>
            );
          })}
        </div>

        <div className="bg-obsidian-900/60 border border-silver-700/30 p-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-100 mb-4">
            Für wen es gebaut ist
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PERSONAS.map((p) => (
              <div key={p.who} className="flex items-start gap-3 border-t border-silver-700/30 pt-3">
                <div className="font-display font-semibold text-sm text-titanium-50 w-32 shrink-0">
                  {p.who}
                </div>
                <div className="text-xs text-silver-300 leading-relaxed">{p.what}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-silver-700/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-silver-400">
              Snapshot oben ist Beispieldaten. Live-Werte aus dem Tenant-Scope nach Onboarding.
            </p>
            <Link
              to="/executive"
              className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-amber-400 hover:text-amber-300"
            >
              Executive View öffnen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

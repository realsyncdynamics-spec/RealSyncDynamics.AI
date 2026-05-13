import { Link } from 'react-router-dom';
import {
  Bot,
  Gauge,
  FileCheck2,
  Wrench,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

const PILLARS = [
  {
    icon: Bot,
    label: 'Compliance Operator',
    title: 'Compliance Operator',
    body:
      'Beobachtet Telemetry-Stream, Policy-Decisions und Agent-Aktionen in Echtzeit und kanalisiert kritische Befunde in die Approval-Queue. Kein zusätzlicher Agent auf deinem Server — der Operator läuft als Edge Function auf der Plattform-Seite.',
    meta: 'Live-Status: aktiv · 1 Run pro Event',
  },
  {
    icon: Gauge,
    label: 'Risk Engine',
    title: 'Risk Engine',
    body:
      'Berechnet bei jedem Telemetry-Event den Risk-Delta — propagiert entlang typisierter Edges (Vendor → Dataset → Model → Usecase). Score-Update in unter einer Sekunde, ohne Cron-Job, ohne nightly Refresh.',
    meta: 'p99 Score-Update < 1s · asset_risk_history',
  },
  {
    icon: FileCheck2,
    label: 'Evidence Agent',
    title: 'Evidence Agent',
    body:
      'Sealed bei jeder Policy-Decision einen Evidence-Record: SHA-256 Hash-Chain, Ed25519-Signatur, optionaler RFC-3161-Timestamp. Outputs sind verifiable ohne Plattform-Zugriff — der Public Key reicht.',
    meta: 'Hash-Chain · Ed25519 · optional TSA',
  },
  {
    icon: Wrench,
    label: 'Remediation Agent',
    title: 'Remediation Agent',
    body:
      'Generiert aus Findings strukturierte Code-Snippets: CSP-Header-Block, Consent-Wrapper, Font-Self-Host, Tracker-DOM-Remove, DSGVO-Footer. Snippets werden nie auto-applied — der Operator copy-pastet, markiert als angewendet.',
    meta: '5 Patterns · Copy-Paste · Audit-Trail per Status',
  },
  {
    icon: ShieldCheck,
    label: 'Managed Monitoring',
    title: 'Managed Monitoring',
    body:
      'Continuous Compliance-Härtung als Service: Daily-Scans, Drift-Detection, Vendor-Adequacy-Watch, 72h-Incident-Timer nach Art. 33 GDPR, Annex-IV-Pack on demand. Eskalation an deinen DSB per Webhook oder Slack.',
    meta: 'Daily · Drift · 72h · Annex-IV',
  },
];

export function AgenticComplianceRuntimeSection() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Agentic Compliance Runtime
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            Nicht nur scannen. Beobachten, bewerten, belegen, härten.
          </h2>
          <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed">
            RealSyncDynamics.AI ist keine Snapshot-Sammlung von Findings. Fünf spezialisierte
            Komponenten arbeiten kontinuierlich am Telemetry-Stream — mit klaren Scopes, Audit-Trail
            und ohne Eingriff in eure Produktions-Codebase.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <article
                key={p.label}
                className="bg-obsidian-900/60 border border-silver-700/30 p-5 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 flex items-center justify-center border border-titanium-100/30 bg-titanium-100/5 text-titanium-100">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-silver-400">
                    {p.label}
                  </div>
                </div>
                <h3 className="font-display font-bold text-lg text-titanium-50 leading-snug">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-silver-300 leading-relaxed flex-1">{p.body}</p>
                <div className="mt-4 pt-3 border-t border-silver-700/30 font-mono text-[10px] uppercase tracking-[0.16em] text-silver-500">
                  {p.meta}
                </div>
              </article>
            );
          })}
        </div>

        {/* CTA + disclaimers */}
        <div className="bg-obsidian-900/60 border border-silver-700/30 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="max-w-2xl">
            <h3 className="font-display font-bold text-xl text-titanium-50">
              Managed Runtime aktivieren
            </h3>
            <p className="mt-2 text-sm text-silver-300 leading-relaxed">
              Die fünf Komponenten laufen auf der Plattform — du bekommst Eskalationen, To-dos und
              Audit-Pakete. Technische Compliance-Härtung und kontinuierliche Überwachung mit
              auditierbarem Trail.
            </p>
            <p className="mt-3 text-[11px] text-silver-500 leading-relaxed">
              Keine Rechtsberatung, keine 100%-Garantie. Fokus auf technische Härtung, Audit-Trail
              und Continuous Monitoring — die juristische Bewertung bleibt bei eurem Fachanwalt
              oder zertifizierten DSB.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Link
              to="/pricing#enterprise"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 surface-gold text-sm font-bold rounded-none whitespace-nowrap"
            >
              Managed Runtime aktivieren <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/governance-runtime"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-titanium-100/30 hover:border-amber-400 text-titanium-100 hover:text-amber-300 text-sm font-medium transition-colors whitespace-nowrap"
            >
              Live-Runtime öffnen
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

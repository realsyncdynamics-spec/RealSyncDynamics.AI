import { Navbar } from '../components/Navbar';
import { usePageMeta } from '../lib/usePageMeta';
import { AiOperatingSystemSection } from '../components/governance/AiOperatingSystemSection';
import { GovernanceGraphSection } from '../components/governance/GovernanceGraphSection';
import { EvidenceVaultPreview } from '../components/governance/EvidenceVaultPreview';
import { AgentControlPlanePreview } from '../components/governance/AgentControlPlanePreview';
import { ArrowRight, Activity, ShieldCheck, Bot, ScrollText, FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';

// RuntimePage — Governance-Runtime-Übersicht.
// Fünf Blöcke: AI-OS-Framing → Governance-Graph → 4 Surface-Drill-Ins →
// Agents + Evidence-Vorschau. Jeder Block verlinkt in seine eigene
// Surface (/monitoring, /agents, /evidence, /governance).
//
// Demo-Telemetrie-Hinweis: Die hier dargestellten Metriken (Agents-Counts,
// Evidence-Anchors, enforced Policies, Governance-Graph-Knoten) sind
// **Beispiel-Werte aus Demo-Daten — keine Live-Telemetrie eines Kunden.**
// Persistenter Strip oben auf der Page deklariert das transparent (UWG § 5).

export function RuntimePage() {
  usePageMeta({
    title: 'Runtime — Governance-Übersicht | RealSync',
    description:
      'Governance-Runtime: kontinuierliche Beobachtung, Compliance-Agenten, ' +
      'überprüfbare Evidence-Reports, dokumentierte Policies. Demo-Surface ' +
      'für Pilot-Evaluierung.',
    url: 'https://RealSyncDynamicsAI.de/runtime',
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Navbar />
      <main className="pt-14">
        {/* Demo-Telemetrie-Label — vor allen Sections, persistent, kein Dismiss.
            Verhindert, dass simulierte Metriken als Live-Daten missverstanden werden. */}
        <div className="border-b border-titanium-900 bg-obsidian-900/80">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1.5 sm:px-6">
            <FlaskConical className="h-3 w-3 shrink-0 text-titanium-500" aria-hidden="true" />
            <span className="select-none font-mono text-[9px] uppercase tracking-[0.2em] text-titanium-500">
              Demo-Runtime · simulierte Ereignisse · keine Kundendaten
            </span>
          </div>
        </div>

        <AiOperatingSystemSection />
        <GovernanceGraphSection />

        <section className="bg-obsidian-900 border-b border-titanium-900 py-20 sm:py-28 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-3xl mb-10">
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
                Surfaces · Ebenen der Runtime
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
                In jede Ebene der Runtime hineinzoomen.
              </h2>
              <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
                Monitoring, Governance, Evidence, Agents — jede Surface ist
                eine eigene Seite. Den Zustand prüfen, Policies bedienen,
                die Evidence-Kette einsehen.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-titanium-900">
              <SurfaceCard
                to="/monitoring"
                icon={<Activity className="h-4 w-4 text-cyan-300" />}
                label="monitoring"
                title="Ereignis-Feed."
                blurb="Drift-Ereignisse, KI-Klassifikationen, Evidence-Anchors — in der Demo gestreamt, in der Pilot-Phase persistiert."
              />
              <SurfaceCard
                to="/governance"
                icon={<ScrollText className="h-4 w-4 text-amber-300" />}
                label="governance"
                title="Kontrollen & Policies."
                blurb="12 dokumentierte Kontrollen ordnen KI-Systeme den Policies zu. Status, Scope, Verantwortliche — eine Übersicht."
              />
              <SurfaceCard
                to="/agents"
                icon={<Bot className="h-4 w-4 text-violet-300" />}
                label="agents"
                title="Autonome Compliance-Agenten."
                blurb="Vier Agenten überwachen Drift, KI-Risiko, Evidence und Policies — ohne manuelles Triage-Backlog."
              />
              <SurfaceCard
                to="/evidence"
                icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />}
                label="evidence"
                title="Audit-Kette."
                blurb="Jeder Befund kanonisch gehasht (SHA-256), jede Agent-Aktion verankert. Reportable und nachverfolgbar — keine pauschale Rechtsgarantie."
              />
            </div>
          </div>
        </section>

        <section className="bg-obsidian-950 border-b border-titanium-900 py-16 sm:py-20 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5">
            <AgentControlPlanePreview />
            <EvidenceVaultPreview />
          </div>
        </section>
      </main>
    </div>
  );
}

function SurfaceCard({
  to,
  icon,
  label,
  title,
  blurb,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  title: string;
  blurb: string;
}) {
  return (
    <Link
      to={to}
      className="group bg-obsidian-950 p-6 flex flex-col gap-3 hover:bg-obsidian-900 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
          {icon}
          {label}
        </span>
        <ArrowRight className="h-4 w-4 text-titanium-500 group-hover:text-titanium-100 group-hover:translate-x-0.5 transition-all" />
      </div>
      <div className="font-display font-semibold text-xl text-titanium-50">{title}</div>
      <p className="text-sm text-titanium-300 leading-relaxed">{blurb}</p>
    </Link>
  );
}

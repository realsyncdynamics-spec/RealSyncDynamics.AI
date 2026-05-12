import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  FileCheck2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import {
  demoAiSystems,
  demoEvidenceEvents,
  demoPolicies,
} from './demoData';

/**
 * AiGovernanceDashboard — wiederverwendbare Section auf /ai-governance
 * (dedizierte Page) und auf /features (eingebettete Preview).
 *
 * Liefert in dieser PR statische Demo-Daten (siehe demoData.ts). Folge-PRs
 * verkabeln gegen Supabase-Tabellen aus 20260510_ai_governance_core.sql.
 *
 * Layout:
 *   1. Eyebrow + Headline + Subline
 *   2. 4-Metric-Card-Grid (AI Systeme / High Risk / Aktive Policies / Kritische Events)
 *   3. 2-Spalten-Grid: AI Systems Registry (links, 2/3) + Policy Engine (rechts, 1/3)
 *   4. Evidence Vault als horizontaler Audit-Trail unten
 */

function riskColor(score: number): string {
  if (score >= 80) return 'text-red-400';
  if (score >= 60) return 'text-amber-400';
  if (score >= 30) return 'text-yellow-300';
  return 'text-emerald-400';
}

function classLabel(value: string): string {
  const map: Record<string, string> = {
    minimal: 'Minimal Risk',
    limited: 'Limited Risk',
    high: 'High Risk',
    prohibited: 'Prohibited',
    unknown: 'Unknown',
  };
  return map[value] ?? value;
}

export function AiGovernanceDashboard() {
  const highRiskCount = demoAiSystems.filter(
    (system) => system.aiActClass === 'high',
  ).length;

  const activePolicies = demoPolicies.filter((policy) => policy.enabled).length;

  const criticalEvents = demoEvidenceEvents.filter(
    (event) => event.riskLevel === 'critical' || event.riskLevel === 'high',
  ).length;

  return (
    <section
      id="ai-governance-dashboard"
      className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-t border-silver-700/30"
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            AI Governance OS
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            Inventarisieren. Klassifizieren. Überwachen. Nachweisen.
          </h2>
          <p className="mt-4 max-w-3xl text-silver-300 text-base sm:text-lg leading-relaxed">
            RealSyncDynamicsAI erweitert Website-Compliance zu einer AI-Governance-Schicht:
            AI-Systeme, Policies, Datenflüsse und Audit-Events werden zentral sichtbar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <MetricCard icon={<Bot />} label="AI Systeme" value={demoAiSystems.length.toString()} />
          <MetricCard icon={<AlertTriangle />} label="High Risk" value={highRiskCount.toString()} />
          <MetricCard icon={<Lock />} label="Aktive Policies" value={activePolicies.toString()} />
          <MetricCard
            icon={<FileCheck2 />}
            label="Kritische Events"
            value={criticalEvents.toString()}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-obsidian-900/60 border border-silver-700/30 rounded-none p-5">
            <div className="flex items-center gap-2 mb-5">
              <Database className="h-5 w-5 text-titanium-100" />
              <h3 className="font-display font-bold text-xl text-titanium-50">
                AI Systems Registry
              </h3>
            </div>

            <div className="space-y-3">
              {demoAiSystems.map((system) => (
                <div
                  key={system.id}
                  className="border border-silver-700/30 bg-obsidian-950/60 p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <div className="font-bold text-titanium-50">{system.name}</div>
                      <div className="text-xs text-silver-400 mt-1">
                        {system.vendor} · {system.modelName} · {system.department}
                      </div>
                    </div>
                    <div className={`font-mono text-sm font-bold ${riskColor(system.riskScore)}`}>
                      {system.riskScore}/100
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-1 border border-silver-700/40 text-silver-300">
                      {classLabel(system.aiActClass)}
                    </span>
                    {system.dataTypes.map((type) => (
                      <span
                        key={type}
                        className="text-[11px] font-mono uppercase tracking-wider px-2 py-1 bg-silver-900/60 text-silver-300"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-obsidian-900/60 border border-silver-700/30 rounded-none p-5">
            <div className="flex items-center gap-2 mb-5">
              <ShieldCheck className="h-5 w-5 text-titanium-100" />
              <h3 className="font-display font-bold text-xl text-titanium-50">
                Policy Engine
              </h3>
            </div>

            <div className="space-y-3">
              {demoPolicies.map((policy) => (
                <div
                  key={policy.id}
                  className="border border-silver-700/30 bg-obsidian-950/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-bold text-sm text-titanium-50">
                      {policy.name}
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  </div>
                  <p className="mt-2 text-xs text-silver-400 leading-relaxed">
                    {policy.description}
                  </p>
                  <div className="mt-3 text-[11px] font-mono uppercase tracking-wider text-titanium-100">
                    Action: {policy.action}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 bg-obsidian-900/60 border border-silver-700/30 rounded-none p-5">
          <div className="flex items-center gap-2 mb-5">
            <FileCheck2 className="h-5 w-5 text-titanium-100" />
            <h3 className="font-display font-bold text-xl text-titanium-50">
              Evidence Vault
            </h3>
          </div>

          <div className="space-y-3">
            {demoEvidenceEvents.map((event) => (
              <div
                key={event.id}
                className="grid grid-cols-1 md:grid-cols-[160px_1fr_120px] gap-3 border border-silver-700/30 bg-obsidian-950/60 p-4"
              >
                <div className="text-xs text-silver-500">
                  {new Date(event.createdAt).toLocaleString('de-DE')}
                </div>
                <div>
                  <div className="font-bold text-sm text-titanium-50">
                    {event.eventSummary}
                  </div>
                  <div className="mt-1 text-xs text-silver-400">{event.eventType}</div>
                </div>
                <div className="text-xs font-mono uppercase tracking-wider text-titanium-100 md:text-right">
                  {event.riskLevel}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-obsidian-900/60 border border-silver-700/30 p-5">
      <div className="h-8 w-8 text-titanium-100">{icon}</div>
      <div className="mt-4 text-3xl font-display font-bold text-titanium-50">{value}</div>
      <div className="mt-1 text-xs font-mono uppercase tracking-wider text-silver-400">
        {label}
      </div>
    </div>
  );
}

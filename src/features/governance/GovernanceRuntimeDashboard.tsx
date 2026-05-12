import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  FileCheck2,
  GitBranch,
  Lock,
  ShieldCheck
} from "lucide-react";
import {
  demoFrameworkControls,
  demoGovernanceAssets,
  demoGovernanceEvents,
  demoGovernancePolicies
} from "./demoGovernanceData";
import type { GovernanceRiskLevel } from "./types";

function riskClass(level: GovernanceRiskLevel) {
  switch (level) {
    case "critical":
      return "text-red-400 border-red-400/40 bg-red-400/10";
    case "high":
      return "text-amber-400 border-amber-400/40 bg-amber-400/10";
    case "medium":
      return "text-yellow-300 border-yellow-300/40 bg-yellow-300/10";
    case "low":
      return "text-emerald-400 border-emerald-400/40 bg-emerald-400/10";
    default:
      return "text-silver-300 border-silver-700/40 bg-silver-900/30";
  }
}

function scoreClass(score: number) {
  if (score >= 80) return "text-red-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-yellow-300";
  return "text-emerald-400";
}

export function GovernanceRuntimeDashboard() {
  const highRiskAssets = demoGovernanceAssets.filter(
    (asset) => asset.riskScore >= 70
  ).length;

  const activePolicies = demoGovernancePolicies.filter(
    (policy) => policy.enabled
  ).length;

  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Governance Runtime
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            Event-driven Compliance für AI, Web und Agents.
          </h2>
          <p className="mt-4 max-w-3xl text-silver-300 text-base sm:text-lg leading-relaxed">
            RealSyncDynamicsAI sammelt Governance-Events aus Website-Scans,
            AI-Systemen, Agent-Runtimes, SDKs und später Browser-Extensions —
            und verwandelt sie in Policies, Evidence und Framework-Mappings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <MetricCard icon={<Database />} label="Assets" value={demoGovernanceAssets.length.toString()} />
          <MetricCard icon={<Activity />} label="Runtime Events" value={demoGovernanceEvents.length.toString()} />
          <MetricCard icon={<AlertTriangle />} label="High Risk" value={highRiskAssets.toString()} />
          <MetricCard icon={<Lock />} label="Active Policies" value={activePolicies.toString()} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-obsidian-900/60 border border-silver-700/30 p-5">
            <div className="flex items-center gap-2 mb-5">
              <Activity className="h-5 w-5 text-titanium-100" />
              <h3 className="font-display font-bold text-xl text-titanium-50">
                Runtime Event Stream
              </h3>
            </div>

            <div className="space-y-3">
              {demoGovernanceEvents.map((event) => (
                <div
                  key={event.id}
                  className="border border-silver-700/30 bg-obsidian-950/60 p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <div className="font-bold text-titanium-50">
                        {event.title}
                      </div>
                      <div className="mt-1 text-xs text-silver-400">
                        {event.eventType} · {event.eventSource}
                      </div>
                    </div>
                    <span className={`text-[11px] font-mono uppercase tracking-wider px-2 py-1 border ${riskClass(event.riskLevel)}`}>
                      {event.riskLevel}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-silver-300 leading-relaxed">
                    {event.summary}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {event.vendor && (
                      <Tag>{event.vendor}</Tag>
                    )}
                    {event.modelName && (
                      <Tag>{event.modelName}</Tag>
                    )}
                    {event.policyAction && (
                      <Tag>Action: {event.policyAction}</Tag>
                    )}
                    {event.dataTypes.map((type) => (
                      <Tag key={type}>{type}</Tag>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <Panel
              icon={<ShieldCheck />}
              title="Policy Engine"
            >
              <div className="space-y-3">
                {demoGovernancePolicies.map((policy) => (
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
                      {policy.action}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          <Panel icon={<Bot />} title="Governance Assets">
            <div className="space-y-3">
              {demoGovernanceAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="border border-silver-700/30 bg-obsidian-950/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-titanium-50">{asset.name}</div>
                      <div className="mt-1 text-xs text-silver-400">
                        {asset.assetType} · {asset.vendor ?? "Internal"}
                      </div>
                    </div>
                    <div className={`font-mono text-sm font-bold ${scoreClass(asset.riskScore)}`}>
                      {asset.riskScore}/100
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Tag>{asset.aiActClass}</Tag>
                    {asset.dataTypes.slice(0, 3).map((type) => (
                      <Tag key={type}>{type}</Tag>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel icon={<FileCheck2 />} title="Framework Mapping">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {demoFrameworkControls.map((control) => (
                <div
                  key={control.id}
                  className="border border-silver-700/30 bg-obsidian-950/60 p-4"
                >
                  <div className="text-[11px] font-mono uppercase tracking-wider text-titanium-100">
                    {control.framework} · {control.controlCode}
                  </div>
                  <div className="mt-2 font-bold text-sm text-titanium-50">
                    {control.title}
                  </div>
                  <p className="mt-2 text-xs text-silver-400 leading-relaxed">
                    {control.description}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="mt-5 border border-titanium-100/20 bg-titanium-100/5 p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-2">
                Next Layer
              </div>
              <h3 className="font-display font-bold text-xl text-titanium-50">
                Von Findings zu Auto-Remediation.
              </h3>
              <p className="mt-2 text-sm text-silver-300 leading-relaxed max-w-2xl">
                Der nächste Schritt: Governance-Events erzeugen Tickets, GitHub-PRs,
                IaC-Fixes und Evidence-Snapshots automatisch.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-titanium-100">
              <GitBranch className="h-4 w-4" />
              PR / IaC / Ticket Automation
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-obsidian-900/60 border border-silver-700/30 p-5">
      <div className="h-8 w-8 text-titanium-100">{icon}</div>
      <div className="mt-4 text-3xl font-display font-bold text-titanium-50">
        {value}
      </div>
      <div className="mt-1 text-xs font-mono uppercase tracking-wider text-silver-400">
        {label}
      </div>
    </div>
  );
}

function Panel({
  icon,
  title,
  children
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-obsidian-900/60 border border-silver-700/30 p-5">
      <div className="flex items-center gap-2 mb-5 text-titanium-100">
        <div className="h-5 w-5">{icon}</div>
        <h3 className="font-display font-bold text-xl text-titanium-50">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-1 bg-silver-900/60 text-silver-300 border border-silver-700/30">
      {children}
    </span>
  );
}

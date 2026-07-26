import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  FileCheck2,
  GitBranch,
  Lock,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import type { GovernanceRiskLevel } from "./types";
import {
  fetchTenantEvents,
  fetchTenantAssets,
  fetchTenantPolicies,
  fetchFrameworkControls,
  type DbGovernanceEvent,
  type DbGovernanceAsset,
  type DbGovernancePolicy,
  type DbFrameworkControl
} from "./governanceApi";
import { useTenant } from '../../core/access/TenantProvider';

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
  const tenant = useTenant();
  const [events, setEvents] = useState<DbGovernanceEvent[]>([]);
  const [assets, setAssets] = useState<DbGovernanceAsset[]>([]);
  const [policies, setPolicies] = useState<DbGovernancePolicy[]>([]);
  const [controls, setControls] = useState<DbFrameworkControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant?.activeTenantId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const tenantId = tenant.activeTenantId!;
        const [eventsData, assetsData, policiesData, controlsData] = await Promise.all([
          fetchTenantEvents(tenantId, 50),
          fetchTenantAssets(tenantId),
          fetchTenantPolicies(tenantId),
          fetchFrameworkControls()
        ]);
        setEvents(eventsData);
        setAssets(assetsData);
        setPolicies(policiesData);
        setControls(controlsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load governance data');
        console.error('Error loading governance dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tenant?.activeTenantId]);

  const highRiskAssets = assets.filter(
    (asset) => asset.risk_score >= 70
  ).length;

  const activePolicies = policies.filter(
    (policy) => policy.enabled
  ).length;

  if (!tenant?.activeTenantId) {
    return (
      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="bg-amber-400/10 border border-amber-400/40 text-amber-400 p-4 rounded">
            <p className="text-sm">Not authenticated. Please log in to view governance data.</p>
          </div>
        </div>
      </section>
    );
  }

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

        {error && (
          <div className="mb-6 bg-red-400/10 border border-red-400/40 text-red-400 p-4 rounded flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Error loading governance data</p>
              <p className="text-xs mt-1 opacity-80">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-obsidian-900/60 border border-silver-700/30 p-5 animate-pulse">
                <div className="h-8 w-8 bg-silver-700/30 rounded mb-4"></div>
                <div className="h-8 bg-silver-700/30 rounded mb-3"></div>
                <div className="h-4 bg-silver-700/30 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <MetricCard icon={<Database />} label="Assets" value={assets.length.toString()} />
            <MetricCard icon={<Activity />} label="Runtime Events" value={events.length.toString()} />
            <MetricCard icon={<AlertTriangle />} label="High Risk" value={highRiskAssets.toString()} />
            <MetricCard icon={<Lock />} label="Active Policies" value={activePolicies.toString()} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-obsidian-900/60 border border-silver-700/30 p-5">
            <div className="flex items-center gap-2 mb-5">
              <Activity className="h-5 w-5 text-titanium-100" />
              <h3 className="font-display font-bold text-xl text-titanium-50">
                Runtime Event Stream
              </h3>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border border-silver-700/30 bg-obsidian-950/60 p-4 animate-pulse">
                    <div className="h-4 bg-silver-700/30 rounded w-1/2 mb-3"></div>
                    <div className="h-3 bg-silver-700/30 rounded w-1/3 mb-3"></div>
                    <div className="h-12 bg-silver-700/30 rounded mb-3"></div>
                    <div className="flex gap-2">
                      <div className="h-6 bg-silver-700/30 rounded w-20"></div>
                      <div className="h-6 bg-silver-700/30 rounded w-24"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : events.length > 0 ? (
              <div className="space-y-3">
                {events.map((event) => (
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
                          {event.event_type} · {event.event_source}
                        </div>
                      </div>
                      <span className={`text-[11px] font-mono uppercase tracking-wider px-2 py-1 border ${riskClass(event.risk_level as GovernanceRiskLevel)}`}>
                        {event.risk_level}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-silver-300 leading-relaxed">
                      {event.summary || 'No summary available'}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {event.vendor && (
                        <Tag>{event.vendor}</Tag>
                      )}
                      {event.model_name && (
                        <Tag>{event.model_name}</Tag>
                      )}
                      {event.policy_action && (
                        <Tag>Action: {event.policy_action}</Tag>
                      )}
                      {event.data_types.map((type) => (
                        <Tag key={type}>{type}</Tag>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-silver-400">
                <p className="text-sm">No governance events yet</p>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <Panel
              icon={<ShieldCheck />}
              title="Policy Engine"
            >
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border border-silver-700/30 bg-obsidian-950/60 p-4 animate-pulse">
                      <div className="h-4 bg-silver-700/30 rounded w-2/3 mb-2"></div>
                      <div className="h-3 bg-silver-700/30 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              ) : policies.length > 0 ? (
                <div className="space-y-3">
                  {policies.map((policy) => (
                    <div
                      key={policy.id}
                      className="border border-silver-700/30 bg-obsidian-950/60 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-bold text-sm text-titanium-50">
                          {policy.name}
                        </div>
                        {policy.enabled && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                      </div>
                      <p className="mt-2 text-xs text-silver-400 leading-relaxed">
                        {policy.description || 'No description'}
                      </p>
                      <div className="mt-3 text-[11px] font-mono uppercase tracking-wider text-titanium-100">
                        {policy.action}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-silver-400">No policies configured</p>
              )}
            </Panel>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          <Panel icon={<Bot />} title="Governance Assets">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border border-silver-700/30 bg-obsidian-950/60 p-4 animate-pulse">
                    <div className="h-4 bg-silver-700/30 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-silver-700/30 rounded w-1/3 mb-3"></div>
                    <div className="flex gap-2">
                      <div className="h-6 bg-silver-700/30 rounded w-20"></div>
                      <div className="h-6 bg-silver-700/30 rounded w-24"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : assets.length > 0 ? (
              <div className="space-y-3">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="border border-silver-700/30 bg-obsidian-950/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-titanium-50">{asset.name}</div>
                        <div className="mt-1 text-xs text-silver-400">
                          {asset.asset_type} · {asset.vendor ?? "Internal"}
                        </div>
                      </div>
                      <div className={`font-mono text-sm font-bold ${scoreClass(asset.risk_score)}`}>
                        {asset.risk_score}/100
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Tag>{asset.ai_act_class}</Tag>
                      {asset.data_types.slice(0, 3).map((type) => (
                        <Tag key={type}>{type}</Tag>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-silver-400">No assets registered</p>
            )}
          </Panel>

          <Panel icon={<FileCheck2 />} title="Framework Mapping">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="border border-silver-700/30 bg-obsidian-950/60 p-4 animate-pulse">
                    <div className="h-3 bg-silver-700/30 rounded w-2/3 mb-2"></div>
                    <div className="h-4 bg-silver-700/30 rounded w-full mt-2"></div>
                  </div>
                ))}
              </div>
            ) : controls.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {controls.map((control) => (
                  <div
                    key={control.id}
                    className="border border-silver-700/30 bg-obsidian-950/60 p-4"
                  >
                    <div className="text-[11px] font-mono uppercase tracking-wider text-titanium-100">
                      {control.framework} · {control.control_code}
                    </div>
                    <div className="mt-2 font-bold text-sm text-titanium-50">
                      {control.title}
                    </div>
                    <p className="mt-2 text-xs text-silver-400 leading-relaxed">
                      {control.description || 'No description'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-silver-400">No framework controls available</p>
            )}
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

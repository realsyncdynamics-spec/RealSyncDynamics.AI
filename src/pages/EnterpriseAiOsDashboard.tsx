import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  mockAiSystems,
  mockAuditEvents,
  mockConnectors,
  mockPolicies,
} from '../lib/enterprise-ai-os/mock-data';
import { enterpriseAgents } from '../lib/enterprise-ai-os/agents/registry';
import { EnterpriseFeedbackWidget } from '../components/enterprise-ai-os/FeedbackWidget';

interface AgentRunRow {
  id: string;
  tenant_id: string | null;
  agent_id: string;
  actor: string;
  status: string;
  summary: string;
  created_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

function useRecentAgentRuns(limit = 10) {
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!SUPABASE_URL) return;
    let cancelled = false;
    fetch(`${SUPABASE_URL}/functions/v1/enterprise-ai-os-agent-runs-list?limit=${limit}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        if (Array.isArray(body?.runs)) setRuns(body.runs as AgentRunRow[]);
        else if (body?.error) setError(String(body.error));
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => { cancelled = true; };
  }, [limit]);

  return { runs, error };
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
      {value}
    </span>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-xs text-zinc-500">{hint}</div>
    </div>
  );
}

export function EnterpriseAiOsDashboard() {
  const connectedSystems = mockConnectors.filter((c) => c.status === 'connected').length;
  const highRiskSystems = mockAiSystems.filter(
    (s) => s.risk_level === 'high' || s.risk_level === 'prohibited',
  ).length;
  const openApprovals = mockAiSystems.filter((s) => !s.approved).length;
  const { runs: recentRuns, error: runsError } = useRecentAgentRuns(10);

  return (
    <main className="min-h-screen bg-[#05070d] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-4 inline-flex rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-sm text-[#d4af37]">
              Enterprise AI OS
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">AI Governance Control Center</h1>
            <p className="mt-3 max-w-3xl text-zinc-400">
              Zentrale Übersicht über KI-Systeme, Connectoren, Agent Policies, Risiken und Audit
              Events.
            </p>
          </div>

          <Link
            to="/enterprise-ai-os/founding-access"
            className="rounded-2xl bg-[#d4af37] px-5 py-3 text-center font-semibold text-black"
          >
            Founding Access aktivieren
          </Link>
        </div>

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Verbundene Systeme" value={connectedSystems} hint="Live Connector Status" />
          <KpiCard label="Erkannte KI-Systeme" value={mockAiSystems.length} hint="AI Registry" />
          <KpiCard label="Hochrisiko-Systeme" value={highRiskSystems} hint="EU AI Act Risk Mapping" />
          <KpiCard label="Offene Freigaben" value={openApprovals} hint="Human Approval Required" />
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">AI System Registry</h2>
            <div className="mt-5 space-y-4">
              {mockAiSystems.map((system) => (
                <div key={system.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">{system.name}</div>
                      <div className="text-sm text-zinc-500">
                        {system.provider} · {system.model}
                      </div>
                    </div>
                    <StatusBadge value={system.risk_level} />
                  </div>
                  <p className="mt-3 text-sm text-zinc-400">{system.usage_context}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Connector Status</h2>
            <div className="mt-5 space-y-4">
              {mockConnectors.map((connector) => (
                <div
                  key={connector.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div>
                    <div className="font-medium">{connector.name}</div>
                    <div className="text-sm text-zinc-500">{connector.type}</div>
                  </div>
                  <StatusBadge value={connector.status} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Agent Policies</h2>
            <div className="mt-5 space-y-4">
              {mockPolicies.map((policy) => (
                <div key={policy.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="font-medium">{policy.name}</div>
                  <p className="mt-2 text-sm text-zinc-400">{policy.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {policy.allowed_models.map((model) => (
                      <StatusBadge key={model} value={model} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Audit Events</h2>
            <div className="mt-5 space-y-4">
              {mockAuditEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-medium">{event.action}</div>
                    <StatusBadge value={event.risk_level || 'unknown'} />
                  </div>
                  <div className="mt-2 text-sm text-zinc-500">
                    {event.actor} · {event.system_name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Agent Control Layer</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Sieben kontrollierte Governance-Agenten. Keine autonomen externen Aktionen — alle
                riskanten Schritte erfordern menschliche Freigabe oder werden nur empfohlen.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enterpriseAgents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-2xl border border-white/10 bg-black/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{agent.name}</div>
                    <div className="text-xs text-zinc-500">
                      Layer: {agent.position.layer} · Order {agent.position.order}
                    </div>
                  </div>
                  <StatusBadge value={agent.autonomyLevel} />
                </div>

                <p className="mt-3 text-xs text-zinc-400">{agent.description}</p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {agent.capabilities.map((cap) => (
                    <span
                      key={cap.id}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-300"
                    >
                      {cap.label}
                    </span>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] text-zinc-500">
                  <div>
                    <div className="text-zinc-400">Status</div>
                    <div className="text-zinc-200">{agent.status}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Audit</div>
                    <div className="text-zinc-200">{agent.auditRequired ? 'required' : 'optional'}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Human approval</div>
                    <div className="text-zinc-200">{agent.humanApprovalRequired ? 'required' : 'optional'}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Forbidden</div>
                    <div className="text-zinc-200">{agent.forbiddenActions.length} actions</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Recent Agent Runs</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Letzte Dispatcher-Aufrufe ans Agent Control Layer. Ergebnisse sind revisionssicher
                in <code className="text-zinc-300">enterprise_agent_runs</code> persistiert.
              </p>
            </div>
          </div>

          {runsError && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {runsError}
            </div>
          )}

          {recentRuns.length === 0 && !runsError && (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-500">
              Noch keine Agent Runs persistiert. Sobald ein Agent über{' '}
              <code className="text-zinc-300">/functions/v1/enterprise-ai-os-agents-run</code>{' '}
              läuft, erscheint er hier.
            </div>
          )}

          {recentRuns.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-zinc-500">
                    <th className="pb-3 text-left">Agent</th>
                    <th className="pb-3 text-left">Status</th>
                    <th className="pb-3 text-left">Summary</th>
                    <th className="pb-3 text-left">Actor</th>
                    <th className="pb-3 text-right">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((run) => (
                    <tr key={run.id} className="border-t border-white/5">
                      <td className="py-2.5 pr-3 text-zinc-200">{run.agent_id}</td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge value={run.status} />
                      </td>
                      <td className="py-2.5 pr-3 text-zinc-400">{run.summary}</td>
                      <td className="py-2.5 pr-3 text-zinc-500">{run.actor}</td>
                      <td className="py-2.5 text-right text-xs text-zinc-500">
                        {new Date(run.created_at).toLocaleString('de-DE')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-10 text-xs text-zinc-500">
          Hinweis: Dieses System unterstützt Governance, Dokumentation und Risikomanagement. Es
          ersetzt keine individuelle Rechtsberatung.
        </p>
      </div>

      <EnterpriseFeedbackWidget />
    </main>
  );
}

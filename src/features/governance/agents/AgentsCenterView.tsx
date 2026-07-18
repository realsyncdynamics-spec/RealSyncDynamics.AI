// AgentsCenterView — Enterprise Skills Agent Center
// Echte Enterprise-AI-OS-Agenten (Registry), angebunden an die
// enterprise-ai-os-agents-run / -agent-runs-list Edge Functions.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Play,
  History,
  Settings,
  CheckCircle,
  Clock,
  Loader2,
  X,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import {
  enterpriseAgents,
  runAgent,
  fetchAgentRuns,
  AUTONOMY_LABELS,
  AGENT_STATUS_LABELS,
  type AgentId,
  type AgentRunResult,
  type AgentRunRow,
} from './agentsApi';
import type { EnterpriseAgentDefinition } from '../../../lib/enterprise-ai-os/agents/types';
import { AgentActivityPanel } from './AgentActivityPanel';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../withPerformanceMonitoring';

// ── Status-Pill ────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: EnterpriseAgentDefinition['status'] }) {
  if (status === 'active') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 bg-teal-600/20 border border-teal-600/40 text-teal-400 font-mono text-[10px]">
        <CheckCircle className="h-3 w-3" /> {AGENT_STATUS_LABELS[status]}
      </span>
    );
  }
  if (status === 'experimental') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-600/20 border border-amber-600/40 text-amber-400 font-mono text-[10px]">
        <AlertTriangle className="h-3 w-3" /> {AGENT_STATUS_LABELS[status]}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-obsidian-800 border border-titanium-800 text-titanium-500 font-mono text-[10px]">
      <Clock className="h-3 w-3" /> {AGENT_STATUS_LABELS[status]}
    </span>
  );
}

// ── Agent-Card ─────────────────────────────────────────────────────────────
interface CardHandlers {
  onRun: (a: EnterpriseAgentDefinition) => void;
  onHistory: (a: EnterpriseAgentDefinition) => void;
  onConfig: (a: EnterpriseAgentDefinition) => void;
  busyId: AgentId | null;
}

function AgentCard({ agent, handlers }: { agent: EnterpriseAgentDefinition; handlers: CardHandlers }) {
  const busy = handlers.busyId === agent.id;
  return (
    <div className="bg-obsidian-900 border border-titanium-900 flex flex-col hover:border-titanium-700 transition-colors">
      <div className="flex items-start gap-3 p-4 border-b border-titanium-900">
        <div className="h-10 w-10 shrink-0 flex items-center justify-center bg-teal-700">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-titanium-100 leading-tight">{agent.name}</h3>
            <StatusPill status={agent.status} />
          </div>
          <p className="text-xs text-titanium-500 mt-0.5 line-clamp-2">{agent.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-titanium-900 border-b border-titanium-900">
        <div className="px-3 py-2 text-center">
          <div className="font-mono text-sm font-semibold text-titanium-100">{agent.capabilities.length}</div>
          <div className="font-mono text-[9px] text-titanium-600 uppercase">Skills</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="font-mono text-[10px] text-titanium-300 leading-tight">{AUTONOMY_LABELS[agent.autonomyLevel]}</div>
          <div className="font-mono text-[9px] text-titanium-600 uppercase">Autonomie</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className={`font-mono text-sm font-semibold ${agent.humanApprovalRequired ? 'text-amber-400' : 'text-teal-400'}`}>
            {agent.humanApprovalRequired ? 'Ja' : 'Nein'}
          </div>
          <div className="font-mono text-[9px] text-titanium-600 uppercase">Freigabe</div>
        </div>
      </div>

      <div className="flex items-center gap-0 p-3">
        <button
          onClick={() => handlers.onRun(agent)}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-mono text-teal-400 border border-teal-700 hover:bg-teal-700/20 transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          Skill starten
        </button>
        <button
          onClick={() => handlers.onHistory(agent)}
          title="Verlauf"
          className="px-3 py-1.5 text-xs font-mono text-titanium-400 border border-titanium-800 border-l-0 hover:bg-obsidian-800 transition-colors"
        >
          <History className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => handlers.onConfig(agent)}
          title="Konfiguration"
          className="px-3 py-1.5 text-xs font-mono text-titanium-400 border border-titanium-800 border-l-0 hover:bg-obsidian-800 transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-obsidian-900 border border-titanium-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-titanium-800 px-4 py-3 sticky top-0 bg-obsidian-900">
          <h2 className="text-sm font-semibold text-titanium-100">{title}</h2>
          <button onClick={onClose} className="text-titanium-500 hover:text-titanium-200"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Toast({ message, tone }: { message: string; tone: 'ok' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 border font-mono text-xs shadow-lg ${tone === 'error' ? 'bg-red-950 border-red-800 text-red-200' : 'bg-obsidian-800 border-teal-700 text-teal-300'}`}>
      {tone === 'error' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
      {message}
    </div>
  );
}

// ── AgentsCenterView ───────────────────────────────────────────────────────
export function AgentsCenterView() {
  const { activeTenantId } = useTenant();
  const [filter, setFilter] = useState<'alle' | 'active' | 'experimental'>('alle');
  const [busyId, setBusyId] = useState<AgentId | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'error' } | null>(null);
  const [runResult, setRunResult] = useState<{ agent: EnterpriseAgentDefinition; result: AgentRunResult } | null>(null);
  const [config, setConfig] = useState<EnterpriseAgentDefinition | null>(null);
  const [history, setHistory] = useState<{ agent: EnterpriseAgentDefinition; rows: AgentRunRow[] | null; error?: string } | null>(null);
  const [allRuns, setAllRuns] = useState<AgentRunRow[]>([]);

  function showToast(msg: string, tone: 'ok' | 'error' = 'ok') {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadRuns() {
    try {
      const rows = await fetchAgentRuns(activeTenantId ?? undefined, 100);
      setAllRuns(rows);
    } catch {
      /* keine Daten / nicht konfiguriert */
    }
  }

  useEffect(() => {
    void loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId]);

  const runsByAgent = useMemo(() => {
    const map = new Map<string, AgentRunRow[]>();
    for (const r of allRuns) {
      const list = map.get(r.agent_id) ?? [];
      list.push(r);
      map.set(r.agent_id, list);
    }
    return map;
  }, [allRuns]);

  const handlers: CardHandlers = {
    busyId,
    onRun: async (agent) => {
      setBusyId(agent.id);
      try {
        const res = await runAgent({ agentId: agent.id, tenantId: activeTenantId ?? undefined });
        if (!res.ok || !res.result) {
          showToast(res.error ?? 'Agent-Lauf fehlgeschlagen.', 'error');
          return;
        }
        setRunResult({ agent, result: res.result });
        showToast(`${agent.shortName}: ${res.result.status}`);
        await loadRuns();
      } catch (e) {
        showToast((e as Error).message, 'error');
      } finally {
        setBusyId(null);
      }
    },
    onHistory: async (agent) => {
      setHistory({ agent, rows: null });
      try {
        const rows = await fetchAgentRuns(activeTenantId ?? undefined, 100);
        setHistory({ agent, rows: rows.filter((r) => r.agent_id === agent.id) });
      } catch (e) {
        setHistory({ agent, rows: [], error: (e as Error).message });
      }
    },
    onConfig: (agent) => setConfig(agent),
  };

  const filtered = enterpriseAgents.filter((a) => {
    if (filter === 'active') return a.status === 'active';
    if (filter === 'experimental') return a.status === 'experimental';
    return true;
  });

  const totalAgents = enterpriseAgents.length;
  const activeCount = enterpriseAgents.filter((a) => a.status === 'active').length;
  const totalRuns = allRuns.length;
  const successRuns = allRuns.filter((r) => r.status === 'success').length;

  return (
    <div className="flex flex-col h-full bg-obsidian-950 text-titanium-100">
      <div className="border-b border-titanium-900 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-display font-semibold text-titanium-100 tracking-tight">Enterprise Skills</h1>
            <p className="font-mono text-xs text-titanium-500 mt-0.5">
              {totalAgents} spezialisierte Governance-Agenten · EU-souverän · Prüfpfad-pflichtig
            </p>
          </div>
          <button
            onClick={() => setConfig(enterpriseAgents[0])}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-xs font-mono hover:bg-teal-500 transition-colors"
          >
            <Bot className="h-3.5 w-3.5" />
            Agent konfigurieren
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 divide-x divide-titanium-900 border-b border-titanium-900 shrink-0">
        {[
          { label: 'Agenten gesamt', value: totalAgents, color: 'text-titanium-100' },
          { label: 'Aktiv', value: activeCount, color: 'text-teal-400' },
          { label: 'Läufe gesamt', value: totalRuns, color: 'text-titanium-100' },
          { label: 'Erfolgreich', value: successRuns, color: 'text-teal-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-6 py-3">
            <div className={`font-mono text-xl font-bold ${color}`}>{value}</div>
            <div className="font-mono text-[10px] text-titanium-600 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-0 px-6 py-3 border-b border-titanium-900 shrink-0">
        {(['alle', 'active', 'experimental'] as const).map((f) => {
          const labels = { alle: 'Alle', active: 'Aktiv', experimental: 'Experimentell' };
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-xs font-mono border transition-colors ${
                filter === f ? 'bg-obsidian-800 border-titanium-700 text-titanium-100' : 'border-transparent text-titanium-500 hover:text-titanium-300'
              }`}
            >
              {labels[f]}
            </button>
          );
        })}
        <span className="ml-auto font-mono text-[10px] text-titanium-600">{filtered.length} Agenten</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} handlers={handlers} />
          ))}
        </div>
        <AgentActivityPanel />
      </div>

      {/* Run-Result-Modal */}
      {runResult && (
        <Modal title={`${runResult.agent.name} — Ergebnis`} onClose={() => setRunResult(null)}>
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-titanium-600 uppercase">Status</span>
              <span className="font-mono text-titanium-100">{runResult.result.status}</span>
            </div>
            <p className="text-titanium-300">{runResult.result.summary}</p>
            <div>
              <div className="font-mono text-[10px] text-titanium-600 uppercase mb-1">Findings ({runResult.result.findings.length})</div>
              <pre className="bg-obsidian-950 border border-titanium-800 p-2 overflow-x-auto font-mono text-[10px] text-titanium-300 max-h-40">
                {JSON.stringify(runResult.result.findings, null, 2)}
              </pre>
            </div>
            <div>
              <div className="font-mono text-[10px] text-titanium-600 uppercase mb-1">Empfehlungen ({runResult.result.recommendations.length})</div>
              <pre className="bg-obsidian-950 border border-titanium-800 p-2 overflow-x-auto font-mono text-[10px] text-titanium-300 max-h-40">
                {JSON.stringify(runResult.result.recommendations, null, 2)}
              </pre>
            </div>
            {runResult.result.persist_error && (
              <p className="text-amber-400 font-mono text-[10px]">Hinweis: Lauf nicht persistiert ({runResult.result.persist_error}).</p>
            )}
          </div>
        </Modal>
      )}

      {/* History-Modal */}
      {history && (
        <Modal title={`${history.agent.name} — Verlauf`} onClose={() => setHistory(null)}>
          {history.rows === null ? (
            <div className="flex items-center gap-2 text-titanium-400 text-xs"><Loader2 className="h-4 w-4 animate-spin" /> Lädt …</div>
          ) : history.error ? (
            <p className="text-red-300 text-xs">{history.error}</p>
          ) : history.rows.length === 0 ? (
            <p className="text-titanium-500 text-xs">Noch keine Läufe für diesen Agenten.</p>
          ) : (
            <div className="divide-y divide-titanium-900">
              {history.rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <div className="font-mono text-titanium-200">{r.status}</div>
                    <div className="text-titanium-500">{r.summary}</div>
                  </div>
                  <div className="font-mono text-[10px] text-titanium-600">{new Date(r.created_at).toLocaleString('de-DE')}</div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Config-Modal */}
      {config && (
        <Modal title={`${config.name} — Konfiguration`} onClose={() => setConfig(null)}>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div><dt className="font-mono text-[10px] text-titanium-600 uppercase">Autonomie</dt><dd className="text-titanium-200">{AUTONOMY_LABELS[config.autonomyLevel]}</dd></div>
            <div><dt className="font-mono text-[10px] text-titanium-600 uppercase">Status</dt><dd className="text-titanium-200">{AGENT_STATUS_LABELS[config.status]}</dd></div>
            <div><dt className="font-mono text-[10px] text-titanium-600 uppercase">Prüfpfad</dt><dd className="text-titanium-200">{config.auditRequired ? 'erforderlich' : 'optional'}</dd></div>
            <div><dt className="font-mono text-[10px] text-titanium-600 uppercase">Freigabe</dt><dd className="text-titanium-200">{config.humanApprovalRequired ? 'erforderlich' : 'nicht nötig'}</dd></div>
          </dl>
          <div className="mt-4">
            <div className="font-mono text-[10px] text-titanium-600 uppercase mb-1 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Skills</div>
            <ul className="space-y-1">
              {config.capabilities.map((c) => (
                <li key={c.id} className="text-xs text-titanium-300">• {c.label} <span className="text-titanium-600">— {c.description}</span></li>
              ))}
            </ul>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="font-mono text-[10px] text-titanium-600 uppercase mb-1">Erlaubte Aktionen</div>
              <ul className="text-titanium-300 space-y-0.5">{config.allowedActions.map((a) => <li key={a}>+ {a}</li>)}</ul>
            </div>
            <div>
              <div className="font-mono text-[10px] text-titanium-600 uppercase mb-1">Verbotene Aktionen</div>
              <ul className="text-titanium-400 space-y-0.5">{config.forbiddenActions.map((a) => <li key={a}>− {a}</li>)}</ul>
            </div>
          </div>
          <p className="mt-4 font-mono text-[10px] text-titanium-600">
            {runsByAgent.get(config.id)?.length ?? 0} dokumentierte Läufe für diesen Mandanten.
          </p>
        </Modal>
      )}

      {toast && <Toast message={toast.msg} tone={toast.tone} />}
    </div>
  );
}

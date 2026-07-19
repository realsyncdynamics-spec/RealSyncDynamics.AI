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
import { withPerformanceMonitoring } from '../../../lib/hoc';
import { AuthGate } from '../../kodee/connections/AuthGate';

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
function _AgentsCenterView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const AgentsCenterView = withPerformanceMonitoring(
  _AgentsCenterView,
  'AgentsCenterView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<AgentId | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'error' } | null>(null);

  const [activeTab, setActiveTab] = useState<'agents' | 'activity'>('agents');
  const [selectedAgent, setSelectedAgent] = useState<EnterpriseAgentDefinition | null>(null);
  const [modal, setModal] = useState<{
    type: 'result' | 'history' | 'config';
    data?: AgentRunResult | null;
  } | null>(null);

  useEffect(() => {
    void loadRuns();
  }, [activeTenantId]);

  const loadRuns = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      const data = await fetchAgentRuns(activeTenantId);
      setRuns(data || []);
    } catch (err) {
      console.error('Failed to fetch agent runs:', err);
      setToast({ message: 'Failed to load agent runs', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRunAgent = async (agent: EnterpriseAgentDefinition) => {
    if (!activeTenantId) return;
    try {
      setBusyId(agent.id);
      const response = await runAgent({
        agentId: agent.id,
        tenantId: activeTenantId,
        actor: 'dashboard-user',
      });
      if (response.ok && response.result) {
        setToast({ message: `Agent "${agent.name}" gestartet`, tone: 'ok' });
        await loadRuns();
        setModal({ type: 'result', data: response.result });
      } else {
        setToast({ message: response.error || `Fehler beim Starten von "${agent.name}"`, tone: 'error' });
      }
    } catch (err) {
      console.error('Failed to run agent:', err);
      setToast({ message: `Fehler beim Starten von "${agent.name}"`, tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleShowHistory = (agent: EnterpriseAgentDefinition) => {
    setSelectedAgent(agent);
    setModal({ type: 'history' });
  };

  const handleShowConfig = (agent: EnterpriseAgentDefinition) => {
    setSelectedAgent(agent);
    setModal({ type: 'config' });
  };

  const activeAgents = useMemo(() => enterpriseAgents.filter((a) => a.status === 'active'), []);
  const experimentalAgents = useMemo(() => enterpriseAgents.filter((a) => a.status === 'experimental'), []);
  const inactiveAgents = useMemo(() => enterpriseAgents.filter((a) => a.status === 'inactive'), []);

  const successfulRuns = useMemo(() => runs.filter((r) => r.status === 'success').length, [runs]);
  const failedRuns = useMemo(() => runs.filter((r) => r.status === 'error').length, [runs]);

  return (
    <div className="flex flex-col h-screen bg-obsidian-950 text-titanium-100">
      {/* Header + Metriken */}
      <div className="px-6 py-4 border-b border-titanium-900">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold">Agents Center</h1>
            <p className="text-[12px] text-titanium-400 mt-1">Enterprise Skills & Governance Automation</p>
          </div>
          <button
            onClick={() => void loadRuns()}
            disabled={loading}
            className="font-mono text-[10px] uppercase tracking-wider text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {loading ? '⟳ Wird geladen...' : '🔄 Aktualisieren'}
          </button>
        </div>

        {/* Metrik-Reihe */}
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-obsidian-900 border border-titanium-900 px-4 py-3 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Gesamt-Agenten</span>
            <span className="font-mono text-xl font-semibold text-titanium-100">{enterpriseAgents.length}</span>
          </div>
          <div className="bg-obsidian-900 border border-titanium-900 px-4 py-3 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Aktiv</span>
            <span className="font-mono text-xl font-semibold text-teal-400">{activeAgents.length}</span>
          </div>
          <div className="bg-obsidian-900 border border-titanium-900 px-4 py-3 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Experimentell</span>
            <span className="font-mono text-xl font-semibold text-amber-400">{experimentalAgents.length}</span>
          </div>
          <div className="bg-obsidian-900 border border-titanium-900 px-4 py-3 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Erfolgreiche Läufe</span>
            <span className="font-mono text-xl font-semibold text-teal-400">{successfulRuns}</span>
          </div>
          <div className="bg-obsidian-900 border border-titanium-900 px-4 py-3 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Fehlerhafte Läufe</span>
            <span className="font-mono text-xl font-semibold text-red-400">{failedRuns}</span>
          </div>
        </div>
      </div>

      {/* Tab-Navigation */}
      <div className="px-6 py-3 border-b border-titanium-900 flex gap-1">
        <button
          onClick={() => setActiveTab('agents')}
          type="button"
          className={`font-mono text-[10px] uppercase tracking-wider px-3 py-2 transition-colors ${
            activeTab === 'agents'
              ? 'text-teal-400 border-b-2 border-teal-400'
              : 'text-titanium-500 hover:text-titanium-300 border-b-2 border-transparent'
          }`}
        >
          Agenten
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          type="button"
          className={`font-mono text-[10px] uppercase tracking-wider px-3 py-2 transition-colors ${
            activeTab === 'activity'
              ? 'text-teal-400 border-b-2 border-teal-400'
              : 'text-titanium-500 hover:text-titanium-300 border-b-2 border-transparent'
          }`}
        >
          Aktivität
        </button>
      </div>

      {/* Tab-Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {activeTab === 'agents' && (
          <div className="space-y-6">
            {activeAgents.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-titanium-100 mb-3">Aktive Agenten</h2>
                <div className="grid grid-cols-3 gap-4">
                  {activeAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      handlers={{
                        onRun: handleRunAgent,
                        onHistory: handleShowHistory,
                        onConfig: handleShowConfig,
                        busyId,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {experimentalAgents.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-titanium-100 mb-3">Experimentelle Agenten</h2>
                <div className="grid grid-cols-3 gap-4">
                  {experimentalAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      handlers={{
                        onRun: handleRunAgent,
                        onHistory: handleShowHistory,
                        onConfig: handleShowConfig,
                        busyId,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {inactiveAgents.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-titanium-100 mb-3">Inaktive Agenten</h2>
                <div className="grid grid-cols-3 gap-4">
                  {inactiveAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      handlers={{
                        onRun: handleRunAgent,
                        onHistory: handleShowHistory,
                        onConfig: handleShowConfig,
                        busyId,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <AgentActivityPanel />
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'result' && modal.data && (
        <Modal
          title={`Ergebnis: ${selectedAgent?.name || 'Lauf'}`}
          onClose={() => setModal(null)}
        >
          <div className="space-y-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Status</span>
              <p className={`font-mono text-sm font-semibold mt-1 ${
                modal.data.status === 'success' ? 'text-teal-400' : 'text-red-400'
              }`}>
                {modal.data.status === 'success' ? '✓ Erfolgreich' : '✕ Fehlgeschlagen'}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Zusammenfassung</span>
              <p className="mt-1 text-[12px] text-titanium-300">{modal.data.summary}</p>
            </div>
            {modal.data.findings.length > 0 && (
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Befunde ({modal.data.findings.length})</span>
                <pre className="mt-1 p-2 bg-obsidian-800 border border-titanium-800 text-[10px] text-titanium-300 overflow-auto max-h-48">
                  {JSON.stringify(modal.data.findings, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}

      {modal?.type === 'history' && selectedAgent && (
        <Modal title={`Verlauf: ${selectedAgent.name}`} onClose={() => setModal(null)}>
          <div className="space-y-2 max-h-96 overflow-auto">
            {runs
              .filter((r) => r.agent_id === selectedAgent.id)
              .slice(0, 10)
              .map((run) => (
                <div key={run.id} className="p-2 bg-obsidian-800 border border-titanium-800">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-titanium-500">{run.created_at}</span>
                    <span className={`font-mono text-[10px] font-semibold ${
                      run.status === 'success' ? 'text-teal-400' : 'text-red-400'
                    }`}>
                      {run.status === 'success' ? '✓ OK' : '✕ Fehler'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-titanium-300 line-clamp-2">{run.summary}</p>
                </div>
              ))}
          </div>
        </Modal>
      )}

      {modal?.type === 'config' && selectedAgent && (
        <Modal title={`Konfiguration: ${selectedAgent.name}`} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Name</span>
              <p className="mt-1 text-sm text-titanium-100">{selectedAgent.name}</p>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Beschreibung</span>
              <p className="mt-1 text-[12px] text-titanium-300">{selectedAgent.description}</p>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Skills ({selectedAgent.capabilities.length})</span>
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedAgent.capabilities.map((cap) => (
                  <span key={cap.id} className="px-2 py-1 bg-teal-900/30 border border-teal-700 text-teal-300 text-[10px] font-mono">
                    {cap.label}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Autonomie</span>
              <p className="mt-1 font-mono text-[11px] text-titanium-300">{AUTONOMY_LABELS[selectedAgent.autonomyLevel]}</p>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Freigabe erforderlich</span>
              <p className={`mt-1 font-mono text-[11px] ${selectedAgent.humanApprovalRequired ? 'text-amber-400' : 'text-teal-400'}`}>
                {selectedAgent.humanApprovalRequired ? 'Ja' : 'Nein'}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}

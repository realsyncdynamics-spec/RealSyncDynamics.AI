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

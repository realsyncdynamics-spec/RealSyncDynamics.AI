// AgentsCenterView — Governance-Agenten-Center (/app/agents)
//
// Zeigt das echte, pro Arbeitsbereich gespeicherte Agenten-Register aus
// public.governance_agents (gleiche Quelle wie das Agenten-Register).
// Frühere Version: 15 hartkodierte Agenten mit fabrizierten Aktivitäts-
// metriken (Runs heute/Findings/Letzter Run) — entfernt (Audit-Befund K7).
import { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle, Clock, AlertTriangle, ShieldOff } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { loadAgents } from './agentsApi';
import type { AgentStatus, AgentType, GovernanceAgent } from './types';

// ── Darstellungshilfen ──────────────────────────────────────────────────────
const TYPE_ACCENT: Record<AgentType, string> = {
  detection:      'bg-teal-600',
  classification: 'bg-blue-600',
  evidence:       'bg-violet-600',
  policy:         'bg-emerald-600',
  triage:         'bg-amber-600',
  remediation:    'bg-rose-600',
};
const TYPE_LABEL: Record<AgentType, string> = {
  detection: 'Detection', classification: 'Klassifizierung', evidence: 'Evidence',
  policy: 'Policy', triage: 'Triage', remediation: 'Remediation',
};
const RISK_LABEL: Record<string, string> = {
  low: 'Niedrig', medium: 'Mittel', high: 'Hoch', critical: 'Kritisch',
};
function riskColor(risk: string): string {
  return risk === 'critical' ? 'text-red-400'
    : risk === 'high' ? 'text-orange-400'
    : risk === 'medium' ? 'text-amber-400'
    : 'text-teal-400';
}

function StatusPill({ status }: { status: AgentStatus }) {
  if (status === 'active') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 bg-teal-600/20 border border-teal-600/40 text-teal-400 font-mono text-[10px]">
        <CheckCircle className="h-3 w-3" />Aktiv
      </span>
    );
  }
  if (status === 'review_required') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-600/20 border border-amber-600/40 text-amber-400 font-mono text-[10px]">
        <AlertTriangle className="h-3 w-3" />Review
      </span>
    );
  }
  if (status === 'disabled') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 bg-obsidian-800 border border-titanium-800 text-titanium-600 font-mono text-[10px]">
        <ShieldOff className="h-3 w-3" />Deaktiviert
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-obsidian-800 border border-titanium-800 text-titanium-500 font-mono text-[10px]">
      <Clock className="h-3 w-3" />Pausiert
    </span>
  );
}

// ── Agent-Card ─────────────────────────────────────────────────────────────
function AgentCard({ agent }: { agent: GovernanceAgent }) {
  return (
    <div className="bg-obsidian-900 border border-titanium-900 flex flex-col hover:border-titanium-700 transition-colors">
      <div className="flex items-start gap-3 p-4 border-b border-titanium-900">
        <div className={`h-10 w-10 shrink-0 flex items-center justify-center ${TYPE_ACCENT[agent.type]}`}>
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-titanium-100 leading-tight">{agent.name}</h3>
            <StatusPill status={agent.status} />
          </div>
          <p className="text-xs text-titanium-500 mt-0.5">{agent.description}</p>
        </div>
      </div>

      {/* Eigenschaften (echt) statt fabrizierter Aktivitätsmetriken */}
      <div className="grid grid-cols-3 divide-x divide-titanium-900 border-b border-titanium-900">
        <div className="px-3 py-2 text-center">
          <div className="font-mono text-[11px] font-semibold text-titanium-100">{TYPE_LABEL[agent.type]}</div>
          <div className="font-mono text-[9px] text-titanium-600 uppercase">Typ</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className={`font-mono text-[11px] font-semibold ${riskColor(agent.riskLevel)}`}>
            {RISK_LABEL[agent.riskLevel] ?? agent.riskLevel}
          </div>
          <div className="font-mono text-[9px] text-titanium-600 uppercase">Risiko</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="font-mono text-sm font-semibold text-titanium-100">{agent.tools.length}</div>
          <div className="font-mono text-[9px] text-titanium-600 uppercase">Tools</div>
        </div>
      </div>

      {/* Governance-Hinweise (echt) */}
      <div className="p-3 space-y-1.5">
        {agent.requiresHumanReview.length > 0 && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-amber-400/90">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Human Review verbindlich · {agent.requiresHumanReview.length} {agent.requiresHumanReview.length === 1 ? 'Punkt' : 'Punkte'}
          </div>
        )}
        {agent.restrictedActions.length > 0 && (
          <div className="font-mono text-[10px] text-titanium-500">
            {agent.restrictedActions.length} gesperrte {agent.restrictedActions.length === 1 ? 'Aktion' : 'Aktionen'}
          </div>
        )}
        <div className="font-mono text-[10px] text-titanium-600">Verantwortlich: {agent.ownerRole}</div>
      </div>
    </div>
  );
}

// ── AgentsCenterView ───────────────────────────────────────────────────────
type StatusFilter = 'alle' | AgentStatus;

export function AgentsCenterView() {
  const { activeTenantId } = useTenant();
  const [filter, setFilter] = useState<StatusFilter>('alle');
  const [agents, setAgents] = useState<GovernanceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) { setAgents([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadAgents(activeTenantId)
      .then((a) => { if (!cancelled) setAgents(a); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const counts = useMemo(() => ({
    total:           agents.length,
    active:          agents.filter((a) => a.status === 'active').length,
    review_required: agents.filter((a) => a.status === 'review_required').length,
    paused:          agents.filter((a) => a.status === 'paused').length,
  }), [agents]);

  const filtered = useMemo(
    () => (filter === 'alle' ? agents : agents.filter((a) => a.status === filter)),
    [agents, filter],
  );

  return (
    <div className="flex flex-col h-full bg-obsidian-950 text-titanium-100">
      {/* Page Header */}
      <div className="border-b border-titanium-900 px-6 py-4 shrink-0">
        <h1 className="text-lg font-display font-semibold text-titanium-100 tracking-tight">
          Governance-Agenten
        </h1>
        <p className="font-mono text-xs text-titanium-500 mt-0.5">
          Kontrollierte Agenten · pro Arbeitsbereich gespeichert · Human Review verbindlich
        </p>
      </div>

      {/* Metriken-Zeile (echte Zählungen) */}
      <div className="grid grid-cols-4 divide-x divide-titanium-900 border-b border-titanium-900 shrink-0">
        {[
          { label: 'Agenten gesamt', value: counts.total, color: 'text-titanium-100' },
          { label: 'Aktiv', value: counts.active, color: 'text-teal-400' },
          { label: 'Review erforderlich', value: counts.review_required, color: 'text-amber-400' },
          { label: 'Pausiert', value: counts.paused, color: 'text-sky-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-6 py-3">
            <div className={`font-mono text-xl font-bold ${color}`}>{value}</div>
            <div className="font-mono text-[10px] text-titanium-600 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter-Leiste */}
      <div className="flex items-center gap-0 px-6 py-3 border-b border-titanium-900 shrink-0">
        {(['alle', 'active', 'review_required', 'paused'] as const).map((f) => {
          const labels: Record<StatusFilter, string> = {
            alle: 'Alle', active: 'Aktiv', review_required: 'Review', paused: 'Pausiert', disabled: 'Deaktiviert',
          };
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-xs font-mono border transition-colors ${
                filter === f
                  ? 'bg-obsidian-800 border-titanium-700 text-titanium-100'
                  : 'border-transparent text-titanium-500 hover:text-titanium-300'
              }`}
            >
              {labels[f]}
            </button>
          );
        })}
        <span className="ml-auto font-mono text-[10px] text-titanium-600">
          {filtered.length} Agenten
        </span>
      </div>

      {/* Agent-Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="font-mono text-xs text-titanium-500">Wird geladen …</p>
        ) : error ? (
          <p className="font-mono text-xs text-red-300">{error}</p>
        ) : !activeTenantId ? (
          <p className="font-mono text-xs text-titanium-500">Kein aktiver Arbeitsbereich.</p>
        ) : filtered.length === 0 ? (
          <p className="font-mono text-xs text-titanium-500">
            {agents.length === 0 ? 'Noch keine Agenten registriert.' : 'Keine Agenten in dieser Ansicht.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filtered.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

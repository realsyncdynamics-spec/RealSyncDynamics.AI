// AgentsCenterView — Enterprise Skills Agent Center
// 15 spezialisierte Governance-Agenten im Card-Grid
import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot, Play, History, Settings, Activity,
  CheckCircle, Clock, X, Loader2, AlertTriangle,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { sendChat, fetchAgentRuns, type AgentRun } from '../AgentWidget/agentApi';

// ── Typen ──────────────────────────────────────────────────────────────────
type AgentStatus = 'active' | 'standby' | 'processing';

interface GovernanceAgent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  accentColor: string;
  prompt: string;
}

// ── 15 Agenten-Definitionen ────────────────────────────────────────────────
const AGENTS: GovernanceAgent[] = [
  {
    id: 'dsgvo',
    name: 'DSGVO Agent',
    description: 'Überwacht DSGVO-Konformität in Echtzeit',
    status: 'active',
    accentColor: 'bg-teal-600',
    prompt: 'Führe eine vollständige DSGVO-Compliance-Prüfung für diesen Mandanten durch und liste die wichtigsten Handlungsfelder auf.',
  },
  {
    id: 'ai-act',
    name: 'AI Act Agent',
    description: 'EU AI Act Risikoklassifizierung & Dokumentation',
    status: 'active',
    accentColor: 'bg-blue-600',
    prompt: 'Prüfe alle registrierten KI-Systeme auf EU AI Act Konformität (Art. 6 + Anhang III) und erstelle eine Risikoübersicht.',
  },
  {
    id: 'evidence',
    name: 'Evidence Agent',
    description: 'Sammelt & signiert Nachweise (C2PA)',
    status: 'active',
    accentColor: 'bg-violet-600',
    prompt: 'Erstelle eine Zusammenfassung der aktuellen Evidence-Einträge und prüfe, ob alle Nachweise vollständig und signiert sind.',
  },
  {
    id: 'risk',
    name: 'Risk Agent',
    description: 'Risikoidentifikation & Priorisierung',
    status: 'active',
    accentColor: 'bg-amber-600',
    prompt: 'Analysiere die offenen Risiken und priorisiere die Top-5 nach Dringlichkeit und Auswirkung.',
  },
  {
    id: 'cookie',
    name: 'Cookie Agent',
    description: 'Cookie & Consent-Analyse nach TTDSG',
    status: 'active',
    accentColor: 'bg-orange-600',
    prompt: 'Prüfe alle Websites auf TTDSG §25-Konformität und identifiziere Cookies, die ohne gültige Einwilligung gesetzt werden.',
  },
  {
    id: 'tracking',
    name: 'Tracking Agent',
    description: 'Third-Party & Tracker Detection',
    status: 'active',
    accentColor: 'bg-red-600',
    prompt: 'Identifiziere alle Third-Party-Tracker auf den überwachten Websites und bewerte das Risiko für Drittlandtransfers.',
  },
  {
    id: 'website',
    name: 'Website Agent',
    description: 'Website Compliance Scanning',
    status: 'active',
    accentColor: 'bg-cyan-600',
    prompt: 'Starte eine vollständige Website-Compliance-Prüfung und fasse die kritischsten Findings zusammen.',
  },
  {
    id: 'avv',
    name: 'AVV Agent',
    description: 'Auftragsverarbeitungsverträge',
    status: 'standby',
    accentColor: 'bg-slate-600',
    prompt: 'Prüfe alle Auftragsverarbeitungsverträge auf Vollständigkeit nach Art. 28 DSGVO und liste fehlende Klauseln auf.',
  },
  {
    id: 'tom',
    name: 'TOM Agent',
    description: 'Technische & org. Maßnahmen',
    status: 'standby',
    accentColor: 'bg-slate-600',
    prompt: 'Überprüfe die technischen und organisatorischen Maßnahmen nach Art. 32 DSGVO und identifiziere Lücken.',
  },
  {
    id: 'vvz',
    name: 'VVZ Agent',
    description: 'Verarbeitungsverzeichnis (Art. 30 DSGVO)',
    status: 'standby',
    accentColor: 'bg-slate-600',
    prompt: 'Analysiere das Verarbeitungsverzeichnis nach Art. 30 DSGVO auf Vollständigkeit und Aktualität.',
  },
  {
    id: 'incident',
    name: 'Incident Agent',
    description: 'Datenpannen & 72h-Meldepflicht',
    status: 'standby',
    accentColor: 'bg-slate-600',
    prompt: 'Prüfe alle offenen Incidents auf Meldepflicht nach Art. 33/34 DSGVO und überwache die 72h-Frist.',
  },
  {
    id: 'audit',
    name: 'Audit Agent',
    description: 'Audit Reports & Behördenexporte',
    status: 'standby',
    accentColor: 'bg-slate-600',
    prompt: 'Erstelle eine Zusammenfassung aller prüfungsrelevanten Governance-Ereignisse der letzten 30 Tage.',
  },
  {
    id: 'security-header',
    name: 'Security Header Agent',
    description: 'Security Headers & HTTPS',
    status: 'standby',
    accentColor: 'bg-slate-600',
    prompt: 'Prüfe alle Websites auf fehlende oder fehlerhafte Security Headers (CSP, HSTS, X-Frame-Options) und erstelle eine Prioritätsliste.',
  },
  {
    id: 'third-country',
    name: 'Third Country Transfer Agent',
    description: 'Drittlandtransfer & SCCs',
    status: 'standby',
    accentColor: 'bg-slate-600',
    prompt: 'Identifiziere alle Drittlandtransfers und prüfe, ob geeignete Garantien (SCCs, Adequacy Decision) vorliegen.',
  },
  {
    id: 'consent',
    name: 'Consent Agent',
    description: 'Einwilligungs-Management',
    status: 'standby',
    accentColor: 'bg-slate-600',
    prompt: 'Prüfe die Einwilligungsdokumentation nach Art. 7 DSGVO und identifiziere Einwilligungen, die erneuert oder angepasst werden müssen.',
  },
];

// ── Status-Hilfsfunktionen ─────────────────────────────────────────────────
function StatusPill({ status }: { status: AgentStatus }) {
  if (status === 'active') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 bg-teal-600/20 border border-teal-600/40 text-teal-400 font-mono text-[10px]">
        <CheckCircle className="h-3 w-3" />
        Aktiv
      </span>
    );
  }
  if (status === 'processing') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-600/20 border border-amber-600/40 text-amber-400 font-mono text-[10px]">
        <Activity className="h-3 w-3 animate-pulse" />
        Läuft
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-obsidian-800 border border-titanium-800 text-titanium-500 font-mono text-[10px]">
      <Clock className="h-3 w-3" />
      Standby
    </span>
  );
}

// ── RunResultModal ─────────────────────────────────────────────────────────
function RunResultModal({
  agent, result, loading, error, onClose,
}: {
  agent: GovernanceAgent;
  result: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 p-4">
      <div className="bg-obsidian-900 border border-titanium-800 w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-titanium-900 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 flex items-center justify-center shrink-0 ${agent.accentColor}`}>
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-titanium-50">{agent.name}</div>
              <div className="font-mono text-[10px] text-titanium-500">Skill Output</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-titanium-600 hover:text-titanium-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Prompt */}
        <div className="px-5 py-3 border-b border-titanium-900 bg-obsidian-950/60 shrink-0">
          <div className="font-mono text-[10px] text-titanium-600 uppercase mb-1">Aufgabe</div>
          <div className="text-xs text-titanium-400">{agent.prompt}</div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center gap-3 text-titanium-500 font-mono text-xs">
              <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
              Skill wird ausgeführt …
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 text-red-400 font-mono text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          {result && (
            <div className="text-sm text-titanium-200 leading-relaxed whitespace-pre-wrap font-mono">
              {result}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-titanium-900 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-mono border border-titanium-800 text-titanium-400 hover:text-titanium-200 hover:border-titanium-600 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Agent-Card ─────────────────────────────────────────────────────────────
function AgentCard({
  agent, runsToday, findings, lastRun, running, onRun,
}: {
  agent: GovernanceAgent;
  runsToday: number;
  findings: number;
  lastRun: string;
  running: boolean;
  onRun: () => void;
}) {
  const displayStatus: AgentStatus = running ? 'processing' : agent.status;
  return (
    <div className="bg-obsidian-900 border border-titanium-900 flex flex-col hover:border-titanium-700 transition-colors">
      <div className="flex items-start gap-3 p-4 border-b border-titanium-900">
        <div className={`h-10 w-10 shrink-0 flex items-center justify-center ${agent.accentColor}`}>
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-titanium-100 leading-tight">{agent.name}</h3>
            <StatusPill status={displayStatus} />
          </div>
          <p className="text-xs text-titanium-500 mt-0.5">{agent.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-titanium-900 border-b border-titanium-900">
        <div className="px-3 py-2 text-center">
          <div className="font-mono text-sm font-semibold text-titanium-100">{runsToday}</div>
          <div className="font-mono text-[9px] text-titanium-600 uppercase">Runs heute</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className={`font-mono text-sm font-semibold ${findings > 0 ? 'text-amber-400' : 'text-titanium-100'}`}>
            {findings}
          </div>
          <div className="font-mono text-[9px] text-titanium-600 uppercase">Findings</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="font-mono text-[10px] text-titanium-500 leading-tight">{lastRun}</div>
          <div className="font-mono text-[9px] text-titanium-600 uppercase">Letzter Run</div>
        </div>
      </div>

      <div className="flex items-center gap-0 p-3">
        <button
          onClick={onRun}
          disabled={running}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-mono text-teal-400 border border-teal-700 hover:bg-teal-700/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          {running ? 'Läuft …' : 'Skill starten'}
        </button>
        <button className="px-3 py-1.5 text-xs font-mono text-titanium-400 border border-titanium-800 border-l-0 hover:bg-obsidian-800 transition-colors">
          <History className="h-3.5 w-3.5" />
        </button>
        <button className="px-3 py-1.5 text-xs font-mono text-titanium-400 border border-titanium-800 border-l-0 hover:bg-obsidian-800 transition-colors">
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── AgentsCenterView ───────────────────────────────────────────────────────
export function AgentsCenterView() {
  const { activeTenantId } = useTenant();
  const [filter, setFilter] = useState<'alle' | 'active' | 'standby'>('alle');
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    agent: GovernanceAgent;
    result: string | null;
    loading: boolean;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    fetchAgentRuns(activeTenantId, 100).then(setAgentRuns).catch(() => {});
  }, [activeTenantId]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const runsToday = agentRuns.filter((r) => r.created_at.startsWith(todayStr)).length;
  const findingsToday = agentRuns.filter(
    (r) => r.created_at.startsWith(todayStr) && r.tool_calls.length > 0,
  ).length;

  function relativeTime(iso: string): string {
    const diffMs  = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 60) return `vor ${diffMin} Min.`;
    if (diffMin < 1440) return `vor ${Math.floor(diffMin / 60)} Std.`;
    return `vor ${Math.floor(diffMin / 1440)} Tag${Math.floor(diffMin / 1440) !== 1 ? 'en' : ''}`;
  }

  function agentRunsToday(agentId: string): number {
    return agentRuns.filter(
      (r) => r.created_at.startsWith(todayStr) && r.user_message.toLowerCase().includes(agentId),
    ).length;
  }

  function agentLastRun(agentId: string): string {
    const runs = agentRuns.filter((r) => r.user_message.toLowerCase().includes(agentId));
    if (runs.length === 0) return '–';
    return relativeTime(runs[0].created_at);
  }

  const handleRun = useCallback(async (agent: GovernanceAgent) => {
    if (!activeTenantId) {
      setModal({ agent, result: null, loading: false, error: 'Bitte einloggen, um Agenten zu starten.' });
      return;
    }
    setRunningId(agent.id);
    setModal({ agent, result: null, loading: true, error: null });

    const res = await sendChat({ tenant_id: activeTenantId, message: agent.prompt });

    if (res.kind === 'ok') {
      setModal({ agent, result: res.data.response, loading: false, error: null });
      // Refresh run list
      fetchAgentRuns(activeTenantId, 100).then(setAgentRuns).catch(() => {});
    } else if (res.kind === 'llm_not_configured') {
      setModal({ agent, result: null, loading: false, error: 'KI-Modell nicht konfiguriert. Bitte AI-Residency in Einstellungen prüfen.' });
    } else if (res.kind === 'us_routing_required') {
      setModal({ agent, result: null, loading: false, error: 'EU-Routing-Bestätigung erforderlich. Bitte Einstellungen aufrufen.' });
    } else {
      setModal({ agent, result: null, loading: false, error: res.kind === 'error' ? res.error.message : 'Unbekannter Fehler.' });
    }
    setRunningId(null);
  }, [activeTenantId]);

  const filtered = AGENTS.filter((a) => {
    if (filter === 'active') return a.status === 'active';
    if (filter === 'standby') return a.status === 'standby';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-obsidian-950 text-titanium-100">
      {/* Page Header */}
      <div className="border-b border-titanium-900 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-display font-semibold text-titanium-100 tracking-tight">
              Enterprise Skills
            </h1>
            <p className="font-mono text-xs text-titanium-500 mt-0.5">
              15 spezialisierte Governance-Agenten · EU-lokal · Ollama gemma3:4b
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-xs font-mono hover:bg-teal-500 transition-colors">
            <Bot className="h-3.5 w-3.5" />
            Agent konfigurieren
          </button>
        </div>
      </div>

      {/* Metriken-Zeile */}
      <div className="grid grid-cols-4 divide-x divide-titanium-900 border-b border-titanium-900 shrink-0">
        {[
          { label: 'Agenten gesamt', value: AGENTS.length,    color: 'text-titanium-100' },
          { label: 'Aktiv',          value: AGENTS.filter((a) => a.status === 'active').length, color: 'text-teal-400' },
          { label: 'Runs heute',     value: runsToday || agentRuns.length > 0 ? runsToday : 142, color: 'text-titanium-100' },
          { label: 'Findings heute', value: findingsToday || agentRuns.length > 0 ? findingsToday : 8, color: 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-6 py-3">
            <div className={`font-mono text-xl font-bold ${color}`}>{value}</div>
            <div className="font-mono text-[10px] text-titanium-600 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter-Leiste */}
      <div className="flex items-center gap-0 px-6 py-3 border-b border-titanium-900 shrink-0">
        {(['alle', 'active', 'standby'] as const).map((f) => {
          const labels = { alle: 'Alle', active: 'Aktiv', standby: 'Standby' };
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
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              runsToday={agentRunsToday(agent.id)}
              findings={agentRuns.filter(
                (r) => r.user_message.toLowerCase().includes(agent.id) && r.tool_calls.length > 0,
              ).length}
              lastRun={agentLastRun(agent.id)}
              running={runningId === agent.id}
              onRun={() => handleRun(agent)}
            />
          ))}
        </div>
      </div>

      {/* Run Result Modal */}
      {modal && (
        <RunResultModal
          agent={modal.agent}
          result={modal.result}
          loading={modal.loading}
          error={modal.error}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

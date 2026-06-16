// AgentsCenterView — Enterprise Skills Agent Center
// 15 spezialisierte Governance-Agenten im Card-Grid
import React, { useState } from 'react';
import {
  Bot,
  Play,
  History,
  Settings,
  Activity,
  CheckCircle,
  Clock,
} from 'lucide-react';

// ── Typen ──────────────────────────────────────────────────────────────────
type AgentStatus = 'active' | 'standby' | 'processing';

interface GovernanceAgent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  lastRun: string;
  runsToday: number;
  findings: number;
  accentColor: string;
}

// ── 15 Agenten-Definitionen ────────────────────────────────────────────────
const AGENTS: GovernanceAgent[] = [
  {
    id: 'dsgvo',
    name: 'DSGVO Agent',
    description: 'Überwacht DSGVO-Konformität in Echtzeit',
    status: 'active',
    lastRun: 'Heute 09:32',
    runsToday: 24,
    findings: 3,
    accentColor: 'bg-teal-600',
  },
  {
    id: 'ai-act',
    name: 'AI Act Agent',
    description: 'EU AI Act Risikoklassifizierung & Dokumentation',
    status: 'active',
    lastRun: 'Heute 08:15',
    runsToday: 12,
    findings: 1,
    accentColor: 'bg-blue-600',
  },
  {
    id: 'evidence',
    name: 'Evidence Agent',
    description: 'Sammelt & signiert Nachweise (C2PA)',
    status: 'active',
    lastRun: 'Heute 10:01',
    runsToday: 31,
    findings: 0,
    accentColor: 'bg-violet-600',
  },
  {
    id: 'risk',
    name: 'Risk Agent',
    description: 'Risikoidentifikation & Priorisierung',
    status: 'active',
    lastRun: 'Heute 07:48',
    runsToday: 18,
    findings: 2,
    accentColor: 'bg-amber-600',
  },
  {
    id: 'cookie',
    name: 'Cookie Agent',
    description: 'Cookie & Consent-Analyse nach TTDSG',
    status: 'active',
    lastRun: 'Heute 09:14',
    runsToday: 22,
    findings: 2,
    accentColor: 'bg-orange-600',
  },
  {
    id: 'tracking',
    name: 'Tracking Agent',
    description: 'Third-Party & Tracker Detection',
    status: 'active',
    lastRun: 'Heute 09:14',
    runsToday: 19,
    findings: 0,
    accentColor: 'bg-red-600',
  },
  {
    id: 'website',
    name: 'Website Agent',
    description: 'Website Compliance Scanning',
    status: 'active',
    lastRun: 'Heute 08:55',
    runsToday: 16,
    findings: 0,
    accentColor: 'bg-cyan-600',
  },
  {
    id: 'avv',
    name: 'AVV Agent',
    description: 'Auftragsverarbeitungsverträge',
    status: 'standby',
    lastRun: 'Gestern 16:30',
    runsToday: 0,
    findings: 0,
    accentColor: 'bg-slate-600',
  },
  {
    id: 'tom',
    name: 'TOM Agent',
    description: 'Technische & org. Maßnahmen',
    status: 'standby',
    lastRun: '12.06. 11:00',
    runsToday: 0,
    findings: 0,
    accentColor: 'bg-slate-600',
  },
  {
    id: 'vvz',
    name: 'VVZ Agent',
    description: 'Verarbeitungsverzeichnis (Art. 30 DSGVO)',
    status: 'standby',
    lastRun: '11.06. 14:22',
    runsToday: 0,
    findings: 0,
    accentColor: 'bg-slate-600',
  },
  {
    id: 'incident',
    name: 'Incident Agent',
    description: 'Datenpannen & 72h-Meldepflicht',
    status: 'standby',
    lastRun: '10.06. 08:00',
    runsToday: 0,
    findings: 0,
    accentColor: 'bg-slate-600',
  },
  {
    id: 'audit',
    name: 'Audit Agent',
    description: 'Audit Reports & Behördenexporte',
    status: 'standby',
    lastRun: '09.06. 17:45',
    runsToday: 0,
    findings: 0,
    accentColor: 'bg-slate-600',
  },
  {
    id: 'security-header',
    name: 'Security Header Agent',
    description: 'Security Headers & HTTPS',
    status: 'standby',
    lastRun: '08.06. 12:10',
    runsToday: 0,
    findings: 0,
    accentColor: 'bg-slate-600',
  },
  {
    id: 'third-country',
    name: 'Third Country Transfer Agent',
    description: 'Drittlandtransfer & SCCs',
    status: 'standby',
    lastRun: '07.06. 09:30',
    runsToday: 0,
    findings: 0,
    accentColor: 'bg-slate-600',
  },
  {
    id: 'consent',
    name: 'Consent Agent',
    description: 'Einwilligungs-Management',
    status: 'standby',
    lastRun: '06.06. 15:00',
    runsToday: 0,
    findings: 0,
    accentColor: 'bg-slate-600',
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
        <Activity className="h-3 w-3" />
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

// ── Agent-Card ─────────────────────────────────────────────────────────────
function AgentCard({ agent }: { agent: GovernanceAgent }) {
  return (
    <div className="bg-obsidian-900 border border-titanium-900 flex flex-col hover:border-titanium-700 transition-colors">
      {/* Card Header */}
      <div className="flex items-start gap-3 p-4 border-b border-titanium-900">
        <div className={`h-10 w-10 shrink-0 flex items-center justify-center ${agent.accentColor}`}>
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

      {/* Metriken */}
      <div className="grid grid-cols-3 divide-x divide-titanium-900 border-b border-titanium-900">
        <div className="px-3 py-2 text-center">
          <div className="font-mono text-sm font-semibold text-titanium-100">{agent.runsToday}</div>
          <div className="font-mono text-[9px] text-titanium-600 uppercase">Runs heute</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className={`font-mono text-sm font-semibold ${agent.findings > 0 ? 'text-amber-400' : 'text-titanium-100'}`}>
            {agent.findings}
          </div>
          <div className="font-mono text-[9px] text-titanium-600 uppercase">Findings</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="font-mono text-[10px] text-titanium-500 leading-tight">{agent.lastRun}</div>
          <div className="font-mono text-[9px] text-titanium-600 uppercase">Letzter Run</div>
        </div>
      </div>

      {/* Aktionen */}
      <div className="flex items-center gap-0 p-3">
        <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-mono text-teal-400 border border-teal-700 hover:bg-teal-700/20 transition-colors">
          <Play className="h-3 w-3" />
          Skill starten
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
  const [filter, setFilter] = useState<'alle' | 'active' | 'standby'>('alle');

  const totalAgents = AGENTS.length;
  const activeCount = AGENTS.filter((a) => a.status === 'active').length;
  const runsToday = AGENTS.reduce((sum, a) => sum + a.runsToday, 0);
  const findingsToday = AGENTS.reduce((sum, a) => sum + a.findings, 0);

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
          { label: 'Agenten gesamt', value: totalAgents, color: 'text-titanium-100' },
          { label: 'Aktiv', value: activeCount, color: 'text-teal-400' },
          { label: 'Runs heute', value: runsToday, color: 'text-titanium-100' },
          { label: 'Findings heute', value: findingsToday, color: 'text-amber-400' },
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
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Cpu, ShieldCheck, ScrollText, Bot } from 'lucide-react';

// AgentControlPlanePreview — kompakte 4-Karten-Vorschau für die vier
// Governance-Agenten. Demo-Daten, kein echter Live-Stream — das Pulse-
// Cycling ist visuelle UI-Animation, nicht Indikator für laufende Telemetrie.

interface Agent {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  /** 'demo' = simulierte Werte (Phase 1 Demo-Surface).
   *  'live' bleibt reserviert für eine echte Tenant-Telemetrie-PR. */
  status: 'demo' | 'live' | 'idle';
  metric: string;
  delta: string;
}

const AGENTS: readonly Agent[] = [
  {
    id: 'drift',
    name: 'drift-agent',
    role: 'erkennen · monitoring',
    icon: <Activity className="h-3.5 w-3.5 text-cyan-300" />,
    status: 'demo',
    metric: '4.2 Läufe/h',
    delta: '12 offene Vorfälle',
  },
  {
    id: 'ai-risk',
    name: 'ai-risk-agent',
    role: 'governance',
    icon: <Cpu className="h-3.5 w-3.5 text-violet-300" />,
    status: 'demo',
    metric: '17 Systeme',
    delta: '3 hohes Risiko',
  },
  {
    id: 'evidence',
    name: 'evidence-agent',
    role: 'automatisieren',
    icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />,
    status: 'demo',
    metric: '4.128 gehasht',
    delta: 'letzter Anchor: 3 s',
  },
  {
    id: 'policy',
    name: 'policy-agent',
    role: 'governance · automatisieren',
    icon: <ScrollText className="h-3.5 w-3.5 text-amber-300" />,
    status: 'demo',
    metric: '21 Entwürfe/W',
    delta: '15 zusammengeführt',
  },
];

export function AgentControlPlanePreview({ heading = true }: { heading?: boolean }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % AGENTS.length), 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-obsidian-950 border border-titanium-900">
      {heading && (
        <header className="flex items-center justify-between px-3 py-2 border-b border-titanium-900 bg-obsidian-900 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
          <span className="inline-flex items-center gap-2">
            <Bot className="h-3 w-3" />
            Agent-Kontrollebene · Demo
          </span>
          <span className="text-titanium-400">
            {AGENTS.filter((a) => a.status === 'demo' || a.status === 'live').length} / {AGENTS.length} aktiv
          </span>
        </header>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-titanium-900">
        {AGENTS.map((a, i) => (
          <article key={a.id} className="bg-obsidian-950 p-4 flex flex-col gap-2 min-h-[120px]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex w-6 h-6 items-center justify-center bg-obsidian-900 border border-titanium-800 shrink-0">
                  {a.icon}
                </span>
                <div className="min-w-0">
                  <div className="font-mono text-[12px] text-titanium-50 truncate">{a.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 truncate">
                    {a.role}
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-amber-300 shrink-0">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span
                    className={`absolute inset-0 rounded-full bg-amber-400 opacity-75 ${phase === i ? 'motion-safe:animate-ping' : ''}`}
                  />
                  <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                </span>
                demo
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-titanium-900/60">
              <span className="font-display font-semibold text-base text-titanium-50">{a.metric}</span>
              <span className="font-mono text-[10px] text-titanium-500">{a.delta}</span>
            </div>
          </article>
        ))}
      </div>

      <footer className="px-3 py-2 border-t border-titanium-900 bg-obsidian-900 flex items-center justify-between font-mono text-[10px] text-titanium-500">
        <span>kontinuierlich · ohne manuelles Triage-Backlog · Demo-Daten</span>
        <Link to="/agents" className="text-cyan-300 hover:text-cyan-200 uppercase tracking-wider">
          Agenten ansehen →
        </Link>
      </footer>
    </div>
  );
}

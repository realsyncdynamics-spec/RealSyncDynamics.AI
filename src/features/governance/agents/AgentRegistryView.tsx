import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Bot } from 'lucide-react';
import { AGENT_CATALOG, agentAnchor, countByMaturity } from './agentCatalog';
import { AgentCard } from './AgentCard';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { STATUS_LABEL, type ImplementationStatus } from '../../../product/implementation-status';

/**
 * /app/ai-systems/agents — Einzige Agent-/Bot-Register-Oberfläche (WP12).
 *
 * Auth-gated: das Register ist eine Workspace-Sicht, keine öffentliche Seite.
 * `/app/agents` (Ausführungen) und `/app/bots` (Bots) werden hier als Tabs
 * verlinkt und nicht dupliziert.
 *
 * Quelle ist der Katalog `AGENT_CATALOG` (agentCatalog.ts). Er beschreibt,
 * welche Agenten- und Bot-Typen das Governance OS als kontrollierte Objekte
 * führt — kein Mandanten-Bestand. Der Reifegrad kommt aus AGENT_MESH bzw.
 * implementation-status.ts; der View stuft nichts hoch.
 */
export function AgentRegistryView() {
  return <AuthGate>{() => <AgentRegistryInner />}</AuthGate>;
}

export const AGENT_SURFACE_TABS = [
  { id: 'register', label: 'Register', to: '/app/ai-systems/agents', active: true },
  { id: 'runs', label: 'Ausführungen', to: '/app/agents', active: false },
  { id: 'bots', label: 'Bots', to: '/app/bots', active: false },
] as const;

type Filter = ImplementationStatus | 'all';

const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'live', label: STATUS_LABEL.live },
  { id: 'preview', label: STATUS_LABEL.preview },
  { id: 'coming-soon', label: STATUS_LABEL['coming-soon'] },
];

export function AgentRegistryInner() {
  const [filter, setFilter] = useState<Filter>('all');
  const { hash, key: navigationKey } = useLocation();

  // Sprung aus der Seitenleiste (#agent-<id>): Filter zurücksetzen, damit die
  // Karte sichtbar ist, und dorthin scrollen. Der Router scrollt nicht selbst.
  // `navigationKey` statt nur `hash`: Ein erneuter Klick auf denselben Eintrag
  // (gleicher Anker, inzwischen weggefiltert) muss die Karte wieder zeigen.
  useEffect(() => {
    if (!hash.startsWith('#agent-')) return;
    setFilter('all');
    const frame = requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, navigationKey]);

  const agents = AGENT_CATALOG;
  const filtered = useMemo(
    () => (filter === 'all' ? agents : agents.filter((a) => a.maturity === filter)),
    [agents, filter],
  );
  const counts = useMemo(() => countByMaturity(agents), [agents]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/dashboard" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-600">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">
                Agenten- &amp; Bot-Register
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                Erfassen · Klassifizieren (AI Act) · Freigeben · Ausführen · Nachweisen
              </p>
            </div>
          </div>
        </div>
      </header>

      <nav
        aria-label="Agenten-Bereiche"
        className="border-b border-titanium-900 bg-obsidian-900/60 px-4"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-1" role="tablist">
          {AGENT_SURFACE_TABS.map((tab) => (
            <Link
              key={tab.id}
              to={tab.to}
              role="tab"
              aria-selected={tab.active}
              aria-current={tab.active ? 'page' : undefined}
              className={`border-b-2 px-4 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                tab.active
                  ? 'border-ai-cyan-500 text-ai-cyan-100'
                  : 'border-transparent text-titanium-400 hover:border-titanium-700 hover:text-titanium-100'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm text-titanium-50">
                Einzige Register-Oberfläche für Agenten und Bots im Governance OS: was sie dürfen, was sie nie
                dürfen, wann ein Mensch freigibt und welche Nachweise entstehen.
              </p>
              <p className="mt-1 text-[12px] text-titanium-300">
                Das ist kein Bestand Ihres Mandanten. Der Reifegrad je Eintrag stammt aus dem belegten
                Implementierungsstatus. Ausführungen und Konversations-Bots sind oben als Tabs verlinkt.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Einträge im Katalog" value={agents.length} />
          <Stat label={STATUS_LABEL.live} value={counts.live} tone="emerald" />
          <Stat label={STATUS_LABEL.preview} value={counts.preview} tone="sky" />
          <Stat label={STATUS_LABEL['coming-soon']} value={counts['coming-soon']} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <FilterButton key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </FilterButton>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="border border-titanium-800 bg-obsidian-900 p-6 text-center text-sm text-titanium-400">
              Keine Einträge in dieser Ansicht.
            </p>
          ) : (
            filtered.map((agent) => (
              <AgentCard key={agent.id} agent={agent} highlighted={hash === `#${agentAnchor(agent.id)}`} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'sky' | 'emerald' }) {
  const toneCls =
    tone === 'sky'     ? 'text-sky-300'      :
    tone === 'emerald' ? 'text-emerald-300'  :
    'text-titanium-50';
  return (
    <div className="border border-titanium-800 bg-obsidian-900 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold tracking-tight ${toneCls}`}>{value}</p>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${
        active
          ? 'border-ai-cyan-500/60 bg-ai-cyan-900/20 text-ai-cyan-100'
          : 'border-titanium-800 bg-obsidian-900 text-titanium-300 hover:border-titanium-600 hover:text-titanium-100'
      }`}
    >
      {children}
    </button>
  );
}

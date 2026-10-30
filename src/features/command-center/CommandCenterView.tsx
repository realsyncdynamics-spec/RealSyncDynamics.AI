import { useMemo, useState } from 'react';
import { AlertTriangle, Bot, Menu, Search, X } from 'lucide-react';
import {
  distinct, EMPTY_FILTER, UNSET, filterAgents, STATUS_LABEL,
  type AgentFilter, type AgentStatus, type RegistryAgent,
  SECTION_LABEL, sectionOf, type AgentSection,
} from './agentRegistry';
import { useAgentRegistry } from './useAgentRegistry';
import { DecisionInbox } from './DecisionInbox';
import { AgentConfigPanel } from './AgentConfigPanel';

const NAV = [
  'Übersicht', 'Alle Agenten', 'Offene Fragen', 'Aufgaben', 'Projekte', 'Agenten-Kommunikation',
  'Details Manager', 'Bibliothek Manager', 'Computer Manager', 'Routinen', 'Gedächtnis',
  'Kosten & Monitoring', 'Einstellungen',
] as const;
const NAV_ENABLED = new Set<string>(['Übersicht', 'Alle Agenten']);

function NavList() {
  return (
    <ul className="space-y-0.5 text-sm">
      {NAV.map((n) => (
        <li key={n}>
          <span aria-disabled={!NAV_ENABLED.has(n)}
            className={`block rounded px-2 py-1.5 ${NAV_ENABLED.has(n) ? 'text-zinc-100' : 'cursor-not-allowed text-zinc-500'}`}
            title={NAV_ENABLED.has(n) ? undefined : 'Folgt in späterem Meilenstein'}>
            {n}
          </span>
        </li>
      ))}
    </ul>
  );
}

const STATUS_CLASS: Record<AgentStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-300',
  working: 'bg-sky-500/15 text-sky-300',
  waiting: 'bg-amber-500/15 text-amber-300',
  blocked: 'bg-orange-500/15 text-orange-300',
  error: 'bg-red-500/15 text-red-300',
  offline: 'bg-zinc-500/15 text-zinc-300',
  unknown: 'bg-zinc-700/40 text-zinc-400',
};

const SOURCE_LABEL: Record<RegistryAgent['source'], string> = {
  autonomous_agents: 'Supabase · autonomous_agents',
  agent_profiles: 'Supabase · agent_profiles (Katalog)',
  runtime_static: 'Code · apps/agent-runtime (statisch)',
  grok_soll: 'Soll-Konfiguration · kein Live-Status',
};

function AgentCard({ a, onConfig }: { a: RegistryAgent; onConfig: () => void }) {
  return (
    <article data-testid="agent-card" className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-zinc-400" aria-hidden />
          <h2 className="font-semibold text-zinc-100">{a.name}</h2>
        </div>
        <span data-testid="agent-status" className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[a.status]}`}>
          {STATUS_LABEL[a.status]}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-400">{a.description ?? 'Zuständigkeit nicht hinterlegt'}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-400">
        <dt>Letzte Aktivität</dt><dd className="text-zinc-300">{a.lastActivityAt ? new Date(a.lastActivityAt).toLocaleString('de-DE') : 'UNBEKANNT'}</dd>
        <dt>Laufender Auftrag</dt><dd className="text-zinc-300">{a.currentTask ?? 'UNBEKANNT'}</dd>
        <dt>Offene Fragen</dt><dd className="text-zinc-300">{a.openDecisions ?? 'UNBEKANNT (ab M2)'}</dd>
        <dt>Quelle</dt><dd className="text-zinc-300">{SOURCE_LABEL[a.source]}</dd>
        {a.mappedBotIds && a.mappedBotIds.length > 1 && (
          <><dt>Zugeordnete Bots</dt><dd className="text-zinc-300">{a.mappedBotIds.length} (Sammelkarte)</dd></>
        )}
      </dl>
      {a.lastError && (
        <p className="mt-2 flex items-center gap-1 text-xs text-red-300"><AlertTriangle className="h-3 w-3" aria-hidden />{a.lastError}</p>
      )}
      <button type="button" onClick={onConfig} className="mt-3 text-xs text-sky-300 underline">
        Details · Bibliothek · Computer
      </button>
    </article>
  );
}

function Select({ label, value, options, onChange, allowUnset }: { label: string; value: string; options: string[]; onChange: (v: string) => void; allowUnset?: boolean }) {
  return (
    <label className="flex flex-col text-xs text-zinc-400">
      {label}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100">
        <option value="all">Alle</option>
        {allowUnset && <option value={UNSET}>Nicht gesetzt</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export function CommandCenterView() {
  const { agents, loading, sourceError } = useAgentRegistry();
  const [f, setF] = useState<AgentFilter>(EMPTY_FILTER);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [configFor, setConfigFor] = useState<RegistryAgent | null>(null);
  const shown = useMemo(() => filterAgents(agents, f), [agents, f]);
  const set = (patch: Partial<AgentFilter>) => setF((prev) => ({ ...prev, ...patch }));

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <nav aria-label="Command Center" className="hidden w-56 shrink-0 border-r border-zinc-800 p-3 md:block">
        <p className="mb-3 px-2 text-sm font-semibold">Agent Command Center</p>
        <NavList />
      </nav>

      <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <div className="mb-3 md:hidden">
          <button type="button" aria-expanded={mobileNavOpen} aria-controls="cc-mobile-nav"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-1.5 text-sm">
            {mobileNavOpen ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
            Navigation
          </button>
          {mobileNavOpen && (
            <nav id="cc-mobile-nav" aria-label="Command Center (mobil)" className="mt-2 rounded-md border border-zinc-800 p-2">
              <NavList />
            </nav>
          )}
        </div>
        <h1 className="text-xl font-semibold">Agentenübersicht</h1>
        <p className="mt-1 text-sm text-zinc-400">Status nur aus belegten Quellen. Nicht belegte Zustände werden als UNBEKANNT angezeigt.</p>
        {sourceError && (
          <p role="status" className="mt-3 rounded-md border border-amber-700/50 bg-amber-900/20 p-2 text-sm text-amber-200">
            Datenquelle eingeschränkt: {sourceError}. Angezeigt werden nur Code- und Soll-Quellen.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col text-xs text-zinc-400">
            Suche
            <span className="relative mt-1">
              <Search className="absolute left-2 top-2 h-4 w-4 text-zinc-500" aria-hidden />
              <input aria-label="Agenten suchen" value={f.query} onChange={(e) => set({ query: e.target.value })}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 py-1 pl-8 pr-2 text-sm text-zinc-100" />
            </span>
          </label>
          <Select label="Typ" value={f.type} options={distinct(agents, 'agentType')} onChange={(v) => set({ type: v })} />
          <Select label="Projekt" value={f.project} options={distinct(agents, 'project')} onChange={(v) => set({ project: v })} allowUnset />
          <Select label="Priorität" value={f.priority} options={distinct(agents, 'priority')} onChange={(v) => set({ priority: v })} allowUnset />
          <label className="flex flex-col text-xs text-zinc-400">
            Betriebsstatus
            <select aria-label="Betriebsstatus" value={f.status} onChange={(e) => set({ status: e.target.value as AgentFilter['status'] })}
              className="mt-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100">
              <option value="all">Alle</option>
              {(Object.keys(STATUS_LABEL) as AgentStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={f.onlyOpenDecisions} onChange={(e) => set({ onlyOpenDecisions: e.target.checked })} />
            Nur mit offenen Entscheidungen
          </label>
        </div>
        <p className="mt-3 text-xs text-zinc-500">{loading ? 'Lade …' : `${shown.length} von ${agents.length} Agenten`}</p>
        {(Object.keys(SECTION_LABEL) as AgentSection[]).map((sec) => {
          const list = shown.filter((a) => sectionOf(a) === sec);
          if (list.length === 0) return null;
          return (
            <section key={sec} aria-label={SECTION_LABEL[sec]} className="mt-4">
              <h2 className="text-sm font-semibold text-zinc-300">{SECTION_LABEL[sec]} ({list.length})</h2>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((a) => <AgentCard key={a.registryId} a={a} onConfig={() => setConfigFor(a)} />)}
              </div>
            </section>
          );
        })}
        {configFor && (
          <AgentConfigPanel key={configFor.registryId} agentRef={configFor.registryId} agentName={configFor.name} onClose={() => setConfigFor(null)} />
        )}
      </main>

      <DecisionInbox />
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Bot } from 'lucide-react';
import { AgentCard } from './AgentCard';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { useTenant } from '../../../core/access/TenantProvider';
import { loadAgents } from './agentsApi';
import type { AgentStatus, GovernanceAgent } from './types';

/**
 * /governance/agents (+ /app/ai-systems) — Agent-Register.
 *
 * Auth-gated: das Register ist eine Workspace-Sicht, keine oeffentliche
 * Seite — ohne Session erscheint der AuthGate, nicht das Demo-Set.
 *
 * Lädt das Register pro Tenant aus public.governance_agents. Existiert noch
 * keines, legt der API-Layer das Default-Set einmalig an (seed-on-read) —
 * danach ist es echte, pro Arbeitsbereich gespeicherte Konfiguration.
 */
export function AgentRegistryView() {
  return <AuthGate>{() => <AgentRegistryInner />}</AuthGate>;
}

function AgentRegistryInner() {
  const { activeTenantId } = useTenant();
  const [filter, setFilter] = useState<AgentStatus | 'all'>('all');
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

  const filtered = useMemo(() => {
    if (filter === 'all') return agents;
    return agents.filter((a) => a.status === filter);
  }, [agents, filter]);

  const counts = useMemo(() => ({
    total:           agents.length,
    active:          agents.filter((a) => a.status === 'active').length,
    review_required: agents.filter((a) => a.status === 'review_required').length,
    paused:          agents.filter((a) => a.status === 'paused').length,
  }), [agents]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-600">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">
                Agenten-Register
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                Kontrollierte Governance-Agenten · Human Review verbindlich
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm text-titanium-50">
                Diese Liste ist die kontrollierte Sicht auf alle Governance-Agenten — was sie
                duerfen, was sie nicht duerfen, und wann Human Review zwingend ist.
              </p>
              <p className="mt-1 text-[12px] text-titanium-300">
                Pro Arbeitsbereich gespeichert. Die Runtime-Ausfuehrung (n8n / Edge-Functions)
                liest dieselbe Datenstruktur und ist an die hier definierten Restriktionen
                gebunden.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Agenten insgesamt" value={counts.total} />
          <Stat label="Aktiv" value={counts.active} tone="emerald" />
          <Stat label="Review erforderlich" value={counts.review_required} tone="amber" />
          <Stat label="Pausiert" value={counts.paused} tone="sky" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Alle</FilterButton>
          <FilterButton active={filter === 'active'} onClick={() => setFilter('active')}>Aktiv</FilterButton>
          <FilterButton active={filter === 'review_required'} onClick={() => setFilter('review_required')}>
            Review erforderlich
          </FilterButton>
          <FilterButton active={filter === 'paused'} onClick={() => setFilter('paused')}>Pausiert</FilterButton>
          <FilterButton active={filter === 'disabled'} onClick={() => setFilter('disabled')}>Deaktiviert</FilterButton>
        </div>

        <div className="space-y-3">
          {loading ? (
            <p className="border border-titanium-800 bg-obsidian-900 p-6 text-center text-sm text-titanium-400">
              Wird geladen …
            </p>
          ) : error ? (
            <p className="border border-red-900/50 bg-red-950/20 p-6 text-center text-sm text-red-300">
              {error}
            </p>
          ) : filtered.length === 0 ? (
            <p className="border border-titanium-800 bg-obsidian-900 p-6 text-center text-sm text-titanium-400">
              {agents.length === 0 ? 'Noch keine Agenten registriert.' : 'Keine Agenten in dieser Ansicht.'}
            </p>
          ) : (
            filtered.map((agent) => <AgentCard key={agent.id} agent={agent} />)
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'sky' | 'emerald' }) {
  const toneCls =
    tone === 'amber'   ? 'text-amber-300'    :
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

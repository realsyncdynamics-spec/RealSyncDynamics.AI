import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Database } from 'lucide-react';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../../../lib/hoc';
import { DEMO_VVT_ENTRIES, DEMO_RUNTIME_EVENTS } from './demoRuntimeVvtData';
import { RuntimeVvtEntryCard } from './RuntimeVvtEntryCard';
import { RuntimeVvtExportButton } from './RuntimeVvtExportButton';
import type { RuntimeVvtEntry, VvtReviewStatus } from './types';

/**
 * /governance/vvt — Runtime-VVT-View.
 *
 * Phase A: rendert ausschliesslich Demo-Daten (DEMO_VVT_ENTRIES). Sobald
 * tenantId und Backend-Tabelle existieren, wird `entries` aus Supabase
 * geladen und die Demo-Daten fallen weg.
 */
function _RuntimeVvtView() {
  const [filter, setFilter] = useState<VvtReviewStatus | 'all'>('all');

  const entries: RuntimeVvtEntry[] = DEMO_VVT_ENTRIES;
  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => e.reviewStatus === filter);
  }, [entries, filter]);

  const counts = useMemo(() => ({
    total:           entries.length,
    review_required: entries.filter((e) => e.reviewStatus === 'review_required').length,
    approved:        entries.filter((e) => e.reviewStatus === 'approved').length,
    high_or_critical:entries.filter((e) => e.riskLevel === 'high' || e.riskLevel === 'critical').length,
  }), [entries]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-600">
              <Database className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">
                Technisch generierter VVT-Entwurf
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                Aus Runtime-Ereignissen abgeleitet · Review erforderlich
              </p>
            </div>
          </div>
        </div>
        <RuntimeVvtExportButton
          entries={filtered}
          context={{
            scope: filter,
            generated_from_event_count: DEMO_RUNTIME_EVENTS.length,
            demo_data: true,
          }}
        />
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm text-titanium-50">
                Dieser VVT-Entwurf wurde technisch aus Runtime-Ereignissen abgeleitet.
              </p>
              <p className="mt-1 text-[12px] text-titanium-300">
                Er ist <strong>kein</strong> finales Verfahrensverzeichnis und ersetzt keine Rechtsberatung.
                Jeder Eintrag braucht eine Freigabe durch eine fachkundige Person (z. B. DSB).
                Hinweise zu Rechtsgrundlage und KI-Relevanz sind heuristisch, keine Rechtsaussagen.
              </p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                demo runtime · simulated events · not live customer data
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Verfahren insgesamt" value={counts.total} />
          <Stat label="Review erforderlich" value={counts.review_required} tone="amber" />
          <Stat label="High/Critical-Risiko" value={counts.high_or_critical} tone="rose" />
          <Stat label="Freigegeben" value={counts.approved} tone="emerald" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Alle</FilterButton>
          <FilterButton active={filter === 'review_required'} onClick={() => setFilter('review_required')}>
            Review erforderlich
          </FilterButton>
          <FilterButton active={filter === 'approved'} onClick={() => setFilter('approved')}>Freigegeben</FilterButton>
          <FilterButton active={filter === 'draft'} onClick={() => setFilter('draft')}>Entwurf</FilterButton>
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="border border-titanium-800 bg-obsidian-900 p-6 text-center text-sm text-titanium-400">
              Keine Verfahren in dieser Ansicht.
            </p>
          ) : (
            filtered.map((entry) => <RuntimeVvtEntryCard key={entry.id} entry={entry} />)
          )}
        </div>
      </main>
    </div>
  );
}

export const RuntimeVvtView = withPerformanceMonitoring(
  _RuntimeVvtView,
  'RuntimeVvtView',
  { threshold: 500, maxRenders: 10 }
);

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'rose' | 'emerald' }) {
  const toneCls =
    tone === 'amber'   ? 'text-amber-300'    :
    tone === 'rose'    ? 'text-rose-300'     :
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

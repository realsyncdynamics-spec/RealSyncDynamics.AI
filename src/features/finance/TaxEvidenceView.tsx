import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderOpen, ChevronRight } from 'lucide-react';
import { FinanceShell, useFinanceTenant } from './FinanceShell';
import { Loader } from './FinanceDashboard';
import {
  listTaxYears, createTaxYear, listTaxDocuments,
} from './api';
import {
  SOURCE_TYPE_ORDER, SOURCE_TYPE_LABELS, type TaxYear, type TaxDocument,
} from './types';

export function TaxEvidenceView() {
  return (
    <FinanceShell title="Jahresordner" subtitle="Belegsammlung nach Geschäftsjahr">
      <Inner />
    </FinanceShell>
  );
}

function Inner() {
  const { activeTenantId } = useFinanceTenant();
  const [years, setYears] = useState<TaxYear[] | null>(null);
  const [docs, setDocs] = useState<TaxDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = () => {
    if (!activeTenantId) return;
    setError(null);
    Promise.all([
      listTaxYears(activeTenantId),
      listTaxDocuments(activeTenantId, { limit: 1000 }),
    ])
      .then(([y, d]) => { setYears(y); setDocs(d); })
      .catch((err: Error) => setError(err.message));
  };
  useEffect(reload, [activeTenantId]);

  async function newYear() {
    if (!activeTenantId) return;
    setCreating(true);
    try {
      const max = years && years.length > 0 ? years[0].year : new Date().getFullYear() - 1;
      await createTaxYear(activeTenantId, max + 1);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen');
    } finally {
      setCreating(false);
    }
  }

  if (!activeTenantId) return <p className="text-sm text-titanium-400">Tenant fehlt.</p>;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (years === null) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-titanium-400">{years.length} Jahresordner</p>
        <button
          onClick={newYear}
          disabled={creating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Neues Jahr
        </button>
      </div>

      {years.length === 0 ? (
        <p className="text-sm text-titanium-400 bg-obsidian-900 border border-titanium-900 p-6 text-center">
          Noch keine Jahresordner angelegt.
        </p>
      ) : (
        <ul className="grid md:grid-cols-2 gap-3">
          {years.map((y) => {
            const yearDocs = docs.filter((d) => d.tax_year_id === y.id);
            const bySource = new Map<string, number>();
            for (const d of yearDocs) {
              bySource.set(d.source_type, (bySource.get(d.source_type) ?? 0) + 1);
            }
            return (
              <li key={y.id}>
                <Link
                  to={`/finance/year/${y.year}`}
                  className="block bg-obsidian-900 border border-titanium-900 hover:border-emerald-700 transition-colors p-4"
                >
                  <header className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-emerald-400" />
                      <span className="font-display font-bold text-lg text-titanium-50">{y.year}</span>
                      <span className="text-[10px] uppercase tracking-wider text-titanium-500">
                        {y.status}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-titanium-500" />
                  </header>
                  <p className="text-xs text-titanium-400 mb-2">{yearDocs.length} Dokumente</p>
                  <ul className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {SOURCE_TYPE_ORDER.map((s) => (
                      <li key={s} className="flex justify-between gap-2 text-titanium-400">
                        <span>{SOURCE_TYPE_LABELS[s]}</span>
                        <span className="font-mono text-titanium-300">{bySource.get(s) ?? 0}</span>
                      </li>
                    ))}
                  </ul>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

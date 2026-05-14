import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Package, AlertTriangle, Clock } from 'lucide-react';
import { FinanceShell, useFinanceTenant } from './FinanceShell';
import { Loader } from './FinanceDashboard';
import {
  listTaxYears, listTaxDocuments, createExport,
} from './api';
import {
  SOURCE_TYPE_ORDER, SOURCE_TYPE_LABELS,
  type TaxYear, type TaxDocument, type TaxSourceType,
} from './types';

export function TaxYearView() {
  return (
    <FinanceShell title="Jahresordner" subtitle="Belege & Audit-Timeline">
      <Inner />
    </FinanceShell>
  );
}

function Inner() {
  const { activeTenantId } = useFinanceTenant();
  const { year: yearParam } = useParams<{ year: string }>();
  const year = Number(yearParam);
  const [taxYear, setTaxYear] = useState<TaxYear | null | undefined>(undefined);
  const [docs, setDocs] = useState<TaxDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (!activeTenantId || Number.isNaN(year)) return;
    setError(null);
    listTaxYears(activeTenantId)
      .then((ys) => {
        const ty = ys.find((y) => y.year === year) ?? null;
        setTaxYear(ty);
        if (ty) {
          return listTaxDocuments(activeTenantId, { taxYearId: ty.id, limit: 1000 })
            .then(setDocs);
        }
      })
      .catch((err: Error) => setError(err.message));
  }, [activeTenantId, year]);

  async function prepareExport() {
    if (!activeTenantId || !taxYear) return;
    setPreparing(true);
    try {
      await createExport(activeTenantId, {
        tax_year_id: taxYear.id,
        export_type: 'steuerberater_package',
        notes: `Manuell vorbereitet am ${new Date().toLocaleDateString('de-DE')}`,
      });
      window.location.href = '/finance/exports';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export-Vorbereitung fehlgeschlagen');
      setPreparing(false);
    }
  }

  if (!activeTenantId) return <p className="text-sm text-titanium-400">Tenant fehlt.</p>;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (taxYear === undefined) return <Loader />;
  if (taxYear === null) {
    return (
      <div className="bg-obsidian-900 border border-titanium-900 p-6 text-center">
        <p className="text-sm text-titanium-300 mb-3">Kein Jahresordner für <strong>{year}</strong>.</p>
        <Link to="/finance/tax-evidence" className="text-sm text-emerald-400 hover:underline">
          Zurück zur Jahresübersicht
        </Link>
      </div>
    );
  }

  const bySource = new Map<TaxSourceType, TaxDocument[]>();
  for (const d of docs) {
    const list = bySource.get(d.source_type) ?? [];
    list.push(d);
    bySource.set(d.source_type, list);
  }

  const missing = SOURCE_TYPE_ORDER.filter((s) => !bySource.has(s));
  const needsReview = docs.filter((d) => d.classification_status === 'needs_review');
  const totalGross = docs.reduce((sum, d) => sum + Number(d.amount_gross ?? 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl text-titanium-50">Jahr {taxYear.year}</h2>
          <p className="text-xs text-titanium-400 mt-0.5">
            Status: {taxYear.status} · {docs.length} Dokumente · brutto-Summe {totalGross.toFixed(2)} EUR
          </p>
        </div>
        <button
          onClick={prepareExport}
          disabled={preparing || taxYear.status === 'archived'}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50"
        >
          <Package className="h-4 w-4" /> {preparing ? 'Bereite vor…' : 'Export vorbereiten'}
        </button>
      </header>

      {needsReview.length > 0 && (
        <section className="bg-amber-950/20 border border-amber-900 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-100">
            <strong>{needsReview.length} Belege brauchen Review.</strong>{' '}
            <Link to="/finance/documents" className="underline">Zur Dokumentliste</Link>
          </div>
        </section>
      )}

      {missing.length > 0 && (
        <section className="bg-obsidian-900 border border-titanium-900 p-3">
          <h3 className="text-[11px] uppercase tracking-wider text-titanium-400 mb-2 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Fehlende Kategorien
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {missing.map((s) => (
              <li key={s} className="text-[11px] px-2 py-1 bg-obsidian-950 border border-titanium-800 text-titanium-400">
                {SOURCE_TYPE_LABELS[s]}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        {SOURCE_TYPE_ORDER.map((source) => {
          const list = bySource.get(source) ?? [];
          if (list.length === 0) return null;
          return (
            <div key={source} className="bg-obsidian-900 border border-titanium-900">
              <header className="px-4 py-2.5 border-b border-titanium-900 flex items-center justify-between">
                <h3 className="font-display font-bold text-sm text-titanium-50">
                  {SOURCE_TYPE_LABELS[source]}
                </h3>
                <span className="text-xs text-titanium-400 font-mono">{list.length}</span>
              </header>
              <ul className="divide-y divide-titanium-900 text-sm">
                {list.slice(0, 8).map((d) => (
                  <li key={d.id} className="px-4 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-titanium-100 truncate">{d.file_name}</div>
                      <div className="text-[11px] text-titanium-500">
                        {new Date(d.document_date).toLocaleDateString('de-DE')}
                        {d.counterparty_name && ` · ${d.counterparty_name}`}
                        {d.amount_gross != null && ` · ${Number(d.amount_gross).toFixed(2)} ${d.currency}`}
                      </div>
                    </div>
                    <span className={`text-[11px] uppercase tracking-wider shrink-0 ${
                      d.classification_status === 'classified' ? 'text-emerald-300'
                      : d.classification_status === 'needs_review' ? 'text-amber-300'
                      : 'text-titanium-400'
                    }`}>
                      {d.classification_status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}

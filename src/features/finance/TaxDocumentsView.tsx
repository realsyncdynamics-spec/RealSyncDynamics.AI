import { useEffect, useState } from 'react';
import { Plus, X, Wand2 } from 'lucide-react';
import { FinanceShell, useFinanceTenant } from './FinanceShell';
import { Loader } from './FinanceDashboard';
import {
  listTaxYears, listTaxDocuments, createTaxDocument,
  updateClassification,
} from './api';
import {
  SOURCE_TYPE_ORDER, SOURCE_TYPE_LABELS,
  type TaxYear, type TaxDocument, type TaxSourceType, type TaxClassificationStatus,
} from './types';
import {
  classifyDocument,
  CATEGORY_LABELS,
  type ClassificationResult,
} from './classifyDocumentApi';

export function TaxDocumentsView() {
  return (
    <FinanceShell title="Dokumente" subtitle="Belegsammlung · Klassifikation">
      <Inner />
    </FinanceShell>
  );
}

function Inner() {
  const { activeTenantId } = useFinanceTenant();
  const [years, setYears] = useState<TaxYear[]>([]);
  const [docs, setDocs] = useState<TaxDocument[] | null>(null);
  const [filterSource, setFilterSource] = useState<TaxSourceType | ''>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [classifying, setClassifying] = useState(false);

  const reload = () => {
    if (!activeTenantId) return;
    setError(null);
    Promise.all([
      listTaxYears(activeTenantId),
      listTaxDocuments(activeTenantId, {
        taxYearId: filterYear || undefined,
        sourceType: (filterSource || undefined) as TaxSourceType | undefined,
        limit: 500,
      }),
    ])
      .then(([y, d]) => { setYears(y); setDocs(d); })
      .catch((err: Error) => setError(err.message));
  };
  useEffect(reload, [activeTenantId, filterYear, filterSource]);

  if (!activeTenantId) return <p className="text-sm text-titanium-400">Tenant fehlt.</p>;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (docs === null) return <Loader />;

  const yearMap = new Map(years.map((y) => [y.id, y]));

  async function classify(id: string, status: TaxClassificationStatus) {
    if (!activeTenantId) return;
    try {
      await updateClassification(activeTenantId, id, status);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktualisierung fehlgeschlagen');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5"
          >
            <option value="">Alle Jahre</option>
            {years.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
          </select>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as TaxSourceType | '')}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5"
          >
            <option value="">Alle Kategorien</option>
            {SOURCE_TYPE_ORDER.map((s) => <option key={s} value={s}>{SOURCE_TYPE_LABELS[s]}</option>)}
          </select>
          <span className="text-[11px] text-titanium-400">{docs.length} Dokumente</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setClassifying(true)}
            disabled={years.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-cyan-700 text-cyan-300 hover:bg-cyan-950/40 text-sm font-semibold rounded-none disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" /> Beleg klassifizieren
          </button>
          <button
            onClick={() => setCreating(true)}
            disabled={years.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Beleg erfassen
          </button>
        </div>
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-titanium-400 bg-obsidian-900 border border-titanium-900 p-6 text-center">
          Keine Dokumente in dieser Auswahl.
        </p>
      ) : (
        <table className="w-full text-sm bg-obsidian-900 border border-titanium-900">
          <thead className="bg-obsidian-950 text-[11px] uppercase tracking-wider text-titanium-400">
            <tr>
              <th className="text-left px-3 py-2">Datum</th>
              <th className="text-left px-3 py-2">Kategorie</th>
              <th className="text-left px-3 py-2">Beleg</th>
              <th className="text-left px-3 py-2 hidden md:table-cell">Gegenüber</th>
              <th className="text-right px-3 py-2 hidden lg:table-cell">Brutto</th>
              <th className="text-left px-3 py-2">Jahr</th>
              <th className="text-center px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-titanium-900">
            {docs.map((d) => (
              <tr key={d.id} className="hover:bg-obsidian-950">
                <td className="px-3 py-2 font-mono text-xs text-titanium-300">{new Date(d.document_date).toLocaleDateString('de-DE')}</td>
                <td className="px-3 py-2 text-titanium-300 text-xs">{SOURCE_TYPE_LABELS[d.source_type]}</td>
                <td className="px-3 py-2 text-titanium-100 truncate max-w-[260px]">{d.file_name}</td>
                <td className="px-3 py-2 text-titanium-400 text-xs hidden md:table-cell">{d.counterparty_name ?? '—'}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-titanium-300 hidden lg:table-cell">
                  {d.amount_gross != null ? `${Number(d.amount_gross).toFixed(2)} ${d.currency}` : '—'}
                </td>
                <td className="px-3 py-2 text-titanium-300 text-xs">{yearMap.get(d.tax_year_id)?.year ?? '—'}</td>
                <td className="px-3 py-2 text-center">
                  <select
                    value={d.classification_status}
                    onChange={(e) => classify(d.id, e.target.value as TaxClassificationStatus)}
                    className={`text-[11px] bg-obsidian-950 border border-titanium-800 rounded-none px-2 py-0.5 ${
                      d.classification_status === 'classified' ? 'text-emerald-300'
                      : d.classification_status === 'needs_review' ? 'text-amber-300'
                      : 'text-titanium-300'
                    }`}
                  >
                    <option value="pending">pending</option>
                    <option value="classified">classified</option>
                    <option value="needs_review">needs_review</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <CreateDocModal
          tenantId={activeTenantId}
          years={years}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}

      {classifying && (
        <ClassifyDocModal
          tenantId={activeTenantId}
          years={years}
          onClose={() => setClassifying(false)}
          onCreated={() => { setClassifying(false); reload(); }}
        />
      )}
    </div>
  );
}

function ClassifyDocModal({
  tenantId, years, onClose, onCreated,
}: {
  tenantId: string;
  years: TaxYear[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [text, setText] = useState('');
  const [hint, setHint] = useState('');
  const [taxYearId, setTaxYearId] = useState(years[0]?.id ?? '');
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runClassify() {
    if (!text.trim()) return;
    setRunning(true); setError(null); setResult(null);
    try {
      const r = await classifyDocument({ text, hint: hint.trim() || undefined, tenant_id: tenantId });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klassifikation fehlgeschlagen');
    } finally {
      setRunning(false);
    }
  }

  async function importDoc() {
    if (!result || !taxYearId) return;
    setImporting(true); setError(null);
    try {
      await createTaxDocument(tenantId, {
        tax_year_id:   taxYearId,
        source_type:   result.suggested_source_type,
        document_date: result.metadata.document_date ?? new Date().toISOString().slice(0, 10),
        file_name:     hint.trim() || `Klassifiziert · ${CATEGORY_LABELS[result.category]}`,
        counterparty_name: result.metadata.counterparty,
        amount_gross:  result.metadata.amount_gross,
        currency:      result.metadata.currency ?? 'EUR',
        ai_summary:    result.metadata.ai_summary,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import fehlgeschlagen');
      setImporting(false);
    }
  }

  const input = 'w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm rounded-none focus:border-emerald-500 outline-none';
  const confidencePct = result ? Math.round(result.confidence * 100) : 0;
  const needsReview = result && (result.category === 'UNKNOWN' || result.confidence < 0.6);

  return (
    <Modal onClose={onClose} title="Beleg klassifizieren">
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-titanium-400 mb-1">Dokumenttext (OCR / Copy-Paste) *</label>
          <textarea
            required value={text} onChange={(e) => setText(e.target.value)} rows={6}
            className={input}
            placeholder="Text des Belegs hier einfügen. Z. B. Inhalt einer eingescannten Rechnung."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-titanium-400 mb-1">Hinweis (Dateiname o. ä.)</label>
            <input value={hint} onChange={(e) => setHint(e.target.value)} className={input} placeholder="ER-2026-0001.pdf" />
          </div>
          <div>
            <label className="block text-xs text-titanium-400 mb-1">Jahresordner</label>
            <select value={taxYearId} onChange={(e) => setTaxYearId(e.target.value)} className={input}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
            </select>
          </div>
        </div>

        {!result && (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-titanium-300 hover:text-titanium-100">Abbrechen</button>
            <button
              type="button"
              onClick={runClassify}
              disabled={running || !text.trim()}
              className="px-3 py-1.5 bg-cyan-500 text-obsidian-950 text-xs font-semibold rounded-none hover:bg-cyan-400 disabled:opacity-50"
            >
              {running ? 'Klassifiziere …' : 'Klassifizieren'}
            </button>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="bg-obsidian-950 border border-titanium-800 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-titanium-50">{CATEGORY_LABELS[result.category]}</span>
                <span className={`font-mono text-[11px] ${confidencePct >= 60 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {confidencePct}% Konfidenz
                </span>
              </div>
              <div className="text-titanium-400">
                Zugeordnet als <code className="text-titanium-200">{result.suggested_source_type}</code>
              </div>
              {result.metadata.document_date && (
                <div className="text-titanium-400">Belegdatum: <span className="text-titanium-200">{result.metadata.document_date}</span></div>
              )}
              {result.metadata.counterparty && (
                <div className="text-titanium-400">Gegenüber: <span className="text-titanium-200">{result.metadata.counterparty}</span></div>
              )}
              {result.metadata.amount_gross != null && (
                <div className="text-titanium-400">
                  Brutto: <span className="text-titanium-200">{result.metadata.amount_gross.toFixed(2)} {result.metadata.currency ?? 'EUR'}</span>
                </div>
              )}
              {result.metadata.ai_summary && (
                <div className="text-titanium-500 italic mt-1">{result.metadata.ai_summary}</div>
              )}
              {result.fallback && (
                <div className="text-amber-300 mt-1.5 text-[11px]">
                  Fallback aktiv: {result.fallback.reason}. Klassifikation manuell prüfen.
                </div>
              )}
            </div>

            {needsReview && (
              <p className="text-[11px] text-amber-300">
                Niedrige Konfidenz oder UNKNOWN — der Import wird mit <code>needs_review</code> markiert,
                damit du den Beleg manuell prüfst.
              </p>
            )}

            <div className="flex justify-between gap-2">
              <button type="button" onClick={() => setResult(null)} className="px-3 py-1.5 text-xs text-titanium-300 hover:text-titanium-100">Erneut klassifizieren</button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-titanium-300 hover:text-titanium-100">Abbrechen</button>
                <button
                  type="button"
                  onClick={importDoc}
                  disabled={importing || !taxYearId}
                  className="px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-xs font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50"
                >
                  {importing ? 'Importiere …' : 'Übernehmen + Importieren'}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>
    </Modal>
  );
}

function CreateDocModal({
  tenantId, years, onClose, onCreated,
}: {
  tenantId: string;
  years: TaxYear[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [taxYearId, setTaxYearId] = useState(years[0]?.id ?? '');
  const [sourceType, setSourceType] = useState<TaxSourceType>('invoice_inbound');
  const [documentDate, setDocumentDate] = useState(todayISO);
  const [fileName, setFileName] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [amountNet, setAmountNet] = useState('');
  const [amountGross, setAmountGross] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await createTaxDocument(tenantId, {
        tax_year_id: taxYearId,
        source_type: sourceType,
        document_date: documentDate,
        file_name: fileName.trim(),
        counterparty_name: counterparty.trim() || undefined,
        amount_net:   amountNet === '' ? null : Number(amountNet),
        amount_gross: amountGross === '' ? null : Number(amountGross),
        currency: currency.trim() || 'EUR',
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen');
      setSubmitting(false);
    }
  }

  const input = 'w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm rounded-none focus:border-emerald-500 outline-none';

  return (
    <Modal onClose={onClose} title="Beleg erfassen">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Label text="Jahr">
            <select required value={taxYearId} onChange={(e) => setTaxYearId(e.target.value)} className={input}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
            </select>
          </Label>
          <Label text="Kategorie">
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value as TaxSourceType)} className={input}>
              {SOURCE_TYPE_ORDER.map((s) => <option key={s} value={s}>{SOURCE_TYPE_LABELS[s]}</option>)}
            </select>
          </Label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Label text="Belegdatum">
            <input type="date" required value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} className={input} />
          </Label>
          <Label text="Gegenüber">
            <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className={input} />
          </Label>
        </div>
        <Label text="Dateiname / Beleg-ID *">
          <input required value={fileName} onChange={(e) => setFileName(e.target.value)} className={input} placeholder="ER-2025-0001.pdf" />
        </Label>
        <div className="grid grid-cols-3 gap-3">
          <Label text="Netto">
            <input type="number" step="0.01" value={amountNet} onChange={(e) => setAmountNet(e.target.value)} className={input} />
          </Label>
          <Label text="Brutto">
            <input type="number" step="0.01" value={amountGross} onChange={(e) => setAmountGross(e.target.value)} className={input} />
          </Label>
          <Label text="Währung">
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} className={input} maxLength={3} />
          </Label>
        </div>
        <p className="text-[11px] text-titanium-500">
          File-Upload via Storage folgt in der nächsten Iteration; aktuell wird nur die Metadaten-Zeile angelegt.
        </p>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-titanium-300 hover:text-titanium-100">Abbrechen</button>
          <button
            type="submit"
            disabled={submitting || !fileName || !taxYearId}
            className="px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-xs font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50"
          >
            {submitting ? 'Speichere…' : 'Erfassen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="block text-titanium-400 mb-1">{text}</span>
      {children}
    </label>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-obsidian-900 border border-titanium-900 w-full max-w-lg shadow-xl">
        <header className="flex items-center justify-between px-4 py-2.5 border-b border-titanium-900">
          <h3 className="font-display font-bold text-sm text-titanium-50">{title}</h3>
          <button onClick={onClose} className="text-titanium-400 hover:text-titanium-200"><X className="h-4 w-4" /></button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

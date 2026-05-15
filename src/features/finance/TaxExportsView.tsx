import { useEffect, useState } from 'react';
import { Plus, Package, Check, AlertCircle, Cog, Download, Loader2, Stamp } from 'lucide-react';
import { FinanceShell, useFinanceTenant } from './FinanceShell';
import { Loader } from './FinanceDashboard';
import { Modal } from './TaxDocumentsView';
import { TaxDisclaimer } from './TaxDisclaimer';
import {
  listExports, createExport, markExportStatus, listTaxYears,
  generateEvidenceExport, getExportDownloadUrl,
} from './api';
import { createReview } from './reviewApi';
import {
  EXPORT_TYPE_LABELS, type TaxYear, type TaxEvidenceExport, type TaxExportType,
} from './types';

export function TaxExportsView() {
  return (
    <FinanceShell title="Exporte" subtitle="Dokumentationspakete · Audit-Archiv">
      <Inner />
    </FinanceShell>
  );
}

function Inner() {
  const { activeTenantId } = useFinanceTenant();
  const [years, setYears] = useState<TaxYear[]>([]);
  const [exports, setExports] = useState<TaxEvidenceExport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  const reload = () => {
    if (!activeTenantId) return;
    setError(null);
    Promise.all([listTaxYears(activeTenantId), listExports(activeTenantId)])
      .then(([y, e]) => { setYears(y); setExports(e); })
      .catch((err: Error) => setError(err.message));
  };
  useEffect(reload, [activeTenantId]);

  if (!activeTenantId) return <p className="text-sm text-titanium-400">Tenant fehlt.</p>;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (exports === null) return <Loader />;

  const yearMap = new Map(years.map((y) => [y.id, y]));

  async function markDownloaded(id: string) {
    if (!activeTenantId) return;
    try {
      await markExportStatus(activeTenantId, id, 'downloaded');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  }

  async function generate(id: string) {
    if (!activeTenantId) return;
    setGenerating((s) => ({ ...s, [id]: true }));
    try {
      await generateEvidenceExport(id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generierung fehlgeschlagen');
    } finally {
      setGenerating((s) => ({ ...s, [id]: false }));
    }
  }

  async function requestReview(ex: TaxEvidenceExport) {
    if (!activeTenantId) return;
    try {
      const year = yearMap.get(ex.tax_year_id);
      await createReview(activeTenantId, {
        subject_type: 'tax_evidence_export',
        subject_id: ex.id,
        title: `Review Exportpaket ${year?.year ?? ''} (${ex.export_type})`.trim(),
        notes: ex.checksum
          ? `Paket-Checksumme: ${ex.checksum}. Download-URL bitte aus dem Exporte-Tab abrufen.`
          : undefined,
      });
      window.location.href = '/finance/reviews';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review konnte nicht angelegt werden');
    }
  }

  async function download(ex: TaxEvidenceExport) {
    if (!ex.export_path) return;
    try {
      const url = await getExportDownloadUrl(ex.export_path);
      window.open(url, '_blank', 'noopener,noreferrer');
      if (ex.status === 'ready') {
        await markExportStatus(activeTenantId!, ex.id, 'downloaded');
        reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download fehlgeschlagen');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-titanium-400">{exports.length} Exportpakete</p>
        <button
          onClick={() => setCreating(true)}
          disabled={years.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Paket vorbereiten
        </button>
      </div>

      {exports.length === 0 ? (
        <p className="text-sm text-titanium-400 bg-obsidian-900 border border-titanium-900 p-6 text-center">
          Noch keine Exportpakete erzeugt.
        </p>
      ) : (
        <ul className="space-y-3">
          {exports.map((ex) => {
            const year = yearMap.get(ex.tax_year_id);
            return (
              <li key={ex.id} className="bg-obsidian-900 border border-titanium-900 p-4">
                <header className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-emerald-400" />
                    <h3 className="font-display font-bold text-sm text-titanium-50">
                      {EXPORT_TYPE_LABELS[ex.export_type]}
                    </h3>
                    {year && <span className="text-[11px] text-titanium-400">· {year.year}</span>}
                  </div>
                  <StatusBadge status={ex.status} />
                </header>
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] mb-3">
                  <Field label="Erstellt"      value={new Date(ex.created_at).toLocaleString('de-DE')} />
                  <Field label="Dokumente"     value={String(ex.document_count)} />
                  <Field label="Brutto-Summe"  value={ex.total_amount != null ? `${Number(ex.total_amount).toFixed(2)} EUR` : '—'} />
                  <Field label="Checksum (sha256)" value={ex.checksum ?? '—'} mono />
                </dl>
                <TaxDisclaimer variant="compact" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {ex.status === 'preparing' && (
                    <button
                      onClick={() => generate(ex.id)}
                      disabled={generating[ex.id]}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 text-obsidian-950 text-xs font-semibold rounded-none hover:bg-cyan-400 disabled:opacity-50"
                    >
                      {generating[ex.id]
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Cog className="h-3.5 w-3.5" />}
                      {generating[ex.id] ? 'Erzeuge ZIP …' : 'ZIP jetzt erzeugen'}
                    </button>
                  )}
                  {(ex.status === 'ready' || ex.status === 'downloaded') && ex.export_path && (
                    <>
                      <button
                        onClick={() => download(ex)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-xs font-semibold rounded-none hover:bg-emerald-400"
                      >
                        <Download className="h-3.5 w-3.5" /> ZIP herunterladen
                      </button>
                      <button
                        onClick={() => requestReview(ex)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-cyan-700 text-cyan-300 hover:bg-cyan-950/40 text-xs font-semibold rounded-none"
                      >
                        <Stamp className="h-3.5 w-3.5" /> Zum Steuerberater-Review
                      </button>
                    </>
                  )}
                  {ex.status === 'ready' && (
                    <button
                      onClick={() => markDownloaded(ex.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-titanium-700 text-titanium-300 hover:text-titanium-100 text-xs font-semibold rounded-none"
                    >
                      <Check className="h-3.5 w-3.5" /> Manuell als heruntergeladen markieren
                    </button>
                  )}
                  {ex.status === 'failed' && (
                    <button
                      onClick={() => generate(ex.id)}
                      disabled={generating[ex.id]}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-700 text-amber-300 hover:bg-amber-950/40 text-xs font-semibold rounded-none disabled:opacity-50"
                    >
                      <Cog className="h-3.5 w-3.5" /> Erneut versuchen
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <CreateExportModal
          tenantId={activeTenantId}
          years={years}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="uppercase tracking-wider text-titanium-500">{label}</dt>
      <dd className={`text-titanium-200 ${mono ? 'font-mono text-[10px] break-all' : ''}`}>{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: TaxEvidenceExport['status'] }) {
  const cls =
    status === 'ready' ? 'text-emerald-300'
    : status === 'downloaded' ? 'text-emerald-200'
    : status === 'failed' ? 'text-red-300'
    : 'text-amber-300';
  return (
    <span className={`text-[11px] uppercase tracking-wider inline-flex items-center gap-1 ${cls}`}>
      {status === 'failed' && <AlertCircle className="h-3 w-3" />}
      {status}
    </span>
  );
}

function CreateExportModal({
  tenantId, years, onClose, onCreated,
}: {
  tenantId: string;
  years: TaxYear[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [taxYearId, setTaxYearId] = useState(years[0]?.id ?? '');
  const [exportType, setExportType] = useState<TaxExportType>('steuerberater_package');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await createExport(tenantId, {
        tax_year_id: taxYearId,
        export_type: exportType,
        notes: notes.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen');
      setSubmitting(false);
    }
  }

  const input = 'w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm rounded-none focus:border-emerald-500 outline-none';

  return (
    <Modal title="Exportpaket vorbereiten" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs">
          <span className="block text-titanium-400 mb-1">Jahr</span>
          <select required value={taxYearId} onChange={(e) => setTaxYearId(e.target.value)} className={input}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
          </select>
        </label>
        <label className="block text-xs">
          <span className="block text-titanium-400 mb-1">Paket-Typ</span>
          <select value={exportType} onChange={(e) => setExportType(e.target.value as TaxExportType)} className={input}>
            <option value="steuerberater_package">Export für Steuerberater</option>
            <option value="management_review">Management Review</option>
            <option value="audit_archive">Audit-Archiv</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="block text-titanium-400 mb-1">Notizen</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={input} />
        </label>
        <TaxDisclaimer variant="compact" />
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-titanium-300 hover:text-titanium-100">Abbrechen</button>
          <button
            type="submit"
            disabled={submitting || !taxYearId}
            className="px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-xs font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50"
          >
            {submitting ? 'Lege an…' : 'Vorbereiten'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

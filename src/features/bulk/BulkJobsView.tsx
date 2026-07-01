import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Layers, AlertTriangle, Upload, Play, X, RefreshCw } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import { parseDomainList } from '../../lib/bulk/domains';
import {
  submitBulkScan, cancelBulkScan, listBatches, getBatchProgress,
  type BulkBatch, type BatchProgress, type BulkError,
} from './bulkApi';

/**
 * /app/bulk — Bulk-Jobs: viele Domains in einem Batch scannen.
 * Ab Agency (Entitlement bulk.jobs). Die Domain-Liste wird lokal geparst
 * (Vorschau), der Batch serverseitig eingereiht (Prioritäts-Queue mit Retry).
 */
export function BulkJobsView() {
  return <AuthGate>{() => <BulkInner />}</AuthGate>;
}

function errorMessage(e: BulkError): string {
  switch (e.kind) {
    case 'forbidden': return 'Kein Zugriff auf diesen Mandanten.';
    case 'payment_required': return 'Bulk-Jobs sind erst ab Agency verfügbar.';
    case 'quota_exceeded': return 'Monats-Kontingent für Bulk-Jobs erschöpft.';
    default: return e.message;
  }
}

const STATUS_COLOR: Record<string, string> = {
  queued: 'text-titanium-400', running: 'text-security-400', completed: 'text-emerald-400',
  paused: 'text-amber-400', cancelled: 'text-titanium-500', failed: 'text-risk-critical',
};

function BulkInner() {
  const { activeTenantId, hasFeature } = useTenant();
  const enabled = hasFeature('bulk.jobs');

  const [input, setInput] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [batches, setBatches] = useState<BulkBatch[]>([]);
  const [progress, setProgress] = useState<Record<string, BatchProgress>>({});

  // Lokale Sofort-Vorschau des Parsings (kein Server-Call).
  const preview = useMemo(() => parseDomainList(input), [input]);

  const reload = useCallback(async () => {
    if (!activeTenantId) { setBatches([]); return; }
    try {
      const list = await listBatches(activeTenantId);
      setBatches(list);
      const entries = await Promise.all(
        list.map(async (b) => [b.id, await getBatchProgress(b.id).catch(() => null)] as const),
      );
      setProgress(Object.fromEntries(entries.filter(([, p]) => p !== null) as Array<[string, BatchProgress]>));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [activeTenantId]);

  useEffect(() => { reload(); }, [reload]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setInput((prev) => (prev ? prev + '\n' : '') + text);
  }

  async function onSubmit() {
    if (!activeTenantId || preview.valid.length === 0) return;
    setBusy(true); setError(null); setNotice(null);
    const r = await submitBulkScan({ tenant_id: activeTenantId, domains: preview.valid, label: label.trim() || undefined });
    if (r.kind === 'ok') {
      setNotice(`Batch eingereiht: ${r.data.accepted} Domains${r.data.duplicates ? `, ${r.data.duplicates} Duplikate entfernt` : ''}.`);
      setInput(''); setLabel('');
      reload();
    } else {
      setError(errorMessage(r));
    }
    setBusy(false);
  }

  async function onCancel(batchId: string) {
    if (!activeTenantId) return;
    await cancelBulkScan({ tenant_id: activeTenantId, batch_id: batchId });
    reload();
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-700">
              <Layers className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">Bulk-Jobs</h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                Massen-Scan · Prioritäts-Queue · Retry
              </p>
            </div>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={reload}><RefreshCw className="h-3.5 w-3.5" /> Aktualisieren</Button>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 sm:px-6">
        {!enabled && (
          <div className="flex items-start gap-3 border border-amber-500/40 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs text-titanium-300">
              <p className="font-semibold text-amber-300">Bulk-Jobs sind in deinem Plan nicht freigeschaltet.</p>
              <p className="mt-1">Verfügbar ab <strong>Agency</strong> (Agency 50 · Scale 500 · Enterprise unbegrenzt Batches/Monat).</p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader
            title="Neuer Batch"
            eyebrow="Domains einreichen"
            subtitle="Eine Domain pro Zeile oder CSV — wird lokal geprüft, bevor der Batch eingereiht wird."
          />
          <CardBody>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">Bezeichnung (optional)</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="z.B. Kundenportfolio Q3"
                  className="w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 placeholder:text-titanium-600 focus:border-security-500 focus:outline-none"
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">Domains / CSV</label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-security-400 hover:text-security-300">
                    <Upload className="h-3 w-3" /> CSV laden
                    <input type="file" accept=".csv,.txt" className="hidden" onChange={onFile} />
                  </label>
                </div>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={7}
                  placeholder={'example.com\nkunde-a.de\nhttps://kunde-b.at/impressum'}
                  className="w-full resize-y border border-titanium-700 bg-obsidian-900 px-3 py-2 font-mono text-xs text-titanium-100 placeholder:text-titanium-600 focus:border-security-500 focus:outline-none"
                />
              </div>

              {/* Lokale Parse-Vorschau */}
              {input.trim() && (
                <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wider">
                  <span className="border border-emerald-500/40 bg-emerald-500/5 px-2 py-1 text-emerald-300">{preview.valid.length} gültig</span>
                  {preview.duplicates > 0 && <span className="border border-amber-500/40 bg-amber-500/5 px-2 py-1 text-amber-300">{preview.duplicates} Duplikate</span>}
                  {preview.rejected.length > 0 && <span className="border border-risk-critical/40 bg-risk-critical/5 px-2 py-1 text-risk-critical">{preview.rejected.length} ungültig</span>}
                </div>
              )}

              <Button onClick={onSubmit} disabled={busy || !enabled || !activeTenantId || preview.valid.length === 0}>
                <Play className="h-3.5 w-3.5" /> {busy ? 'Reihe ein…' : `${preview.valid.length} Domains scannen`}
              </Button>

              {notice && <div className="border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-300">{notice}</div>}
              {error && <div className="border border-risk-critical/40 bg-risk-critical/5 px-4 py-3 text-xs text-risk-critical">{error}</div>}
            </div>
          </CardBody>
        </Card>

        <div>
          <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">Batches</div>
          {batches.length === 0 ? (
            <p className="font-mono text-xs text-titanium-500">Noch keine Batches eingereicht.</p>
          ) : (
            <div className="space-y-2">
              {batches.map((b) => {
                const p = progress[b.id];
                const done = p ? p.succeeded + p.failed + p.cancelled : 0;
                const pct = p && p.total > 0 ? Math.round((done / p.total) * 100) : 0;
                return (
                  <div key={b.id} className="border border-titanium-800 bg-obsidian-900 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-titanium-100">{b.label || `Batch ${b.id.slice(0, 8)}`}</div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                          {b.total_count} Domains · <span className={STATUS_COLOR[b.status]}>{b.status}</span>
                        </div>
                      </div>
                      {(b.status === 'queued' || b.status === 'running' || b.status === 'paused') && (
                        <Button variant="secondary" size="sm" onClick={() => onCancel(b.id)}><X className="h-3.5 w-3.5" /> Abbrechen</Button>
                      )}
                    </div>
                    <div className="mt-2 h-1.5 w-full bg-obsidian-800">
                      <div className="h-full bg-security-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    {p && (
                      <div className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[10px] text-titanium-500">
                        <span className="text-emerald-400">{p.succeeded} ok</span>
                        <span className="text-security-400">{p.running} laufen</span>
                        <span>{p.queued} wartend</span>
                        {p.failed > 0 && <span className="text-risk-critical">{p.failed} fehlgeschlagen</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

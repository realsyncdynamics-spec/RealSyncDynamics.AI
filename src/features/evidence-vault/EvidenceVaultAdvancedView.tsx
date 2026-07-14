import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Archive, AlertTriangle, FileUp, Fingerprint, Lock, LockOpen, RefreshCw, Camera, ShieldCheck, ShieldAlert } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import { sha256Hex } from '../../lib/provenance';
import { describeRetention, RETENTION_CLASSES, type RetentionClass } from '../../lib/evidence/retention';
import { verifyAllChains, type ChainReport } from '../../lib/evidence/verifyChain';
import { createSnapshot, setLegalHold, listTimeline, listSnapshotsForVerification, type TimelineEntry, type VaultError } from './evidenceVaultApi';

// WebCrypto-Adapter für die Verifizierung (string → hex), teilt sich die
// SHA-256-Implementierung mit der Snapshot-Erzeugung.
const hashHex = (input: string) => sha256Hex(new TextEncoder().encode(input));

/**
 * /app/evidence-vault — Evidence Vault Advanced: versionierte, unveränderliche
 * Snapshots mit Retention + Legal-Hold + Audit-Timeline. Ab Agency.
 * Der Inhalts-Hash wird lokal im Browser berechnet (Datei bleibt lokal).
 */
export function EvidenceVaultAdvancedView() {
  return <AuthGate>{() => <VaultInner />}</AuthGate>;
}

function errorMessage(e: VaultError): string {
  switch (e.kind) {
    case 'forbidden': return 'Kein Zugriff auf diesen Mandanten.';
    case 'payment_required': return 'Evidence Vault Advanced ist erst ab Agency verfügbar.';
    default: return e.message;
  }
}

function VaultInner() {
  const { activeTenantId, hasFeature } = useTenant();
  const advanced = hasFeature('evidence.advanced');

  const [subjectRef, setSubjectRef] = useState('');
  const [label, setLabel] = useState('');
  const [digest, setDigest] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [retention, setRetention] = useState<RetentionClass>('7y');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [reports, setReports] = useState<ChainReport[] | null>(null);

  const reload = useCallback(async () => {
    if (!activeTenantId) { setTimeline([]); return; }
    try { setTimeline(await listTimeline(activeTenantId)); }
    catch (e) { setError((e as Error).message); }
  }, [activeTenantId]);

  useEffect(() => { reload(); }, [reload]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setNotice(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    setDigest(await sha256Hex(bytes));
    setFileName(file.name);
  }

  async function onSnapshot() {
    if (!activeTenantId || !subjectRef.trim() || !digest) return;
    setBusy(true); setError(null); setNotice(null);
    const r = await createSnapshot({ tenant_id: activeTenantId, subject_ref: subjectRef.trim(), content_sha256: digest, label: label.trim() || undefined, retention_class: retention });
    if (r.kind === 'ok') {
      setNotice(`Snapshot v${r.data.version} angelegt${r.data.signed ? ' (signiert)' : ''}${r.data.provenance_linked ? ' · Herkunftskette aktualisiert' : ''} · Hash ${r.data.event_hash.slice(0, 16)}…`);
      setDigest(null); setFileName(null); setLabel('');
      reload();
    } else {
      setError(errorMessage(r));
    }
    setBusy(false);
  }

  async function onToggleHold(subject: string, active: boolean) {
    if (!activeTenantId) return;
    await setLegalHold({ tenant_id: activeTenantId, subject_ref: subject, active });
    reload();
  }

  async function onVerify() {
    if (!activeTenantId) return;
    setVerifying(true); setError(null); setReports(null);
    try {
      const snapshots = await listSnapshotsForVerification(activeTenantId);
      setReports(await verifyAllChains(snapshots, hashHex));
    } catch (e) {
      setError((e as Error).message);
    }
    setVerifying(false);
  }

  const inputCls = 'w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 placeholder:text-titanium-600 focus:border-security-500 focus:outline-none';
  const labelCls = 'mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500';

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-amber-500 to-orange-700">
              <Archive className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">Evidence Vault</h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                Immutable Snapshots · Retention · Legal-Hold
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onVerify} disabled={verifying || !activeTenantId}>
            <ShieldCheck className="h-3.5 w-3.5" /> {verifying ? 'Prüfe…' : 'Integrität prüfen'}
          </Button>
          <Button variant="secondary" size="sm" onClick={reload}><RefreshCw className="h-3.5 w-3.5" /> Aktualisieren</Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 sm:px-6">
        {!advanced && (
          <div className="flex items-start gap-3 border border-amber-500/40 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs text-titanium-300">
              <p className="font-semibold text-amber-300">Evidence Vault Advanced ist in deinem Plan nicht freigeschaltet.</p>
              <p className="mt-1">Versionierung, Immutable Snapshots, Retention und Legal-Hold sind ab <strong>Agency</strong> verfügbar.</p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader title="Snapshot anlegen" eyebrow="Immutable Evidence" subtitle="Der Inhalts-Hash wird lokal berechnet; der Snapshot wird versioniert, verkettet und (falls Schlüssel gesetzt) signiert unveränderlich abgelegt." />
          <CardBody>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Subjekt-Referenz</label>
                  <input className={inputCls} value={subjectRef} onChange={(e) => setSubjectRef(e.target.value)} placeholder="z.B. DPA-2026-ACME oder AST-0007" />
                </div>
                <div>
                  <label className={labelCls}>Bezeichnung (optional)</label>
                  <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z.B. Vertragsstand Q3" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Aufbewahrung</label>
                  <select className={inputCls} value={retention} onChange={(e) => setRetention(e.target.value as RetentionClass)}>
                    {RETENTION_CLASSES.map((c) => <option key={c} value={c}>{describeRetention(c)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Inhalt (lokaler SHA-256)</label>
                  <label className="inline-flex cursor-pointer items-center gap-2 border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-200 hover:border-security-500">
                    <FileUp className="h-3.5 w-3.5" /> Datei wählen
                    <input type="file" className="hidden" onChange={onFile} />
                  </label>
                </div>
              </div>

              {digest && (
                <p className="flex items-center gap-2 break-all font-mono text-[11px] text-titanium-400">
                  <Fingerprint className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span>{fileName}: {digest}</span>
                </p>
              )}

              <Button onClick={onSnapshot} disabled={busy || !advanced || !activeTenantId || !subjectRef.trim() || !digest}>
                <Camera className="h-3.5 w-3.5" /> {busy ? 'Lege an…' : 'Snapshot anlegen'}
              </Button>

              {notice && <div className="border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-300">{notice}</div>}
              {error && <div className="border border-risk-critical/40 bg-risk-critical/5 px-4 py-3 text-xs text-risk-critical">{error}</div>}
            </div>
          </CardBody>
        </Card>

        {reports && <VerificationPanel reports={reports} />}

        <div>
          <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">Audit-Timeline</div>
          {timeline.length === 0 ? (
            <p className="font-mono text-xs text-titanium-500">Noch keine Snapshots.</p>
          ) : (
            <div className="space-y-2">
              {timeline.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 border border-titanium-800 bg-obsidian-900 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm text-titanium-100">
                      <span className="truncate">{t.label || t.subject_ref}</span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">v{t.version}</span>
                      {t.on_hold && <span className="inline-flex items-center gap-1 border border-amber-500/40 bg-amber-500/5 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300"><Lock className="h-2.5 w-2.5" /> Legal-Hold</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[10px] text-titanium-500">
                      <span className="break-all">{t.event_hash.slice(0, 16)}…</span>
                      <span>Aufbewahrung: {describeRetention(t.retention_class)}</span>
                      {t.retained_until && <span>bis {new Date(t.retained_until).toLocaleDateString('de-DE')}</span>}
                      <span>{new Date(t.created_at).toLocaleString('de-DE')}</span>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => onToggleHold(t.subject_ref, !t.on_hold)}>
                    {t.on_hold ? <><LockOpen className="h-3.5 w-3.5" /> Hold lösen</> : <><Lock className="h-3.5 w-3.5" /> Legal-Hold</>}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VerificationPanel({ reports }: { reports: ChainReport[] }) {
  if (reports.length === 0) {
    return (
      <div className="border border-titanium-800 bg-obsidian-900 px-4 py-3 font-mono text-xs text-titanium-500">
        Keine Snapshots zum Prüfen vorhanden.
      </div>
    );
  }
  const allOk = reports.every((r) => r.ok);
  const totalVerified = reports.reduce((n, r) => n + r.cryptoVerified, 0);
  const totalLegacy = reports.reduce((n, r) => n + r.legacy, 0);

  return (
    <div className={`border ${allOk ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-risk-critical/50 bg-risk-critical/5'}`}>
      <div className="flex items-center gap-2 border-b border-titanium-900 px-4 py-2.5">
        {allOk ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-risk-critical" />}
        <span className={`font-mono text-[11px] font-semibold uppercase tracking-wider ${allOk ? 'text-emerald-300' : 'text-risk-critical'}`}>
          {allOk ? 'Integrität bestätigt' : 'Integrität verletzt'}
        </span>
        <span className="font-mono text-[10px] text-titanium-500">
          {reports.length} Kette{reports.length === 1 ? '' : 'n'} · {totalVerified} kryptografisch geprüft{totalLegacy > 0 ? ` · ${totalLegacy} Legacy` : ''}
        </span>
      </div>
      <ul className="divide-y divide-titanium-900">
        {reports.map((r) => (
          <li key={r.subjectRef} className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-mono text-xs text-titanium-200">{r.subjectRef}</span>
              <span className={`shrink-0 border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${r.ok ? 'border-emerald-500/40 text-emerald-300' : 'border-risk-critical/50 text-risk-critical'}`}>
                {r.ok ? `v1–${r.count} intakt` : `${r.issues.length} Problem${r.issues.length === 1 ? '' : 'e'}`}
              </span>
            </div>
            {r.issues.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {r.issues.map((iss, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 font-mono text-[11px] text-risk-critical">
                    <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>v{iss.version} · {iss.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

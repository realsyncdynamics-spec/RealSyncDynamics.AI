/**
 * Bindet die bestehende Hash-Kette (@realsync/evidence-chain) in den
 * Governance-OS-Vault. Keine zweite Verifier-Logik.
 */
import { useCallback, useState } from 'react';
import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { verifyAllChains, type ChainReport } from '../../../../packages/evidence-chain/src/index';
import { listSnapshotsForVerification } from '../../evidence-vault/evidenceVaultApi';
import { sha256Hex } from '../../../lib/provenance';

const hashHex = (input: string) => sha256Hex(new TextEncoder().encode(input));

export function ChainIntegrityPanel({ tenantId }: { tenantId: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<ChainReport[] | null>(null);

  const run = useCallback(async () => {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    try {
      const snapshots = await listSnapshotsForVerification(tenantId);
      setReports(await verifyAllChains(snapshots, hashHex));
    } catch (e) {
      setError((e as Error).message);
      setReports(null);
    } finally {
      setBusy(false);
    }
  }, [tenantId]);

  if (!tenantId) {
    return (
      <div className="py-16 text-center font-mono text-sm text-titanium-500">
        Kein Workspace ausgewählt.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-titanium-50">Hash-Kette</h3>
          <p className="mt-1 max-w-xl text-[11px] font-mono text-titanium-500">
            Prüft evidence_snapshots dieses Mandanten: Versionsfolge, prev_hash-Verkettung,
            SHA-256-Kanonik identisch zur Edge Function evidence-vault. Keine Fake-Daten.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-2 border border-teal-900 px-3 py-1.5 font-mono text-[11px] text-teal-300 hover:border-teal-600 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {busy ? 'Prüfe…' : 'Integrität prüfen'}
        </button>
      </div>

      {error && (
        <div className="border border-red-900 bg-red-950/40 px-3 py-2 font-mono text-[11px] text-red-300">
          {error}
        </div>
      )}

      {reports && <ReportList reports={reports} />}
    </div>
  );
}

function ReportList({ reports }: { reports: ChainReport[] }) {
  if (reports.length === 0) {
    return (
      <p className="font-mono text-xs text-titanium-500">
        Noch keine Evidence. Snapshot anlegen, dann erneut prüfen.
      </p>
    );
  }

  const allOk = reports.every((r) => r.ok);
  const verified = reports.reduce((n, r) => n + r.cryptoVerified, 0);
  const legacy = reports.reduce((n, r) => n + r.legacy, 0);

  return (
    <div className={`border ${allOk ? 'border-emerald-800 bg-emerald-950/20' : 'border-red-900 bg-red-950/20'}`}>
      <div className="flex items-center gap-2 border-b border-titanium-900 px-3 py-2">
        {allOk ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-red-400" />}
        <span className={`font-mono text-[11px] uppercase tracking-wider ${allOk ? 'text-emerald-300' : 'text-red-300'}`}>
          {allOk ? 'Kette intakt' : 'Kette verletzt'}
        </span>
        <span className="font-mono text-[10px] text-titanium-500">
          {reports.length} Subject(s) · {verified} crypto{legacy ? ` · ${legacy} legacy` : ''}
        </span>
      </div>
      <ul className="divide-y divide-titanium-900">
        {reports.map((r) => (
          <li key={r.subjectRef} className="px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-mono text-xs text-titanium-200">{r.subjectRef}</span>
              <span className={`font-mono text-[10px] uppercase ${r.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {r.ok ? `v1–${r.count}` : `${r.issues.length} Issue(s)`}
              </span>
            </div>
            {r.issues.map((iss, i) => (
              <p key={i} className="mt-1 font-mono text-[11px] text-red-300">
                v{iss.version} · {iss.kind} · {iss.detail}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

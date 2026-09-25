/**
 * /app/evidence — Hash-Kette, Verifikation und Chain Head (HANDOFF §10),
 * über der bestehenden EvidenceVaultView.
 *
 * Quelle: `evidence_snapshots` (listSnapshotsForVerification). Verifiziert
 * wird im Browser mit `verifyAllChains` aus packages/evidence-chain gegen
 * SHA-256 — dieselbe Prüfung wie im Evidence Vault Advanced. Es wird kein
 * Hash im Client erfunden; angezeigt wird, was die Tabelle trägt.
 * Export: `exportEvidenceBundle` (Edge Function evidence-vault-export).
 */
import { useMemo, useState } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import {
  exportEvidenceBundle,
  listSnapshotsForVerification,
} from '../../evidence-vault/evidenceVaultApi';
import { verifyAllChains, type ChainReport, type SnapshotRecord } from '../../../../packages/evidence-chain/src/index';
import { sha256Hex } from '../../../lib/provenance';
import { useLang } from '../../../i18n/useLang';
import { Panel, WarnToast, formatDateTime } from './ui';
import { useTenantLoad } from './useTenantLoad';

const hashHex = (input: string) => sha256Hex(new TextEncoder().encode(input));

type VerifyState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; reports: ChainReport[] }
  | { status: 'error'; message: string };

function byNewest(a: SnapshotRecord, b: SnapshotRecord): number {
  const ta = a.event_timestamp ? Date.parse(a.event_timestamp) : 0;
  const tb = b.event_timestamp ? Date.parse(b.event_timestamp) : 0;
  return tb - ta || b.version - a.version;
}

export function EvidenceChainPanel() {
  const { activeTenantId } = useTenant();
  const { t, lang } = useLang();
  const [state] = useTenantLoad(activeTenantId, listSnapshotsForVerification);
  const [verify, setVerify] = useState<VerifyState>({ status: 'idle' });
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  const snapshots = state.status === 'ready' ? state.data : [];
  const sorted = useMemo(() => [...snapshots].sort(byNewest), [snapshots]);
  const head = sorted[0] ?? null;

  async function onVerify() {
    if (snapshots.length === 0) return;
    setVerify({ status: 'running' });
    try {
      const reports = await verifyAllChains(snapshots, hashHex);
      setVerify({ status: 'done', reports });
    } catch (e) {
      setVerify({ status: 'error', message: (e as Error).message });
    }
  }

  async function onExport() {
    if (!activeTenantId) return;
    setExporting(true);
    setNotice(null);
    const r = await exportEvidenceBundle({ tenant_id: activeTenantId });
    if (r.kind === 'ok') {
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evidence-vault-export-${activeTenantId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice({ text: t('exportDone', { n: r.data.count }), error: false });
    } else {
      setNotice({ text: r.kind === 'forbidden' ? t('loadFailed') : r.message, error: true });
    }
    setExporting(false);
  }

  const reports = verify.status === 'done' ? verify.reports : [];
  const ok = verify.status === 'done' && reports.every((r) => r.ok);
  const issues = reports.reduce((n, r) => n + r.issues.length, 0);
  const verified = reports.reduce((n, r) => n + r.cryptoVerified, 0);
  const legacy = reports.reduce((n, r) => n + r.legacy, 0);
  const ringColor =
    verify.status === 'done' ? (ok ? 'var(--color-rs-success)' : 'var(--color-rs-danger)') : 'var(--color-rs-bg-3)';

  return (
    <div className="rs-page rs-ui" data-testid="evidence-chain-panel">
      {state.status === 'error' && <WarnToast error>{t('loadFailed')}</WarnToast>}
      {notice && <WarnToast error={notice.error}>{notice.text}</WarnToast>}
      <div className="rs-evidence">
        <Panel className="rs-panel--flush">
          <div className="rs-table">
            <div className="rs-table__inner">
              <div className="rs-trow rs-trow--head rs-trow--evidence">
                <span>{t('colSeq')}</span>
                <span>{t('time')}</span>
                <span>{t('colEvent')}</span>
                <span>{t('colSha')}</span>
                <span>{t('colPrev')}</span>
              </div>
              {state.status === 'idle' && <div className="rs-empty">{t('noTenant')}</div>}
              {state.status === 'loading' && <div className="rs-empty">{t('loading')}</div>}
              {state.status === 'ready' && sorted.length === 0 && (
                <div className="rs-empty" data-testid="chain-empty">
                  {t('chainNone')}
                </div>
              )}
              {sorted.slice(0, 25).map((s, i) => (
                <div
                  key={`${s.subject_ref}-${s.version}`}
                  className={`rs-trow rs-trow--evidence${i === 0 ? ' rs-trow--latest' : ''}`}
                  data-testid="chain-row"
                >
                  <span className="rs-mono rs-cyan">#{s.version}</span>
                  <span className="rs-mono" style={{ color: 'var(--color-rs-fg-2)' }}>
                    {formatDateTime(s.event_timestamp, lang)}
                  </span>
                  <span className="rs-ellipsis rs-cell-main">{s.subject_ref}</span>
                  <span className="rs-mono rs-ellipsis" title={s.event_hash}>
                    {s.event_hash}
                  </span>
                  <span className="rs-mono" style={{ color: 'var(--color-rs-fg-3)' }}>
                    {s.prev_hash ? s.prev_hash.slice(0, 8) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel className="rs-panel--pad20" testId="verify-card">
            <div className="rs-verify">
              <svg className="rs-verify__ring" viewBox="0 0 56 56" aria-hidden="true">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  strokeWidth="4"
                  stroke={ringColor}
                  strokeDasharray={verify.status === 'idle' ? '4 4' : undefined}
                />
                {verify.status === 'running' && (
                  <circle className="rs-verify__seal" cx="28" cy="28" r="24" fill="none" strokeWidth="4" stroke="var(--color-rs-cyan)" />
                )}
              </svg>
              <div className="rs-h3">
                {verify.status === 'running'
                  ? t('verRun')
                  : verify.status === 'done'
                    ? ok
                      ? t('verOk')
                      : t('verFail')
                    : verify.status === 'error'
                      ? t('unavailable')
                      : t('verIdle')}
              </div>
              <div className="rs-note">
                {verify.status === 'running'
                  ? t('verRunSub')
                  : verify.status === 'done'
                    ? ok
                      ? t('verOkReal', { n: verified })
                      : t('verFailSub', { n: issues })
                    : verify.status === 'error'
                      ? verify.message
                      : t('verIdleSub')}
              </div>
              {verify.status === 'done' && legacy > 0 && <div className="rs-note">{t('verLegacy', { n: legacy })}</div>}
              <button
                type="button"
                className="rs-chip-sm rs-chip-sm--primary"
                onClick={() => void onVerify()}
                disabled={snapshots.length === 0 || verify.status === 'running'}
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t('verifyBtn')}
              </button>
            </div>
          </Panel>
          <Panel className="rs-panel--pad20" testId="chain-head">
            <div className="rs-panel__head">
              <span className="rs-overline">{t('chainHead')}</span>
            </div>
            <p className="rs-hash">{head ? head.event_hash : '—'}</p>
            <div className="mt-3 flex justify-between text-[12px]" style={{ color: 'var(--color-rs-fg-2)' }}>
              <span>{t('entries')}</span>
              <span className="rs-mono">{state.status === 'ready' ? snapshots.length : '—'}</span>
            </div>
            <p className="rs-note mt-2 rs-mono">{t('chainAlgo')}</p>
          </Panel>
          <button
            type="button"
            className="rs-chip-sm justify-center"
            onClick={() => void onExport()}
            disabled={!activeTenantId || exporting}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> {exporting ? t('exportRunning') : t('exportBundle')}
          </button>
        </div>
      </div>
      <p className="rs-overline">{t('moreEvidence')}</p>
    </div>
  );
}

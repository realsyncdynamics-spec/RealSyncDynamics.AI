/**
 * Scan-detail surface for `/governance/scans/:scanId`.
 *
 * Loads the ReportPayload via scansApi.getScanReport, renders the
 * canonical Report shape (score, grade, breakdowns, top findings),
 * and provides a "PDF herunterladen" button that lazy-loads
 * ReportTemplate (#429) and produces a real binary PDF via
 * pdf().toBlob().
 *
 * AuthGate + RLS already restrict the data; no additional check here.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Download, Loader2, AlertTriangle, ShieldCheck, XCircle,
} from 'lucide-react';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { getScanReport } from './scansApi';
import type { ReportPayload } from '../../../types/governance/report';
import type { Finding, FindingSeverity, FindingStatus } from '../../../types/governance/finding';
import { evidenceRefLabel } from '../../../types/governance/evidence';
import { SEVERITY_PALETTE } from '../../../lib/governance/severityPalette';
import { FindingEvidencePanel } from './FindingEvidencePanel';

// Pill + Label aus zentraler Palette — siehe src/lib/governance/severityPalette.ts.
const SEVERITY_PILL: Record<FindingSeverity, string> = {
  critical: SEVERITY_PALETTE.critical.pill,
  high:     SEVERITY_PALETTE.high.pill,
  medium:   SEVERITY_PALETTE.medium.pill,
  low:      SEVERITY_PALETTE.low.pill,
  info:     SEVERITY_PALETTE.info.pill,
};

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  critical: SEVERITY_PALETTE.critical.label,
  high:     SEVERITY_PALETTE.high.label,
  medium:   SEVERITY_PALETTE.medium.label,
  low:      SEVERITY_PALETTE.low.label,
  info:     SEVERITY_PALETTE.info.label,
};

const STATUS_LABEL: Record<FindingStatus, string> = {
  open: 'offen', acknowledged: 'bestätigt', fixed: 'behoben',
  false_positive: 'kein Treffer', ignored: 'akzeptiert', resolved: 'geschlossen',
};

const GRADE_COLOR: Record<string, string> = {
  A: 'text-emerald-300', B: 'text-lime-300', C: 'text-amber-300',
  D: 'text-orange-300', F: 'text-rose-300',
};

import { withPerformanceMonitoring } from '../withPerformanceMonitoring';

function _ScanDetailView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const ScanDetailView = withPerformanceMonitoring(
  _ScanDetailView,
  'ScanDetailView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { scanId = '' } = useParams<{ scanId: string }>();
  const [payload, setPayload] = useState<ReportPayload | null | 'loading' | 'not-found'>('loading');
  const [error, setError] = useState<string | null>(null);
  // Increment to force a refetch after a status transition.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!scanId) { setPayload('not-found'); return; }
    let cancelled = false;
    // Only show full loading state on initial load — silent refetch
    // after a status transition keeps the UI from blinking.
    if (reloadKey === 0) setPayload('loading');
    setError(null);
    getScanReport(scanId)
      .then((p) => { if (cancelled) return; setPayload(p === null ? 'not-found' : p); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [scanId, reloadKey]);

  if (error) {
    return <Shell><p className="text-rose-300">{error}</p></Shell>;
  }
  if (payload === 'loading') {
    return <Shell><Loader2 className="h-5 w-5 animate-spin text-titanium-400" /></Shell>;
  }
  if (payload === 'not-found') {
    return (
      <Shell>
        <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto mb-3" />
        <p className="text-titanium-300">Scan nicht gefunden oder kein Zugriff.</p>
      </Shell>
    );
  }
  if (!payload) {
    return <Shell><Loader2 className="h-5 w-5 animate-spin text-titanium-400" /></Shell>;
  }
  return <Detail payload={payload} onReload={() => setReloadKey((n) => n + 1)} />;
}

function Detail({
  payload, onReload,
}: { payload: ReportPayload; onReload: () => void }) {
  const { report, scan_run, all_findings, evidence_catalog } = payload;
  const gradeCls = GRADE_COLOR[report.grade] ?? '';
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-titanium-500 mb-1">
              Scan · {scan_run.detector}
            </div>
            <h1 className="font-display font-bold text-2xl tracking-tight text-titanium-50">
              Compliance-Report
            </h1>
            <p className="font-mono text-[11px] text-titanium-500 mt-1">{report.scan_run_id}</p>
          </div>
          <PdfDownloadButton payload={payload} />
        </div>

        {/* Score block */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-titanium-900">
          <Tile
            label="Score"
            value={
              <span className={`font-display font-bold text-4xl tabular-nums ${gradeCls}`}>
                {report.score}
                <span className="text-base text-titanium-500 ml-1">/100</span>
              </span>
            }
          />
          <Tile
            label="Note"
            value={<span className={`font-display font-bold text-4xl ${gradeCls}`}>{report.grade}</span>}
          />
          <Tile
            label="Befunde"
            value={
              <div>
                <div className="font-display font-bold text-2xl text-titanium-50 tabular-nums">
                  {report.total_findings}
                </div>
                {report.severity_breakdown.critical + report.severity_breakdown.high > 0 ? (
                  <div className="text-[11px] text-rose-300 mt-1">
                    {report.severity_breakdown.critical + report.severity_breakdown.high}
                    {' '}kritisch/hoch
                  </div>
                ) : null}
              </div>
            }
          />
        </section>

        {/* Top findings */}
        <section>
          <h2 className="font-display font-semibold text-titanium-50 mb-3">
            Wichtigste Befunde
          </h2>
          {report.top_findings.length === 0 ? (
            <div className="border border-emerald-500/40 bg-emerald-500/5 p-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-300 shrink-0" />
              <p className="text-sm text-emerald-200">
                Keine Befunde. Dieser Scan zeigt keine Compliance-Verletzungen.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {report.top_findings.map((rf) => {
                const full = all_findings.find((x: Finding) => x.id === rf.id);
                return (
                  <li key={rf.id} className="border border-titanium-800 bg-obsidian-900 p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider border ${SEVERITY_PILL[rf.severity]}`}>
                            {SEVERITY_LABEL[rf.severity]}
                          </span>
                          <span className="text-[11px] font-mono text-titanium-500">{rf.category}</span>
                          <span className="text-[11px] font-mono text-titanium-500">· {STATUS_LABEL[rf.status]}</span>
                        </div>
                        <p className="text-sm text-titanium-100 mb-1">{rf.summary}</p>
                        {rf.evidence ? (
                          <p className="text-[11px] text-brass-300 font-mono">
                            Beleg: {evidenceRefLabel(rf.evidence)}
                          </p>
                        ) : null}
                        {full ? (
                          <FindingEvidencePanel
                            finding={full}
                            onStatusChange={onReload}
                          />
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-titanium-800 bg-obsidian-900 p-4">
            <h3 className="font-display font-semibold text-sm text-titanium-50 mb-3">
              Verteilung nach Schweregrad
            </h3>
            <ul className="space-y-1.5 text-sm">
              {(Object.keys(report.severity_breakdown) as FindingSeverity[]).map((s) => (
                <li key={s} className="flex items-center justify-between font-mono text-[12px]">
                  <span className="text-titanium-400">{SEVERITY_LABEL[s]}</span>
                  <span className="tabular-nums text-titanium-100">{report.severity_breakdown[s]}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-titanium-800 bg-obsidian-900 p-4">
            <h3 className="font-display font-semibold text-sm text-titanium-50 mb-3">
              Verteilung nach Status
            </h3>
            <ul className="space-y-1.5 text-sm">
              {(Object.keys(report.status_breakdown) as FindingStatus[]).map((s) => (
                <li key={s} className="flex items-center justify-between font-mono text-[12px]">
                  <span className="text-titanium-400">{STATUS_LABEL[s]}</span>
                  <span className="tabular-nums text-titanium-100">{report.status_breakdown[s]}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Evidence catalog */}
        {evidence_catalog.length > 0 ? (
          <section>
            <h2 className="font-display font-semibold text-titanium-50 mb-3">
              Beleg-Verzeichnis ({evidence_catalog.length})
            </h2>
            <ul className="space-y-1.5">
              {evidence_catalog.map((e, i) => (
                <li key={i} className="border border-titanium-800 bg-obsidian-900 p-3 text-sm">
                  <div className="text-titanium-200">{evidenceRefLabel(e.ref)}</div>
                  <div className="text-[11px] text-titanium-500 mt-0.5">
                    Belegt {e.supports.length} {e.supports.length === 1 ? 'Befund' : 'Befunde'}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* All findings details */}
        {all_findings.length > report.top_findings.length ? (
          <section>
            <h2 className="font-display font-semibold text-titanium-50 mb-3">
              Alle Befunde ({all_findings.length})
            </h2>
            <p className="text-[12px] text-titanium-500">
              Die vollständige Liste mit raw_payload und Korrelations-IDs ist im PDF-Export enthalten.
            </p>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-obsidian-900 p-4">
      <div className="text-[10px] uppercase tracking-wider text-titanium-500 mb-1">{label}</div>
      {value}
    </div>
  );
}

function Header() {
  return (
    <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
      <Link
        to="/app/scans"
        className="p-1.5 hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
        aria-label="Zurück zur Liste"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <h1 className="font-display font-bold text-sm tracking-tight text-titanium-50">
        Governance · Scan-Detail
      </h1>
    </header>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-12 text-center">{children}</main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PDF download — lazy-loads ReportTemplate + @react-pdf/renderer at
// click time so the 150 kB PDF bundle stays out of the main chunk.
// ─────────────────────────────────────────────────────────────────────

function PdfDownloadButton({ payload }: { payload: ReportPayload }) {
  const [busy, setBusy] = useState<'idle' | 'rendering' | 'error'>('idle');

  async function handleClick() {
    if (busy === 'rendering') return;
    setBusy('rendering');
    try {
      const [{ pdf }, { ReportTemplate }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../../../pdf'),
      ]);
      const blob = await pdf(
        <ReportTemplate
          payload={payload}
          subjectLabel={payload.report.website_id ?? payload.report.scan_run_id}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${payload.report.scan_run_id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBusy('idle');
    } catch (e) {
      console.error('PDF render failed:', e);
      setBusy('error');
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy === 'rendering'}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${
        busy === 'error'
          ? 'border border-rose-500/40 text-rose-200 hover:border-rose-500'
          : 'bg-cyan-400 text-obsidian-950 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed'
      }`}
    >
      {busy === 'rendering' ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> PDF wird erstellt…
        </>
      ) : busy === 'error' ? (
        <>
          <XCircle className="h-4 w-4" /> Fehler — erneut versuchen
        </>
      ) : (
        <>
          <Download className="h-4 w-4" /> PDF herunterladen
        </>
      )}
    </button>
  );
}

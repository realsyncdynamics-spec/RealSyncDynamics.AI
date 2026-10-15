/**
 * Pflichtenliste mit Fortschritt („3 von 5 erledigt") und PDF-Export.
 *
 * Status je Pflicht aus obligationProgress.ts:
 *   - automatisch erkannt (KI-Inventar, Anbieter/AVV, DSFA) — nicht abhakbar
 *   - von Hand abhakbar, gespeichert mit Datum
 *   - „nicht lesbar", wenn die Quelle fehlschlägt (nie still „offen")
 *
 * Nichts wird ausgeführt: Links navigieren, der Haken speichert nur den
 * Haken, der PDF-Export rendert lokal im Browser.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Circle, CircleDashed, Download, Loader2,
} from 'lucide-react';
import type { AiSetup } from '../../activation/aiSetupCatalog';
import {
  countByKind, deriveObligations, EXTERNAL_AI_IDS, joinLabels, type Obligation,
} from './obligationsFromSetup';
import {
  countDone, loadObligationProgress, loadObligationSignals, obligationStatus, setObligationDone,
  type ObligationProgress, type ObligationSignals, type ObligationStatus,
} from './obligationProgress';

interface Props {
  tenantId: string;
  setup: AiSetup;
  company: string;
  reloadKey: number;
}

type ProgressState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; value: ObligationProgress };

const STATE_LABEL: Record<ObligationStatus['state'], string> = {
  done: 'Erledigt',
  partial: 'Teilweise',
  open: 'Offen',
  unknown: 'Nicht lesbar',
};

export function ObligationTracker({ tenantId, setup, company, reloadKey }: Props) {
  const list = useMemo(() => deriveObligations(setup), [setup]);
  const external = useMemo(
    () => setup.aiSystems.filter((id) => (EXTERNAL_AI_IDS as readonly string[]).includes(id)),
    [setup],
  );
  const [signals, setSignals] = useState<ObligationSignals | null>(null);
  const [progress, setProgress] = useState<ProgressState>({ kind: 'loading' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<'idle' | 'rendering' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    setSignals(null);
    setProgress({ kind: 'loading' });
    // loadObligationSignals fängt Teilfehler selbst ab (allSettled).
    void loadObligationSignals(tenantId).then((s) => { if (!cancelled) setSignals(s); });
    loadObligationProgress(tenantId)
      .then((value) => { if (!cancelled) setProgress({ kind: 'ready', value }); })
      .catch(() => { if (!cancelled) setProgress({ kind: 'error' }); });
    return () => { cancelled = true; };
  }, [tenantId, reloadKey]);

  const progressValue = progress.kind === 'ready' ? progress.value : null;
  const statuses = list.map((o) => obligationStatus(
    o,
    signals,
    progress.kind === 'loading' ? {} : progressValue,
    external,
  ));
  const done = countDone(statuses);
  const { duties, checks } = countByKind(list);
  const pct = list.length === 0 ? 0 : Math.round((done / list.length) * 100);

  async function toggle(o: Obligation, next: boolean) {
    setBusyId(o.id);
    setToggleError(null);
    try {
      const value = await setObligationDone(tenantId, o.id, next);
      setProgress({ kind: 'ready', value });
    } catch (err) {
      setToggleError((err as Error)?.message ?? String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function downloadPdf() {
    if (pdfState === 'rendering') return;
    setPdfState('rendering');
    try {
      const [{ pdf }, { ObligationsTemplate }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../../../pdf'),
      ]);
      const name = company.trim() || 'Ihr Unternehmen';
      const blob = await pdf(
        <ObligationsTemplate
          company={name}
          generatedAt={new Date().toISOString()}
          doneCount={done}
          basisSummary={summaryLines(setup)}
          rows={list.map((o, i) => ({
            title: o.title,
            kindLabel: o.kind === 'duty' ? 'Pflicht' : 'Prüfen',
            basis: o.basis,
            since: o.since,
            because: o.because,
            statusLabel: STATE_LABEL[statuses[i].state],
            statusDetail: statuses[i].source === 'auto'
              ? `${statuses[i].detail} (automatisch erkannt)`
              : statuses[i].detail,
          }))}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ki-pflichtenuebersicht.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPdfState('idle');
    } catch (e) {
      console.error('PDF render failed:', e);
      setPdfState('error');
    }
  }

  return (
    <div className="mt-2" data-testid="obligations-list">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-titanium-50" data-testid="obligations-progress">
            {done} von {list.length} erledigt
          </h2>
          <p className="text-[12px] text-titanium-400">
            {duties} {duties === 1 ? 'Pflicht' : 'Pflichten'}
            {checks > 0 && <> · {checks} {checks === 1 ? 'Prüfpunkt' : 'Prüfpunkte'}</>}
            {' '}aus Ihren Angaben
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void downloadPdf(); }}
          disabled={pdfState === 'rendering'}
          className="inline-flex items-center gap-1.5 border border-titanium-700 px-3 py-1.5 text-[12px] font-semibold text-titanium-100 hover:border-[var(--brand-champ)] disabled:opacity-50"
        >
          {pdfState === 'rendering'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            : <Download className="h-3.5 w-3.5" aria-hidden />}
          Als PDF für die Geschäftsführung
        </button>
      </div>
      {pdfState === 'error' && (
        <p className="mt-1 text-[12px] text-amber-300" role="alert">PDF konnte nicht erzeugt werden.</p>
      )}

      <div
        className="mt-3 h-1.5 w-full bg-obsidian-800"
        role="progressbar"
        aria-label="Erledigte Pflichten"
        aria-valuemin={0}
        aria-valuemax={list.length}
        aria-valuenow={done}
      >
        <div className="h-full bg-[var(--brand-champ)] transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-2 divide-y divide-titanium-900">
        {list.map((o, i) => (
          <TrackerRow
            key={o.id}
            o={o}
            status={statuses[i]}
            busy={busyId === o.id}
            canToggle={progress.kind === 'ready'}
            onToggle={(next) => { void toggle(o, next); }}
          />
        ))}
      </ul>
      {toggleError && (
        <p className="mt-1 flex items-start gap-1.5 text-[12px] text-amber-300" role="alert">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
          <span>Speichern fehlgeschlagen: {toggleError}</span>
        </p>
      )}
      <p className="mt-2 text-[11px] text-titanium-600">
        Regelbasiert aus Ihrer Selbstauskunft abgeleitet. Startpunkt, keine Rechtsberatung, kein Score.
        {' '}<Link to="/app/activation" className="underline hover:text-titanium-400">Angaben ändern</Link>
      </p>
    </div>
  );
}

function TrackerRow({ o, status, busy, canToggle, onToggle }: {
  o: Obligation;
  status: ObligationStatus;
  busy: boolean;
  canToggle: boolean;
  onToggle: (next: boolean) => void;
}) {
  const done = status.state === 'done';
  return (
    <li className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-2.5">
        <StatusIcon state={status.state} />
        <div className="min-w-0">
          <p className={`text-sm ${done ? 'text-titanium-400' : 'text-titanium-50'}`}>
            <span
              className={
                'mr-2 inline-block border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider align-middle '
                + (o.kind === 'duty'
                  ? 'border-[var(--brand-champ)] text-[var(--brand-champ)]'
                  : 'border-titanium-700 text-titanium-400')
              }
            >
              {o.kind === 'duty' ? 'Pflicht' : 'Prüfen'}
            </span>
            {o.title}
          </p>
          <p className="mt-0.5 text-[12px] text-titanium-400">
            {o.basis}{o.since && <> · {o.since}</>} · {o.because}
          </p>
          <p
            className={`mt-0.5 text-[11px] ${status.state === 'unknown' ? 'text-amber-300' : done ? 'text-emerald-400' : 'text-titanium-500'}`}
            data-testid={`obligation-status-${o.id}`}
          >
            {status.detail}
            {status.source === 'auto' && status.state !== 'unknown' && ' · automatisch erkannt'}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
        {status.source === 'manual' && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-titanium-300">
            <input
              type="checkbox"
              className="accent-[var(--brand-champ)]"
              checked={done}
              disabled={!canToggle || busy}
              onChange={(e) => onToggle(e.target.checked)}
            />
            {busy ? 'Speichert…' : 'Erledigt'}
          </label>
        )}
        <Link
          to={o.to}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--brand-champ)] hover:underline"
        >
          {o.cta} <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </li>
  );
}

function StatusIcon({ state }: { state: ObligationStatus['state'] }) {
  const cls = 'mt-0.5 h-4 w-4 shrink-0';
  if (state === 'done') return <CheckCircle2 className={`${cls} text-emerald-400`} aria-label="Erledigt" />;
  if (state === 'partial') return <CircleDashed className={`${cls} text-[var(--brand-champ)]`} aria-label="Teilweise" />;
  if (state === 'unknown') return <AlertTriangle className={`${cls} text-amber-300`} aria-label="Nicht lesbar" />;
  return <Circle className={`${cls} text-titanium-600`} aria-label="Offen" />;
}

/** Selbstauskunft in Klartextzeilen für das PDF. */
export function summaryLines(setup: AiSetup): string[] {
  const real = (l: string[]) => l.filter((x) => x !== 'none');
  const lines: string[] = [];
  if (real(setup.aiSystems).length) lines.push(`KI-Systeme: ${joinLabels(real(setup.aiSystems))}`);
  if (real(setup.botsAgents).length) lines.push(`Bots/Agenten: ${joinLabels(real(setup.botsAgents))}`);
  if (setup.dataClasses.length) lines.push(`Daten: ${joinLabels(setup.dataClasses)}`);
  return lines;
}

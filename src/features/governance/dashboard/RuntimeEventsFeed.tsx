/**
 * Runtime-Events-Feed auf `/app/dashboard` (Detailansicht).
 *
 * Zeigt die letzten Governance-Entscheidungen aus `workspace_events`:
 * Agent, Ereignis, angefragte Aktion, Entscheidung (erlaubt / Freigabe nötig),
 * Zeitpunkt und Herkunftsnachweis (Payload-Hash). Nur lesend. Workspace-
 * Freigaben (`workspace_approvals`) haben noch keine Frontend-Ansicht; der
 * Feed verlinkt deshalb nicht auf `/app/approvals` (liest nur
 * `governance_approvals`).
 *
 * Zustände: Laden · Quelle nicht eingerichtet · Fehler mit „Erneut laden“ ·
 * leer · Liste. Keine Demo-Daten (siehe runtimeEventsFeedData.ts).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { getSupabase } from '../../../lib/supabase';
import {
  DECISION_LABEL,
  loadRuntimeEvents,
  shortHash,
  type RuntimeEventsState,
} from './runtimeEventsFeedData';

interface Props {
  activeTenantId: string | null;
  /** Erhöht sich bei „Erneut laden“ des Dashboards. */
  reloadKey: number;
  /** Mandanten-Datenereignisse (`useTenantDataVersion`). */
  dataVersion: number;
}

const TIME_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : TIME_FORMAT.format(date);
}

export function RuntimeEventsFeed({ activeTenantId, reloadKey, dataVersion }: Props) {
  const [state, setState] = useState<RuntimeEventsState>({ kind: 'loading' });
  const [localReload, setLocalReload] = useState(0);
  const retry = useCallback(() => setLocalReload((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) {
      setState({ kind: 'value', events: [] });
      return;
    }
    setState({ kind: 'loading' });
    loadRuntimeEvents(getSupabase(), activeTenantId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => { cancelled = true; };
  }, [activeTenantId, reloadKey, dataVersion, localReload]);

  return (
    <section
      aria-labelledby="runtime-events-heading"
      data-testid="runtime-events-feed"
      data-state={state.kind}
      className="mx-4 sm:mx-6 mb-4 border border-titanium-900 bg-obsidian-900 px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-titanium-900">
        <h2
          id="runtime-events-heading"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--brand-champ)] flex items-center gap-1.5"
        >
          <Activity className="h-3.5 w-3.5" aria-hidden />
          Runtime-Events
        </h2>
        <span className="font-mono text-[10px] text-titanium-500">Quelle: workspace_events (RLS)</span>
      </div>

      <div className="mt-3" aria-live="polite" aria-busy={state.kind === 'loading'}>
        {state.kind === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-titanium-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Events werden geladen …
          </p>
        )}

        {state.kind === 'unavailable' && (
          <p className="text-sm text-titanium-400" data-testid="runtime-events-unavailable">
            Der Event-Eingang ist für dieses Projekt noch nicht eingerichtet. Sobald Flows über
            {' '}<span className="font-mono">workspace-events</span>{' '}melden, erscheinen ihre
            Entscheidungen hier.
          </p>
        )}

        {state.kind === 'error' && (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-amber-300">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <span>Events nicht lesbar: {state.message}</span>
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-1 border border-titanium-700 px-2 py-1 font-mono text-[11px] text-titanium-200 hover:bg-obsidian-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00B8D4]"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Erneut laden
            </button>
          </div>
        )}

        {state.kind === 'value' && state.events.length === 0 && (
          <p className="text-sm text-titanium-400" data-testid="runtime-events-empty">
            Noch keine Runtime-Events. Einen Flow verbindest du über einen{' '}
            <Link to="/app/keys" className="underline hover:text-titanium-100">Ingest-Schlüssel</Link>.
          </p>
        )}

        {state.kind === 'value' && state.events.length > 0 && (
          <ol className="divide-y divide-titanium-900" data-testid="runtime-events-list">
            {state.events.map((event) => (
              <li key={event.id} className="py-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <time dateTime={event.receivedAt} className="font-mono text-[11px] text-titanium-500 w-24 shrink-0">
                  {formatTime(event.receivedAt)}
                </time>
                <span className="font-mono text-[11px] text-titanium-300 shrink-0">{event.agentId}</span>
                <span className="text-sm text-titanium-100 min-w-0 break-words">
                  <span className="font-mono">{event.eventType}</span>
                  {' → '}
                  <span className="font-mono">{event.requestedAction}</span>
                </span>
                {/* Kein Link auf /app/approvals: Diese Ansicht liest governance_approvals,
                    Workspace-Freigaben liegen in workspace_approvals (noch ohne Frontend). */}
                <span
                  data-decision={event.decision}
                  className={`ml-auto font-mono text-[11px] px-1.5 py-0.5 border ${
                    event.decision === 'allow'
                      ? 'border-emerald-700 text-emerald-300'
                      : 'border-amber-700 text-amber-300'
                  }`}
                >
                  {DECISION_LABEL[event.decision]}
                </span>
                <span
                  className="basis-full font-mono text-[10px] text-titanium-600 break-all"
                  title={`Herkunftsnachweis (SHA-256): ${event.payloadHash}`}
                >
                  {event.resourceId} · Herkunftsnachweis {shortHash(event.payloadHash)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

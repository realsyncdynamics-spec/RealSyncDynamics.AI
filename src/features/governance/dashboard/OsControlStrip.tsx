/**
 * WP4 — OS-Kachelreihe im Command Center (/app/dashboard), direkt nach
 * HandoffOverview: KI-Inventar · Bots/Agenten · Residualrisiko · Freigaben ·
 * Evidence. Kein zweites Dashboard; Quellen und Ableitung in osControlSources.ts.
 *
 * Nur Anzeige und Links. Nächste Maßnahmen lösen Menschen aus — es gibt hier
 * keine Auto-Ausführung.
 */
import { Link } from 'react-router-dom';
import type { CockpitData } from '../cockpit/cockpitData';
import { Panel } from '../handoff/ui';
import { useTenantLoad } from '../handoff/useTenantLoad';
import { buildOsTiles, loadOsControlSources, type OsTileModel } from './osControlSources';

function OsTile({ tile, onRetry }: { tile: OsTileModel; onRetry?: () => void }) {
  const { state } = tile;
  const testId = `os-tile-${tile.id}`;
  return (
    <Panel testId={testId} className="flex flex-col gap-1">
      <div className="rs-kpi__label">{tile.label}</div>
      {state.kind === 'loading' && (
        <div className="rs-kpi__value" aria-busy="true" data-testid={`${testId}-loading`}>—</div>
      )}
      {state.kind === 'error' && (
        <div role="alert" data-testid={`${testId}-error`}>
          <div className="rs-kpi__value">—</div>
          <div className="rs-kpi__sub">{state.message}</div>
          {onRetry && (
            <button type="button" className="rs-chip-sm mt-2" onClick={onRetry} data-testid={`${testId}-retry`}>
              Erneut laden
            </button>
          )}
        </div>
      )}
      {state.kind === 'empty' && (
        <div className="rs-kpi__sub mt-2" data-testid={`${testId}-empty`}>{state.message}</div>
      )}
      {state.kind === 'data' && (
        <>
          <div className="rs-kpi__value" data-testid={`${testId}-value`}>
            {state.value === null ? '—' : state.value}
            {state.value !== null && state.unit ? <span className="rs-kpi__sub"> {state.unit}</span> : null}
          </div>
          {state.detail ? <div className="rs-kpi__sub">{state.detail}</div> : null}
        </>
      )}
      {tile.facts.map((fact) => (
        <div key={fact} className="rs-kpi__sub" data-testid={`${testId}-fact`}>{fact}</div>
      ))}
      <p className="rs-note mt-1">{tile.source}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <Link to={tile.to} className="rs-chip-sm" data-testid={`${testId}-link`}>
          {tile.linkLabel}
        </Link>
        {tile.extraLink && (
          <Link to={tile.extraLink.to} className="rs-chip-sm" data-testid={`${testId}-extra-link`}>
            {tile.extraLink.label}
          </Link>
        )}
      </div>
    </Panel>
  );
}

export function OsControlStrip({
  activeTenantId,
  data,
  loading = false,
  error = null,
  onRetry,
  reloadKey = 0,
}: {
  activeTenantId: string | null;
  data: CockpitData | null;
  loading?: boolean;
  /** loadCockpitData abgelehnt — betrifft nur Risiko-, Freigaben- und Evidence-Kachel. */
  error?: string | null;
  onRetry?: () => void;
  /** Erhöht beim „Erneut laden“ des Dashboards — lädt auch diese Quellen neu. */
  reloadKey?: number;
}) {
  const [state, reload] = useTenantLoad(activeTenantId, loadOsControlSources, [reloadKey]);
  if (!activeTenantId) return null;

  const tiles = buildOsTiles({ data, loading, error }, state);
  const retryFor = (tile: OsTileModel) =>
    tile.id === 'inventory' || tile.id === 'agents' ? reload : onRetry;

  return (
    <section className="rs-apppage rs-ui" aria-label="Command Center" data-testid="os-control-strip">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="rs-overline">Command Center</span>
        <span className="rs-note">
          Inventar · Agenten · Risiko · Freigaben · Evidence des aktiven Mandanten — Maßnahmen lösen Menschen aus, keine Auto-Ausführung.
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map((tile) => (
          <OsTile key={tile.id} tile={tile} onRetry={retryFor(tile)} />
        ))}
      </div>
    </section>
  );
}

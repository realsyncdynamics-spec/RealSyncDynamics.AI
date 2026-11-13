/**
 * Vorschau der Hülle. Fixture-Mandanten, Beispieldaten, keine Datenbank.
 * `/design/app-shell` ist öffentlich und noindex.
 * `/app/preview` liegt hinter AppGate und setzt den Guard-Stapel durch.
 */
import { useMemo, useState } from 'react';
import { useTenant } from '../core/access/TenantProvider';
import { AppShell } from './AppShell';
import { areaById, type AppAreaId } from './areas';
import { GuardStack } from './GuardStack';
import { breadcrumbs, isListed, routesInArea } from './registry';
import { APP_ROUTES } from './routes.config';

/** Zahlen aus dem UI-Konzept, nicht aus einem Mandanten. */
const SAMPLE_METRICS = [
  { label: 'KI-Systeme', value: '12' },
  { label: 'Policy-Events', value: '184' },
  { label: 'Freigaben offen', value: '03' },
  { label: 'Evidence', value: '41' },
] as const;

const SAMPLE_EVENTS = [
  { title: 'Policy geprüft', target: 'support-agent', state: 'ok' as const, time: '09:41' },
  { title: 'Policy geprüft', target: 'support-agent', state: 'open' as const, time: '09:41' },
  { title: 'Evidence gesichert', target: 'audit-event', state: 'ok' as const, time: '09:39' },
  { title: 'Aktion blockiert', target: 'external-model', state: 'open' as const, time: '09:38' },
];

export function AppShellPreview({ enforceGuards = false }: { enforceGuards?: boolean }) {
  const tenant = useTenant();
  const [areaId, setAreaId] = useState<AppAreaId>('dashboard');
  const area = areaById(areaId);
  const home = APP_ROUTES.find((route) => route.nav && route.area === areaId);
  const crumbs = breadcrumbs(area.home);
  const listed = useMemo(
    () => routesInArea(areaId).filter((route) => route.kind === 'page' && isListed(route, tenant.featureFlags)),
    [areaId, tenant.featureFlags],
  );

  const body = (
    <>
      <p className="app-shell__banner">
        <span className="app-shell__badge">UI-Konzept · Beispieldaten</span>
        Keine produktive Oberfläche. Zahlen und Ereignisse sind keine Mandantendaten.
      </p>
      <ol className="app-shell__crumbs" aria-label="Brotkrumen">
        {crumbs.map((crumb) => (
          <li key={`${crumb.label}:${crumb.path}`}>{crumb.label}</li>
        ))}
      </ol>
      {areaId === 'dashboard' ? (
        <>
          <ul className="app-shell__kpis">
            {SAMPLE_METRICS.map((metric) => (
              <li key={metric.label}>
                <p>{metric.label}</p>
                <strong>{metric.value}</strong>
                <span>Beispieldaten</span>
              </li>
            ))}
          </ul>
          <ul className="app-shell__events">
            {SAMPLE_EVENTS.map((event, index) => (
              <li key={`${event.title}-${event.time}-${index}`} data-state={event.state}>
                <span>{event.title}</span>
                <span className="app-shell__meta">{event.target}</span>
                <span className="app-shell__pill">{event.state === 'ok' ? 'OK' : 'Offen'}</span>
                <time>{event.time}</time>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <article className="app-shell__panel">
          <p>{area.description}</p>
          <ul className="app-shell__routes">
            {listed.map((route) => (
              <li key={route.path}>
                <span>{route.title}</span>
                <span className="app-shell__meta">{route.path}</span>
              </li>
            ))}
          </ul>
        </article>
      )}
    </>
  );

  return (
    <AppShell areaId={areaId} onArea={setAreaId}>
      {enforceGuards && home ? <GuardStack guard={home.guard}>{body}</GuardStack> : body}
    </AppShell>
  );
}

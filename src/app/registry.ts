/**
 * Ableitungen aus dem Routenregister: Navigation, Treffer, Breadcrumbs.
 */
import { APP_AREAS, areaById, type AppAreaId } from './areas';
import type { AppRouteConfig } from './routes.config';
import { APP_ROUTES } from './routes.config';

export interface NavEntry {
  id: AppAreaId;
  label: string;
  path: string;
  description: string;
}

export interface Crumb {
  label: string;
  path: string;
}

function segments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

/** Höherer Wert = speziellerer Treffer. null = kein Treffer. */
export function matchScore(pattern: string, pathname: string): number | null {
  const left = segments(pattern);
  const right = segments(pathname);
  if (left.length !== right.length) return null;
  let statics = 0;
  for (let i = 0; i < left.length; i += 1) {
    const token = left[i];
    if (!token || !right[i]) return null;
    if (token.startsWith(':')) continue;
    if (token !== right[i]) return null;
    statics += 1;
  }
  return statics;
}

export function matchRoute(pathname: string, routes: readonly AppRouteConfig[] = APP_ROUTES): AppRouteConfig | null {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  let best: AppRouteConfig | null = null;
  let bestScore = -1;
  for (const route of routes) {
    const score = matchScore(route.path, path);
    if (score === null || score < bestScore) continue;
    best = route;
    bestScore = score;
  }
  return best;
}

/** Genau acht Einträge, in der Reihenfolge der Bereiche. */
export function navigationModel(routes: readonly AppRouteConfig[] = APP_ROUTES): NavEntry[] {
  return APP_AREAS.map((area) => {
    const home = routes.find((route) => route.nav && route.area === area.id && route.path === area.home);
    if (!home) throw new Error(`Bereich ${area.id} hat keine Heimroute ${area.home}`);
    return { id: area.id, label: area.label, path: home.path, description: area.description };
  });
}

export function routesInArea(area: AppAreaId, routes: readonly AppRouteConfig[] = APP_ROUTES): AppRouteConfig[] {
  return routes.filter((route) => route.area === area);
}

/** Flaggen blenden aus der Liste aus. Der Pfad selbst bleibt gültig. */
export function isListed(route: AppRouteConfig, flags: Readonly<Record<string, boolean>>): boolean {
  if (!route.flag) return true;
  return flags[route.flag] === true;
}

export function breadcrumbs(pathname: string, routes: readonly AppRouteConfig[] = APP_ROUTES): Crumb[] {
  const matched = matchRoute(pathname, routes);
  const resolved = matched?.kind === 'redirect' && matched.redirectTo
    ? matchRoute(matched.redirectTo, routes) ?? matched
    : matched;
  const area = areaById(resolved?.area ?? 'dashboard');
  const crumbs: Crumb[] = [
    { label: 'App', path: '/app/dashboard' },
    { label: area.label, path: area.home },
  ];
  if (resolved && resolved.path !== area.home && resolved.kind === 'page') {
    crumbs.push({ label: resolved.title, path: resolved.path });
  }
  return crumbs;
}

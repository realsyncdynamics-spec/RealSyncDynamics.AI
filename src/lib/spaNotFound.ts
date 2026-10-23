/**
 * Echter 404-Status für unbekannte SPA-Pfade auf Cloudflare Pages.
 *
 * `public/_redirects` schickt jeden Pfad ohne Datei per `/* /index.html 200`
 * auf die SPA-Shell; der Statuscode wäre also immer 200, auch wenn React
 * anschließend „Seite nicht gefunden“ zeigt. `functions/_middleware.ts` ruft
 * `withSpaNotFoundStatus` nach `context.next()` auf: Liefert die Antwort HTML
 * für einen Pfad, den keine Route aus `src/App.tsx` kennt, wird daraus 404 —
 * mit dem vorgerenderten `dist/404.html` als Inhalt, falls vorhanden. Die
 * Shell lädt dieselben Bundles, die Ansicht im Browser bleibt unverändert.
 *
 * Bewusst nur HTML mit Status 200: Redirects (301/308), JSON der Functions,
 * echte Assets und Fehlerantworten bleiben unangetastet.
 */
import { SPA_ROUTE_PATTERNS } from '../config/spaRoutes.generated';

/** Übersetzt ein React-Router-Muster (`/x/:id`, `/x/*`) in einen RegExp — wie RR: ohne Groß/Klein, `/` am Ende optional. */
export function spaRouteRegExp(pattern: string): RegExp | null {
  if (pattern === '*') return null;
  let source = '';
  for (const segment of pattern.split('/').filter(Boolean)) {
    if (segment === '*') {
      source += '(?:/.*)?';
    } else if (segment.startsWith(':')) {
      source += '/[^/]+';
    } else {
      source += `/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
    }
  }
  return new RegExp(`^${source}/?$`, 'i');
}

const MATCHERS = SPA_ROUTE_PATTERNS.map(spaRouteRegExp).filter((re): re is RegExp => re !== null);

/** Kennt eine Route aus App.tsx diesen Pfad? */
export function isKnownSpaPath(pathname: string): boolean {
  let path = pathname;
  try { path = decodeURI(pathname); } catch { /* ungültige Kodierung: roh prüfen */ }
  return MATCHERS.some((re) => re.test(path));
}

/**
 * Macht aus der SPA-Shell für einen unbekannten Pfad eine 404-Antwort.
 * `loadNotFoundPage` liefert den vorgerenderten 404-Inhalt (oder `null`).
 */
export async function withSpaNotFoundStatus(
  request: Request,
  response: Response,
  loadNotFoundPage: () => Promise<Response | null>,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return response;
  if (response.status !== 200) return response;
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response;
  if (isKnownSpaPath(new URL(request.url).pathname)) return response;

  const headers = new Headers(response.headers);
  headers.set('x-robots-tag', 'noindex');
  let body: BodyInit | null = response.body;
  if (request.method === 'GET') {
    const page = await loadNotFoundPage().catch(() => null);
    if (page && page.body && (page.headers.get('content-type') ?? '').includes('text/html')) {
      await response.body?.cancel().catch(() => {});
      body = page.body;
      // Anderer Inhalt als die Shell: deren ETag und Länge gelten nicht mehr.
      headers.delete('etag');
      headers.delete('content-length');
    }
  }
  return new Response(request.method === 'HEAD' ? null : body, { status: 404, statusText: 'Not Found', headers });
}

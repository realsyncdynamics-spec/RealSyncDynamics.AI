// @vitest-environment node
/**
 * Echter 404-Status für unbekannte Pfade (functions/_middleware.ts →
 * src/lib/spaNotFound.ts). Vorher lieferte Cloudflare Pages über den
 * `/* /index.html 200`-Fallback für jeden Pfad HTTP 200 samt Startseiten-HTML
 * (gemessen 2026-10-23: `/gibtsnicht123` → 200, Titel der Startseite).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractSpaRoutes, renderModule } from '../../scripts/sync-spa-routes.mjs';
import { isKnownSpaPath, spaRouteRegExp, withSpaNotFoundStatus } from '../../src/lib/spaNotFound';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const html = (body = '<html>shell</html>', extra: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', etag: '"shell"', ...extra } });
const get = (path: string, method = 'GET') => new Request(`https://realsyncdynamicsai.de${path}`, { method });
const notFoundPage = async () => new Response('<html>404-Seite</html>', { headers: { 'content-type': 'text/html' } });

describe('Routenliste für die Middleware', () => {
  it('ist mit src/App.tsx und der Legacy-Map synchron (npm run sync:spa-routes)', () => {
    const routes = extractSpaRoutes(read('src/App.tsx'), read('src/enterprise-os/legacyRouteMap.ts'));
    expect(read('src/config/spaRoutes.generated.ts')).toBe(renderModule(routes));
    expect(routes.length).toBeGreaterThan(400);
    expect(routes).not.toContain('*');
  });

  it('läuft im Build vor vite build', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['build:base']).toMatch(/^npm run sync:spa-routes && vite build/);
  });
});

describe('Matcher wie React Router', () => {
  it('übersetzt Parameter und Splats', () => {
    expect(spaRouteRegExp('*')).toBeNull();
    expect(spaRouteRegExp('/builder/:slug')!.test('/builder/acme')).toBe(true);
    expect(spaRouteRegExp('/builder/:slug')!.test('/builder/acme/x')).toBe(false);
    expect(spaRouteRegExp('/flow/*')!.test('/flow')).toBe(true);
    expect(spaRouteRegExp('/flow/*')!.test('/flow/checkout/starter')).toBe(true);
  });

  it.each([
    '/', '/pricing', '/pricing/', '/PRICING', '/pricing/growth', '/app/dashboard', '/builder/acme',
    '/flow/start-scan', '/os/app/irgendwas/tief', '/roadmap', '/legal/widerruf', '/blog',
  ])('kennt %s', (path) => {
    expect(isKnownSpaPath(path)).toBe(true);
  });

  it.each(['/gibtsnicht123', '/pricing/growth/extra', '/assets/alt-chunk.js', '/wp-login.php'])('kennt %s nicht', (path) => {
    expect(isKnownSpaPath(path)).toBe(false);
  });
});

describe('withSpaNotFoundStatus', () => {
  it('macht aus der Shell für einen unbekannten Pfad 404 mit der 404-Seite', async () => {
    const res = await withSpaNotFoundStatus(get('/gibtsnicht123'), html(), notFoundPage);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('<html>404-Seite</html>');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    expect(res.headers.get('etag')).toBeNull();
  });

  it('behält den Shell-Inhalt, wenn keine 404-Seite geladen werden kann', async () => {
    const res = await withSpaNotFoundStatus(get('/gibtsnicht123'), html(), async () => null);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('<html>shell</html>');
  });

  it('antwortet auf HEAD mit 404 ohne Inhalt', async () => {
    const res = await withSpaNotFoundStatus(get('/gibtsnicht123', 'HEAD'), html(), notFoundPage);
    expect(res.status).toBe(404);
    expect(res.body).toBeNull();
  });

  it('lässt bekannte Routen, Redirects, JSON und Nicht-GET unverändert', async () => {
    const known = html();
    expect(await withSpaNotFoundStatus(get('/app/dashboard'), known, notFoundPage)).toBe(known);

    const redirect = new Response(null, { status: 301, headers: { location: '/pricing' } });
    expect(await withSpaNotFoundStatus(get('/preise'), redirect, notFoundPage)).toBe(redirect);

    const json = new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    expect(await withSpaNotFoundStatus(get('/api/fn/unbekannt'), json, notFoundPage)).toBe(json);

    const post = html();
    expect(await withSpaNotFoundStatus(get('/gibtsnicht123', 'POST'), post, notFoundPage)).toBe(post);
  });
});

describe('Verdrahtung', () => {
  it('die Middleware ruft withSpaNotFoundStatus nach context.next() auf', () => {
    const mw = read('functions/_middleware.ts');
    expect(mw).toMatch(/const response = await context\.next\(\);[\s\S]*withSpaNotFoundStatus\(/);
    expect(mw).toContain("new URL('/404', context.request.url)");
  });

  it('der Prerender schreibt dist/404.html, der Deploy überschreibt sie nicht', () => {
    expect(read('scripts/prerender.mjs')).toContain("join(DIST, '404.html')");
    expect(read('.github/workflows/deploy-cloudflare-pages.yml')).toContain('[ -f dist/404.html ] || cp dist/index.html dist/404.html');
  });
});

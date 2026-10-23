import { evaluateCsrf } from '../src/lib/csrf';
import { withSpaNotFoundStatus } from '../src/lib/spaNotFound';

interface PagesEnv {
  /** Statische Auslieferung von dist/ (Cloudflare Pages, ohne Functions). */
  ASSETS?: { fetch: (input: Request | string | URL, init?: RequestInit) => Promise<Response> };
}

/**
 * CSRF für mutierende Requests gegen die Pages-Origin.
 * GET/HEAD/OPTIONS unverändert (inkl. GET /csrf).
 * Kein Eingriff in Supabase-Edge (andere Origin, kein SPA-Cookie).
 *
 * Danach: unbekannte SPA-Pfade bekommen HTTP 404 statt der 200-Shell aus dem
 * `/* /index.html 200`-Fallback (siehe src/lib/spaNotFound.ts). Inhalt ist das
 * vorgerenderte dist/__not-found.html (scripts/prerender.mjs; bewusst nicht
 * 404.html — die schaltet auf Pages den SPA-Fallback ab).
 */
export async function onRequest(context: {
  request: Request;
  env?: PagesEnv;
  next: () => Promise<Response>;
}): Promise<Response> {
  const verdict = evaluateCsrf(context.request);
  if (!verdict.ok) {
    return new Response(JSON.stringify({ ok: false, error: { code: verdict.code, message: 'csrf rejected' } }), {
      status: verdict.status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  const response = await context.next();
  const assets = context.env?.ASSETS;
  return withSpaNotFoundStatus(context.request, response, async () =>
    assets ? assets.fetch(new URL('/__not-found', context.request.url)) : null,
  );
}

import { evaluateCsrf } from '../src/lib/csrf';

/**
 * CSRF für mutierende Requests gegen die Pages-Origin.
 * GET/HEAD/OPTIONS unverändert (inkl. GET /csrf).
 * Kein Eingriff in Supabase-Edge (andere Origin, kein SPA-Cookie).
 */
export async function onRequest(context: { request: Request; next: () => Promise<Response> }): Promise<Response> {
  const verdict = evaluateCsrf(context.request);
  if (!verdict.ok) {
    return new Response(JSON.stringify({ ok: false, error: { code: verdict.code, message: 'csrf rejected' } }), {
      status: verdict.status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  return context.next();
}

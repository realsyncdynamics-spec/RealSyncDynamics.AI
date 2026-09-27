/**
 * CSRF-Proxy: POST /api/fn/<allowlisted> → Supabase Edge.
 * Cookie der SPA geht nicht mit. evaluateCsrf trotzdem (Defense in depth).
 */
import { evaluateCsrf } from '../../../src/lib/csrf';
import { normalizeFnName } from '../../../src/lib/fn-proxy';

const SUPABASE_URL = 'https://ebljyceifhnlzhjfyxup.supabase.co';
const ANON_KEY = 'sb_publishable_BqKKWFM8zcb8R5NXifVgjA_pIYunrhB';

const MAX_BODY = 2 * 1024 * 1024;
const ALLOWED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type PagesContext = {
  request: Request;
  params: { name?: string | string[] };
};

function json(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, params } = context;
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  if (!ALLOWED_METHODS.has(method)) return json(405, 'METHOD_NOT_ALLOWED', 'use POST');

  const csrf = evaluateCsrf(request);
  if (!csrf.ok) return json(csrf.status, csrf.code, 'csrf rejected');

  const name = normalizeFnName(params.name);
  if (!name) return json(404, 'FN_PROXY_UNKNOWN', 'function not proxied');

  const len = Number(request.headers.get('content-length') ?? '0');
  if (len > MAX_BODY) return json(413, 'FN_PROXY_BODY', 'body too large');

  let body: ArrayBuffer | undefined;
  if (method !== 'DELETE') {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY) return json(413, 'FN_PROXY_BODY', 'body too large');
  }

  const auth = request.headers.get('authorization') ?? request.headers.get('Authorization');
  const ct = request.headers.get('content-type') ?? 'application/json';
  const headers: Record<string, string> = {
    'content-type': ct,
    apikey: ANON_KEY,
  };
  if (auth?.startsWith('Bearer ')) headers.authorization = auth;

  const target = `${SUPABASE_URL}/functions/v1/${name}`;
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
    });
  } catch {
    return json(502, 'FN_PROXY_UPSTREAM', 'edge unreachable');
  }

  const out = new Headers();
  const pass = upstream.headers.get('content-type');
  if (pass) out.set('content-type', pass);
  out.set('cache-control', 'no-store');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

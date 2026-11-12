/**
 * Lesender Pages-Endpunkt. Fragen bleiben im Browser.
 * Rate-Limit im Isolate, kein Speichern der Anfrage.
 */
import { loadCompanyFacts } from './second-brain';
import type { CompanyVoiceEnv } from './types';

const WINDOW_MS = 60_000;
const LIMIT = 20;

const defaultHits = new Map<string, number[]>();

export function takeRateLimit(
  key: string,
  now: number,
  store: Map<string, number[]> = defaultHits,
  limit = LIMIT,
  windowMs = WINDOW_MS,
): boolean {
  const recent = (store.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    store.set(key, recent);
    return false;
  }
  recent.push(now);
  store.set(key, recent);
  return true;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function clientKey(request: Request): string {
  const raw = request.headers.get('cf-connecting-ip') ?? 'local';
  return raw.slice(0, 64);
}

export async function handleCompanyVoiceRequest(
  request: Request,
  env: CompanyVoiceEnv,
  deps?: {
    fetchImpl?: typeof fetch;
    now?: () => number;
    store?: Map<string, number[]>;
    timeoutMs?: number;
  },
): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  if (request.method !== 'GET') {
    return json(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'use GET' } });
  }
  const now = deps?.now?.() ?? Date.now();
  if (!takeRateLimit(clientKey(request), now, deps?.store)) {
    return json(429, { ok: false, error: { code: 'RATE_LIMIT', message: 'too many requests' } });
  }
  const payload = await loadCompanyFacts(env, { fetchImpl: deps?.fetchImpl, timeoutMs: deps?.timeoutMs });
  // Kein Import aus grok-relay (Zyklus): gleiche Bedingung wie `resolveGrokLive`, ohne den Key zu lesen.
  const live = env.COMPANY_VOICE_GROK_ENABLED === 'true' && Boolean(env.XAI_API_KEY?.trim());
  return json(200, live ? { ...payload, ai: 'grok-realtime' } : payload);
}

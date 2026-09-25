import { describe, expect, it, vi } from 'vitest';
import {
  AiGatewayEdgeClient,
  AiGatewayEdgeError,
  parseRetryAfter,
  type EdgeClientAuth,
} from '../../../src/core/ai-gateway/edgeClient';
import type { AiGatewayRequest } from '../../../src/core/ai-gateway/types';

// Vertrag RSD Backend (vorläufig): Nutzer-JWT als Bearer, Anon-Key als
// apikey, tenant_id Pflicht; Fehler { ok:false, error:{ code, message } }.

const OK = {
  ok: true,
  provider: 'openai',
  model: 'gpt',
  profile: 'cloud-fallback',
  output: 'hallo',
  trace_id: 't',
  latency_ms: 1,
};

function json(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function req(overrides: Partial<AiGatewayRequest> = {}): AiGatewayRequest {
  return { feature: 'kodee_chat', task_type: 'chat', model_profile: 'cloud-fallback', input: 'hi', tenant_id: 'tenant-1', ...overrides };
}

function client(fetchImpl: typeof fetch, auth?: EdgeClientAuth) {
  return new AiGatewayEdgeClient({ supabaseUrl: 'https://x.supabase.co', apiKey: 'anon-key', fetchImpl, auth });
}

const user = (token: string | null): EdgeClientAuth => ({ mode: 'user', getAccessToken: async () => token });

function sent(fetchImpl: ReturnType<typeof vi.fn>): { headers: Record<string, string>; body: Record<string, unknown> } {
  const init = fetchImpl.mock.calls[0]![1] as RequestInit;
  return { headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
}

describe('AiGatewayEdgeClient — Nutzer-Modus', () => {
  it('sendet das Nutzer-JWT als Bearer, behält apikey und tenant_id im Body', async () => {
    const fetchImpl = vi.fn(async () => json(OK));
    await client(fetchImpl as unknown as typeof fetch, user('user-jwt')).generate(req());
    const { headers, body } = sent(fetchImpl);
    expect(headers.authorization).toBe('Bearer user-jwt');
    expect(headers.apikey).toBe('anon-key');
    expect(body).toMatchObject({ op: 'generate', tenant_id: 'tenant-1' });
  });

  it('wirft UNAUTHORIZED ohne Sitzung und sendet nichts (kein Anon-Rückfall)', async () => {
    const fetchImpl = vi.fn(async () => json(OK));
    const err = await client(fetchImpl as unknown as typeof fetch, user(null)).generate(req()).catch((e) => e);
    expect(err).toBeInstanceOf(AiGatewayEdgeError);
    expect(err).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('wirft BAD_REQUEST ohne tenant_id und sendet nichts', async () => {
    const fetchImpl = vi.fn(async () => json(OK));
    const err = await client(fetchImpl as unknown as typeof fetch, user('jwt')).generate(req({ tenant_id: null })).catch((e) => e);
    expect(err).toMatchObject({ status: 400, code: 'BAD_REQUEST' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('nutzt denselben Ausweis im Stream-Pfad (Builder)', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"event":"done"}\n', { status: 200 }));
    const chunks = [];
    for await (const c of client(fetchImpl as unknown as typeof fetch, user('builder-jwt')).stream(req({ feature: 'app_builder_code' }))) chunks.push(c);
    const { headers, body } = sent(fetchImpl);
    expect(headers.authorization).toBe('Bearer builder-jwt');
    expect(headers.apikey).toBe('anon-key');
    expect(body).toMatchObject({ op: 'stream', tenant_id: 'tenant-1', feature: 'app_builder_code' });
  });

  it('Stream ohne Sitzung: UNAUTHORIZED, kein fetch', async () => {
    const fetchImpl = vi.fn();
    const it = client(fetchImpl as unknown as typeof fetch, user(null)).stream(req());
    await expect(it[Symbol.asyncIterator]().next()).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('AiGatewayEdgeClient — anonymer Modus (ausdrücklich)', () => {
  it('sendet nur den apikey, keinen Bearer', async () => {
    const fetchImpl = vi.fn(async () => json(OK));
    await client(fetchImpl as unknown as typeof fetch, { mode: 'anon' }).generate(req({ tenant_id: null }));
    const { headers } = sent(fetchImpl);
    expect(headers.apikey).toBe('anon-key');
    expect(headers.authorization).toBeUndefined();
  });

  it('ohne auth bleibt das Altverhalten (Anon-Key als Bearer) für nicht umgestellte Aufrufer', async () => {
    const fetchImpl = vi.fn(async () => json(OK));
    await client(fetchImpl as unknown as typeof fetch).generate(req());
    expect(sent(fetchImpl).headers.authorization).toBe('Bearer anon-key');
  });
});

describe('Fehlerparsing', () => {
  const cases: Array<[number, string]> = [
    [400, 'BAD_REQUEST'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [403, 'POLICY_BLOCKED'],
    [403, 'APPROVAL_REQUIRED'],
  ];
  it.each(cases)('HTTP %i %s → typisierter Fehler', async (status, code) => {
    const fetchImpl = vi.fn(async () => json({ ok: false, error: { code, message: 'nein' } }, status));
    const err = await client(fetchImpl as unknown as typeof fetch, user('jwt')).generate(req()).catch((e) => e);
    expect(err).toBeInstanceOf(AiGatewayEdgeError);
    expect(err).toMatchObject({ status, code, message: 'nein', retryAfter: undefined });
  });

  it('429 RATE_LIMITED mit Retry-After in Sekunden', async () => {
    const fetchImpl = vi.fn(async () => json({ ok: false, error: { code: 'RATE_LIMITED', message: 'langsam' } }, 429, { 'retry-after': '12' }));
    const err = await client(fetchImpl as unknown as typeof fetch, user('jwt')).generate(req()).catch((e) => e);
    expect(err).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfter: 12 });
  });

  it('Stream: 429 mit Retry-After', async () => {
    const fetchImpl = vi.fn(async () => json({ ok: false, error: { code: 'RATE_LIMITED', message: 'x' } }, 429, { 'retry-after': '7' }));
    const it = client(fetchImpl as unknown as typeof fetch, user('jwt')).stream(req());
    await expect(it[Symbol.asyncIterator]().next()).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfter: 7 });
  });

  it('Nicht-JSON-Antwort mit 401/429 bekommt den Code aus dem Status', async () => {
    const f401 = vi.fn(async () => new Response('nope', { status: 401 }));
    await expect(client(f401 as unknown as typeof fetch, user('jwt')).generate(req())).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    const f429 = vi.fn(async () => new Response('slow', { status: 429, headers: { 'retry-after': '3' } }));
    await expect(client(f429 as unknown as typeof fetch, user('jwt')).generate(req())).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfter: 3 });
  });

  it('parseRetryAfter: Sekunden, HTTP-Datum, sonst undefined', () => {
    const now = Date.parse('2026-09-26T00:00:00Z');
    expect(parseRetryAfter('30', now)).toBe(30);
    expect(parseRetryAfter('Sat, 26 Sep 2026 00:00:45 GMT', now)).toBe(45);
    expect(parseRetryAfter('Fri, 25 Sep 2026 23:00:00 GMT', now)).toBe(0);
    expect(parseRetryAfter('bald', now)).toBeUndefined();
    expect(parseRetryAfter(null, now)).toBeUndefined();
    expect(parseRetryAfter('', now)).toBeUndefined();
  });
});

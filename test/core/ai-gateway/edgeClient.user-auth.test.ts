import { describe, expect, it, vi } from 'vitest';
import {
  AiGatewayEdgeClient,
  AiGatewayEdgeError,
  parseRetryAfter,
  classifyGatewayError,
  type EdgeClientAuth,
} from '../../../src/core/ai-gateway/edgeClient';
import type { AiGatewayRequest } from '../../../src/core/ai-gateway/types';

// Vertrag RSD Backend, Draft-PR #1591: Nutzer-JWT als Bearer, Anon-Key als
// apikey, tenant_id Pflicht; anonym Legacy-Anon-Key (JWT) als Bearer;
// Fehler { ok:false, error:{ code, message, scope?, retry_after_ms? } }.

// Form eines Legacy-Anon-Keys (JWT), kein echter Schlüssel.
const LEGACY_ANON_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl';

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

  it.each([null, undefined, '', '   '])('wirft TENANT_REQUIRED bei tenant_id=%j und sendet nichts', async (tenant) => {
    const fetchImpl = vi.fn(async () => json(OK));
    const err = await client(fetchImpl as unknown as typeof fetch, user('jwt')).generate(req({ tenant_id: tenant as string | null | undefined })).catch((e) => e);
    expect(err).toBeInstanceOf(AiGatewayEdgeError);
    expect(err).toMatchObject({ status: 400, code: 'TENANT_REQUIRED' });
    expect(err.category).toBe('tenant_required');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('authToken (fest) ist die Kurzform des Nutzer-Modus', async () => {
    const fetchImpl = vi.fn(async () => json(OK));
    await new AiGatewayEdgeClient({ supabaseUrl: 'https://x.supabase.co', apiKey: 'anon-key', fetchImpl: fetchImpl as unknown as typeof fetch, authToken: 'fixed-jwt' }).generate(req());
    expect(sent(fetchImpl).headers).toMatchObject({ authorization: 'Bearer fixed-jwt', apikey: 'anon-key' });
  });

  it('authToken als Sitzungs-Token-Provider wird pro Anfrage gefragt', async () => {
    const fetchImpl = vi.fn(async () => json(OK));
    const tokens = ['jwt-1', 'jwt-2'];
    const provider = vi.fn(async () => tokens.shift());
    const c = new AiGatewayEdgeClient({ supabaseUrl: 'https://x.supabase.co', apiKey: 'anon-key', fetchImpl: fetchImpl as unknown as typeof fetch, authToken: provider });
    await c.generate(req());
    await c.generate(req());
    expect(provider).toHaveBeenCalledTimes(2);
    expect(((fetchImpl.mock.calls as unknown[][])[1]![1] as RequestInit).headers).toMatchObject({ authorization: 'Bearer jwt-2' });
  });

  it('authToken-Provider ohne Token: UNAUTHORIZED, kein Anon-Rückfall', async () => {
    const fetchImpl = vi.fn(async () => json(OK));
    const c = new AiGatewayEdgeClient({ supabaseUrl: 'https://x.supabase.co', apiKey: LEGACY_ANON_JWT, fetchImpl: fetchImpl as unknown as typeof fetch, authToken: async () => null });
    await expect(c.generate(req())).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
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
  it('sendet apikey und den Legacy-Anon-Key (JWT) als Bearer (verify_jwt-Vorfilter)', async () => {
    const fetchImpl = vi.fn(async () => json(OK));
    await new AiGatewayEdgeClient({ supabaseUrl: 'https://x.supabase.co', apiKey: LEGACY_ANON_JWT, fetchImpl: fetchImpl as unknown as typeof fetch, auth: { mode: 'anon' } })
      .generate(req({ tenant_id: undefined }));
    const { headers, body } = sent(fetchImpl);
    expect(headers.apikey).toBe(LEGACY_ANON_JWT);
    expect(headers.authorization).toBe(`Bearer ${LEGACY_ANON_JWT}`);
    expect(body.tenant_id).toBeUndefined();
  });

  it('bricht mit sb_publishable_-Key ab, ohne zu senden', async () => {
    const fetchImpl = vi.fn(async () => json(OK));
    const err = await new AiGatewayEdgeClient({ supabaseUrl: 'https://x.supabase.co', apiKey: 'sb_publishable_abc', fetchImpl: fetchImpl as unknown as typeof fetch, auth: { mode: 'anon' } })
      .generate(req()).catch((e) => e);
    expect(err).toMatchObject({ code: 'AI_GATEWAY_NOT_CONFIGURED' });
    expect(err.category).toBe('unavailable');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reicht zusätzliche Body-Felder unverändert durch (z. B. späteres turnstile_token)', async () => {
    const fetchImpl = vi.fn(async () => json(OK));
    const extra = { turnstile_token: 'tok-123', audit_id: '0b6f3c1e-1111-4222-8333-944445555666' };
    await new AiGatewayEdgeClient({ supabaseUrl: 'https://x.supabase.co', apiKey: LEGACY_ANON_JWT, fetchImpl: fetchImpl as unknown as typeof fetch, auth: { mode: 'anon' } })
      .generate({ ...req({ tenant_id: undefined }), ...extra } as AiGatewayRequest);
    expect(sent(fetchImpl).body).toMatchObject({ op: 'generate', ...extra });
  });

  it('auth hat Vorrang vor authToken', async () => {
    const fetchImpl = vi.fn(async () => json(OK));
    await new AiGatewayEdgeClient({ supabaseUrl: 'https://x.supabase.co', apiKey: LEGACY_ANON_JWT, fetchImpl: fetchImpl as unknown as typeof fetch, auth: { mode: 'anon' }, authToken: 'user-jwt' })
      .generate(req());
    expect(sent(fetchImpl).headers.authorization).toBe(`Bearer ${LEGACY_ANON_JWT}`);
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
    [403, 'ENTITLEMENT'],
    [403, 'QUOTA_EXCEEDED'],
    [403, 'POLICY_BLOCKED'],
    [403, 'APPROVAL_REQUIRED'],
    [404, 'NOT_FOUND'],
    [500, 'INTERNAL'],
    [502, 'INFERENCE_ERROR'],
    [503, 'NO_PROVIDER'],
    [503, 'LM_STUDIO_NOT_CONFIGURED'],
    [400, 'TURNSTILE_MISSING'],
    [403, 'TURNSTILE_FAILED'],
    [503, 'TURNSTILE_UNCONFIGURED'],
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

  it('429: error.retry_after_ms hat Vorrang vor Retry-After, scope wird übernommen', async () => {
    const fetchImpl = vi.fn(async () => json(
      { ok: false, error: { code: 'RATE_LIMITED', message: 'langsam', scope: 'user', retry_after_ms: 1500 } },
      429, { 'retry-after': '30' },
    ));
    const err = await client(fetchImpl as unknown as typeof fetch, user('jwt')).generate(req()).catch((e) => e);
    expect(err).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfter: 2, retryAfterMs: 1500, scope: 'user' });
    expect(err.category).toBe('rate_limited');
  });

  it('429 ohne retry_after_ms: Retry-After-Header gilt', async () => {
    const fetchImpl = vi.fn(async () => json({ ok: false, error: { code: 'RATE_LIMITED', message: 'x', scope: 'tenant' } }, 429, { 'retry-after': '9' }));
    const err = await client(fetchImpl as unknown as typeof fetch, user('jwt')).generate(req()).catch((e) => e);
    expect(err).toMatchObject({ retryAfter: 9, scope: 'tenant' });
    expect(err.retryAfterMs).toBeUndefined();
  });

  it('429 mit unbrauchbarem retry_after_ms: Header gilt, nichts erfunden', async () => {
    const fetchImpl = vi.fn(async () => json({ ok: false, error: { code: 'RATE_LIMITED', message: 'x', retry_after_ms: 'bald' } }, 429));
    const err = await client(fetchImpl as unknown as typeof fetch, user('jwt')).generate(req()).catch((e) => e);
    expect(err.retryAfter).toBeUndefined();
    expect(err.retryAfterMs).toBeUndefined();
  });

  it('Stream: 429 bevorzugt retry_after_ms', async () => {
    const fetchImpl = vi.fn(async () => json({ ok: false, error: { code: 'RATE_LIMITED', message: 'x', scope: 'user', retry_after_ms: 4001 } }, 429, { 'retry-after': '60' }));
    const it = client(fetchImpl as unknown as typeof fetch, user('jwt')).stream(req());
    await expect(it[Symbol.asyncIterator]().next()).rejects.toMatchObject({ retryAfter: 5, scope: 'user' });
  });

  it('Nicht-JSON-Antwort: 404 → NOT_FOUND; 500 bleibt BAD_ENVELOPE, Kategorie internal', async () => {
    const f404 = vi.fn(async () => new Response('x', { status: 404 }));
    await expect(client(f404 as unknown as typeof fetch, user('jwt')).generate(req())).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    const f500 = vi.fn(async () => new Response('x', { status: 500 }));
    const err = await client(f500 as unknown as typeof fetch, user('jwt')).generate(req()).catch((e) => e);
    expect(err).toMatchObject({ code: 'BAD_ENVELOPE', status: 500 });
    expect(err.category).toBe('internal');
  });

  it('classifyGatewayError: Code vor Status, unbekannte Codes nach Status', () => {
    expect(classifyGatewayError('ENTITLEMENT', 403)).toBe('entitlement');
    expect(classifyGatewayError('QUOTA_EXCEEDED', 403)).toBe('quota');
    expect(classifyGatewayError('POLICY_BLOCKED', 403)).toBe('policy');
    expect(classifyGatewayError('NO_PROVIDER', 503)).toBe('unavailable');
    expect(classifyGatewayError('LM_STUDIO_NOT_CONFIGURED', 503)).toBe('unavailable');
    expect(classifyGatewayError('INFERENCE_ERROR', 502)).toBe('internal');
    expect(classifyGatewayError('BAD_REQUEST', 400)).toBe('bad_request');
    expect(classifyGatewayError('TURNSTILE_MISSING', 400)).toBe('bad_request');
    expect(classifyGatewayError('TURNSTILE_FAILED', 403)).toBe('forbidden');
    expect(classifyGatewayError('TURNSTILE_UNCONFIGURED', 503)).toBe('unavailable');
    expect(classifyGatewayError('SOMETHING_NEW', 403)).toBe('forbidden');
    expect(classifyGatewayError('SOMETHING_NEW', 504)).toBe('internal');
    expect(classifyGatewayError(undefined, 503)).toBe('unavailable');
    expect(classifyGatewayError(undefined, 200)).toBe('unknown');
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

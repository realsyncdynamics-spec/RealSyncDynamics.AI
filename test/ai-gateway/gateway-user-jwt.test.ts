import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// processAIGatewayRequest / processAIGatewayStream ohne Test-Double: der
// echte Client holt das Nutzer-JWT aus supabase.auth.getSession().

const session = vi.hoisted(() => ({ token: 'user-jwt' as string | null }));

vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: session.token ? { access_token: session.token } : null } }),
    },
  }),
  isSupabaseConfigured: () => true,
}));

import { processAIGatewayRequest, processAIGatewayStream } from '../../src/core/ai-gateway/gateway';

const OK = { ok: true, provider: 'openai', model: 'gpt', profile: 'cloud-fallback', output: 'antwort', trace_id: 't', latency_ms: 1 };

let fetchSpy: { mock: { calls: unknown[][] }; mockRestore: () => void; mockResolvedValue: (v: unknown) => unknown };

beforeEach(() => {
  session.token = 'user-jwt';
  fetchSpy = vi.spyOn(globalThis, 'fetch') as unknown as typeof fetchSpy;
});
afterEach(() => fetchSpy.mockRestore());

function sentInit(): RequestInit {
  return fetchSpy.mock.calls[0]![1] as RequestInit;
}

describe('gateway.ts — Nutzer-JWT', () => {
  it('Kodee-Pfad: Bearer = Nutzer-JWT, apikey = Anon-Key, tenant_id im Body', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(OK), { status: 200 }));
    const res = await processAIGatewayRequest({ prompt: 'hi', provider: 'openai', feature: 'kodee_chat', tenantId: 'tenant-7' });
    expect(res).toMatchObject({ success: true, modelOutput: 'antwort' });
    const init = sentInit();
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer user-jwt');
    expect(headers.apikey).toBeTruthy();
    expect(headers.apikey).not.toBe('user-jwt');
    expect(JSON.parse(String(init.body))).toMatchObject({ tenant_id: 'tenant-7', feature: 'kodee_chat' });
  });

  it('ohne Sitzung: UNAUTHORIZED im Ergebnis, kein fetch', async () => {
    session.token = null;
    const res = await processAIGatewayRequest({ prompt: 'hi', provider: 'openai', feature: 'kodee_chat', tenantId: 'tenant-7' });
    expect(res).toMatchObject({ success: false, errorCode: 'UNAUTHORIZED', status: 401 });
    expect(fetchSpy.mock.calls).toHaveLength(0);
  });

  it('reicht RATE_LIMITED mit retryAfter an die Oberfläche durch', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: { code: 'RATE_LIMITED', message: 'x' } }), { status: 429, headers: { 'retry-after': '20' } }));
    const res = await processAIGatewayRequest({ prompt: 'hi', provider: 'openai', tenantId: 'tenant-7' });
    expect(res).toMatchObject({ success: false, errorCode: 'RATE_LIMITED', status: 429, retryAfter: 20 });
  });

  it('429: retry_after_ms und scope aus dem Body kommen an der Oberfläche an', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: { code: 'RATE_LIMITED', message: 'x', scope: 'user', retry_after_ms: 2500 } }), { status: 429, headers: { 'retry-after': '20' } }));
    const res = await processAIGatewayRequest({ prompt: 'hi', provider: 'openai', tenantId: 'tenant-7' });
    expect(res).toMatchObject({ success: false, errorCode: 'RATE_LIMITED', retryAfter: 3, errorScope: 'user' });
  });

  it('ohne tenantId: TENANT_REQUIRED, kein fetch', async () => {
    const res = await processAIGatewayRequest({ prompt: 'hi', provider: 'openai', feature: 'kodee_chat', tenantId: null });
    expect(res).toMatchObject({ success: false, errorCode: 'TENANT_REQUIRED', status: 400 });
    expect(fetchSpy.mock.calls).toHaveLength(0);
  });

  it('ENTITLEMENT (Builder-Plansperre) wird typisiert durchgereicht', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: { code: 'ENTITLEMENT', message: 'siteos.builder fehlt' } }), { status: 403 }));
    const res = await processAIGatewayStream({ prompt: 'bau', provider: 'openai', feature: 'app_builder_code', tenantId: 'tenant-9' }, () => {});
    expect(res).toMatchObject({ success: false, errorCode: 'ENTITLEMENT', status: 403 });
  });

  it('Builder-Stream-Pfad sendet ebenfalls Bearer und tenant_id', async () => {
    fetchSpy.mockResolvedValue(new Response('{"event":"delta","text":"ok"}\n{"event":"done"}\n', { status: 200 }));
    const res = await processAIGatewayStream(
      { prompt: 'bau', provider: 'openai', feature: 'app_builder_code', tenantId: 'tenant-9' },
      () => {},
    );
    expect(res.success).toBe(true);
    const init = sentInit();
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer user-jwt');
    expect(JSON.parse(String(init.body))).toMatchObject({ op: 'stream', tenant_id: 'tenant-9', feature: 'app_builder_code' });
  });
});

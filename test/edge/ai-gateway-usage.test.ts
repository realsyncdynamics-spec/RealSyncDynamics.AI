// #1646: Verbrauch des ai-gateway wird dem Mandanten aus dem Principal
// zugeordnet — nie einem Mandanten aus dem Request eines Nutzers, der dort
// kein Mitglied ist, und nie ohne Mandant.

import { describe, it, expect } from 'vitest';
import {
  createAiGatewayHandler,
  usageTokens,
  type GatewayHandlerDeps,
  type GatewayLike,
  type UsageBooking,
  type VerifiedAuth,
} from '../../supabase/functions/ai-gateway/handler.ts';

const USER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.user-u1.sig';
const INTERNAL_KEY = 'k'.repeat(48);
const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';
const URL_OP = 'https://x.supabase.co/functions/v1/ai-gateway';
const URL_CHAT = 'https://x.supabase.co/functions/v1/ai-gateway/v1/chat/completions';

function jsonErr(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), { status });
}

async function fakeAuth(req: Request, tenant: string | null | undefined): Promise<VerifiedAuth | Response> {
  if (req.headers.get('Authorization') !== `Bearer ${USER_TOKEN}`) return jsonErr(401, 'UNAUTHORIZED', 'no user');
  if (!tenant) return jsonErr(400, 'BAD_REQUEST', 'tenant_id is required');
  if (tenant !== T1) return jsonErr(403, 'FORBIDDEN', 'not a member');
  return { user: { id: 'u1' }, tenantId: tenant, admin: {} };
}

const USAGE = { input_tokens: 30, output_tokens: 12 };

function harness(opts: { failRecord?: boolean; withRecorder?: boolean } = {}) {
  const bookings: UsageBooking[] = [];
  const logs: Array<Record<string, unknown>> = [];
  const reply = async () => ({ provider: 'mock', model: 'm', output: 'ok', usage: USAGE });
  const gateway: GatewayLike = {
    health: async () => ({ ok: true }),
    generate: reply,
    extractJson: async () => ({ ...(await reply()), output: { ok: true } }),
    embed: async () => ({ ...(await reply()), output: [0.1] }),
    async *generateStream() {
      yield { event: 'delta', text: 'ok' };
      yield { event: 'done', usage: { total_tokens: 7 } };
    },
  };
  const deps: GatewayHandlerDeps = {
    env: (n) => (n === 'AI_GATEWAY_INTERNAL_KEY' ? INTERNAL_KEY : undefined),
    requireAuthAndTenant: fakeAuth,
    gateBuilder: async () => null,
    buildGateway: async () => gateway,
    pdpCheck: async () => null,
    anonAuditLog: async () => null,
    log: (l) => logs.push(l),
    ...(opts.withRecorder === false ? {} : {
      recordUsage: async (b: UsageBooking) => {
        if (opts.failRecord) throw new Error('db down');
        bookings.push(b);
      },
    }),
  };
  return { handler: createAiGatewayHandler(deps), bookings, logs };
}

function opReq(body: Record<string, unknown>, headers: Record<string, string>): Request {
  return new Request(URL_OP, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

const base = { op: 'generate', tenant_id: T1, feature: 'governance_ai_workspace', task_type: 'chat', model_profile: 'fast-local', input: 'Hallo' };
const user = { Authorization: `Bearer ${USER_TOKEN}` };
const internal = { 'x-internal-key': INTERNAL_KEY, 'x-internal-caller': 'governance-agent' };

describe('usageTokens', () => {
  it('nimmt total_tokens, sonst input+output, sonst 0', () => {
    expect(usageTokens({ total_tokens: 9, input_tokens: 1, output_tokens: 1 })).toBe(9);
    expect(usageTokens({ input_tokens: 3, output_tokens: 4 })).toBe(7);
    expect(usageTokens(undefined)).toBe(0);
    expect(usageTokens({ total_tokens: -5 })).toBe(0);
  });
});

describe('ai-gateway — Verbrauch je Mandant (#1646)', () => {
  it('Nutzerpfad: bucht auf den Mandanten aus der Auth, mit Nutzer und Tokens', async () => {
    const h = harness();
    const res = await h.handler(opReq({ ...base, user_id: 'spoofed' }, user));
    expect(res.status).toBe(200);
    expect(h.bookings).toEqual([{
      tenantId: T1, path: 'user', userId: 'u1', internalCaller: null,
      feature: 'governance_ai_workspace', route: '/', tokens: 42,
    }]);
  });

  it('fremder Mandant: 403 und keine Buchung', async () => {
    const h = harness();
    const res = await h.handler(opReq({ ...base, tenant_id: T2 }, user));
    expect(res.status).toBe(403);
    expect(h.bookings).toHaveLength(0);
  });

  it('Service-Pfad mit Mandant: bucht mit internem Aufrufer', async () => {
    const h = harness();
    const res = await h.handler(opReq({ ...base, op: 'extract_json', model_profile: 'strict-json' }, internal));
    expect(res.status).toBe(200);
    expect(h.bookings[0]).toMatchObject({ tenantId: T1, path: 'service', userId: null, internalCaller: 'governance-agent' });
  });

  it('Service-Pfad ohne Mandant: keine Buchung', async () => {
    const h = harness();
    const b: Record<string, unknown> = { ...base };
    delete b.tenant_id;
    const res = await h.handler(opReq(b, internal));
    expect(res.status).toBe(200);
    expect(h.bookings).toHaveLength(0);
  });

  it('Stream: bucht beim done-Ereignis', async () => {
    const h = harness();
    const res = await h.handler(opReq({ ...base, op: 'stream' }, user));
    expect(res.status).toBe(200);
    await res.text();
    expect(h.bookings).toHaveLength(1);
    expect(h.bookings[0].tokens).toBe(7);
  });

  it('chat/completions: bucht auf die Route /v1/chat/completions', async () => {
    const h = harness();
    const res = await h.handler(new Request(URL_CHAT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...user },
      body: JSON.stringify({ model: 'fast-local', messages: [{ role: 'user', content: 'hi' }], tenant_id: T1 }),
    }));
    expect(res.status).toBe(200);
    expect(h.bookings[0]).toMatchObject({ tenantId: T1, route: '/v1/chat/completions', feature: 'openai_compat' });
  });

  it('Buchungsfehler bricht die Antwort nicht, wird aber geloggt', async () => {
    const h = harness({ failRecord: true });
    const res = await h.handler(opReq(base, user));
    expect(res.status).toBe(200);
    expect(h.logs.find((l) => l.scope === 'ai-gateway-usage')).toMatchObject({ event: 'record_failed', tenant_id: T1 });
  });

  it('ohne recordUsage-Abhängigkeit: Verhalten unverändert', async () => {
    const h = harness({ withRecorder: false });
    const res = await h.handler(opReq(base, user));
    expect(res.status).toBe(200);
  });
});

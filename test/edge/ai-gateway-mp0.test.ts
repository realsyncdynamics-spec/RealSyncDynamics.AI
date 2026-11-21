// MP-0 — Härtung ai-gateway vor Provider-Erweiterung.
//
// Die sechs Pflichtfälle aus dem Arbeitspaket:
//   1. falscher Tenant im Body (Service- und Nutzerpfad)
//   2. Service-Pfad ohne verifizierte Tenant-Bindung
//   3. PDP-Fehler            → fail-closed (503), kein Provider-Aufruf
//   4. PDP-Timeout           → fail-closed (503), kein Provider-Aufruf
//   5. Evidence-Reservierung schlägt fehl → kein Provider-Aufruf
//   6. Transportfehler ohne Fallback-Erlaubnis → kein Provider-Wechsel
// Dazu: PDP bekommt Tenant + Provider + Region, explizite Fallback-Erlaubnis,
// Client signiert den Mandanten.

import { describe, it, expect, vi } from 'vitest';
import {
  createAiGatewayHandler,
  type GatewayHandlerDeps,
  type GatewayLike,
  type PdpContext,
  type VerifiedAuth,
} from '../../supabase/functions/ai-gateway/handler.ts';
import type { AiEvidenceEventInsert } from '../../supabase/functions/_shared/aiGateway/callEvidence.ts';
import {
  mintTenantAssertion,
  serviceTenantFrom,
  verifyTenantAssertion,
  TENANT_ASSERTION_HEADER,
  TENANT_ASSERTION_MAX_TTL_MS,
} from '../../supabase/functions/_shared/aiGateway/serviceTenant.ts';
import {
  explicitlyAllowed,
  guardedDecide,
  parseEnforcementMode,
  type GuardedDecision,
} from '../../supabase/functions/_shared/aiGateway/pdpGuard.ts';
import { serviceGatewayHeaders } from '../../supabase/functions/_shared/aiGateway/edgeClient.ts';
import { internalGatewayConfig } from '../../supabase/functions/_shared/aiGateway/internalClient.ts';
import { ServerAiGateway } from '../../supabase/functions/_shared/aiGateway/router.ts';
import type { AiGatewayRequest, AiProviderAdapter } from '../../supabase/functions/_shared/aiGateway/types.ts';

const USER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.user-u1.sig';
const INTERNAL_KEY = 'k'.repeat(48);
const SIGNING_KEY = 's'.repeat(48);
const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';
const URL_OP = 'https://x.supabase.co/functions/v1/ai-gateway';
const URL_CHAT = 'https://x.supabase.co/functions/v1/ai-gateway/v1/chat/completions';

function jsonErr(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), { status, headers: { 'content-type': 'application/json' } });
}

async function fakeAuth(req: Request, tenant: string | null | undefined): Promise<VerifiedAuth | Response> {
  if (req.headers.get('Authorization') !== `Bearer ${USER_TOKEN}`) return jsonErr(401, 'UNAUTHORIZED', 'no user');
  if (!tenant) return jsonErr(400, 'BAD_REQUEST', 'tenant_id is required');
  if (tenant !== T1) return jsonErr(403, 'FORBIDDEN', 'not a member');
  return { user: { id: 'u1' }, tenantId: tenant, admin: {} };
}

/** pdpCheck wie in ai-gateway/index.ts verdrahtet: guardedDecide um einen injizierten decide(). */
function pdpFrom(mode: 'off' | 'shadow' | 'enforce', decide: () => Promise<GuardedDecision>, seen: PdpContext[], timeoutMs = 50) {
  return async (ctx: PdpContext) => {
    seen.push(ctx);
    const g = await guardedDecide({ mode, decide, timeoutMs, log: () => {} });
    if (g.kind === 'off') return null;
    if (g.kind === 'deny') return jsonErr(g.status, g.code, g.message);
    return mode === 'enforce' ? g.result : null;
  };
}

function harness(opts: {
  pdpCheck?: GatewayHandlerDeps['pdpCheck'];
  failReserve?: boolean;
  env?: Record<string, string | undefined>;
} = {}) {
  const evidence: AiEvidenceEventInsert[] = [];
  const logs: Array<Record<string, unknown>> = [];
  const pdpSeen: PdpContext[] = [];
  let providerCalls = 0;
  const reply = async () => {
    providerCalls += 1;
    return { provider: 'ollama', model: 'llama3.1:8b', output: 'ok', usage: { input_tokens: 1, output_tokens: 1 } };
  };
  const gateway: GatewayLike = {
    health: async () => ({ ok: true }),
    generate: reply,
    extractJson: async () => ({ ...(await reply()), output: { ok: true } }),
    embed: async () => ({ ...(await reply()), output: [0.1] }),
    async *generateStream() { providerCalls += 1; yield { event: 'done' }; },
  };
  const env: Record<string, string | undefined> = {
    AI_GATEWAY_INTERNAL_KEY: INTERNAL_KEY,
    AI_GATEWAY_TENANT_SIGNING_KEY: SIGNING_KEY,
    AI_GATEWAY_LOCAL_REGION: 'eu',
    ...(opts.env ?? {}),
  };
  const deps: GatewayHandlerDeps = {
    env: (n) => env[n],
    requireAuthAndTenant: fakeAuth,
    gateBuilder: async () => null,
    buildGateway: async () => gateway,
    pdpCheck: opts.pdpCheck ?? (async (ctx) => { pdpSeen.push(ctx); return null; }),
    providerTarget: () => ({ provider: 'ollama', localRegion: env.AI_GATEWAY_LOCAL_REGION ?? null }),
    anonAuditLog: async () => null,
    log: (l) => logs.push(l),
    newId: () => 'req-mp0',
    recordEvidence: async (e) => {
      if (opts.failReserve && e.event_type === 'ai:call_started') throw new Error('insert failed');
      evidence.push(e);
    },
  };
  return { handler: createAiGatewayHandler(deps), evidence, logs, pdpSeen, providerCalls: () => providerCalls };
}

const base = { op: 'generate', feature: 'governance_brief_daily', task_type: 'chat', model_profile: 'fast-local', input: 'Hallo' };
const user = { Authorization: `Bearer ${USER_TOKEN}` };
const svc = (caller = 'agent-os-runner') => ({ 'x-internal-key': INTERNAL_KEY, 'x-internal-caller': caller });

function opReq(body: Record<string, unknown>, headers: Record<string, string>): Request {
  return new Request(URL_OP, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
function chatReq(body: Record<string, unknown>, headers: Record<string, string>): Request {
  return new Request(URL_CHAT, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
async function code(res: Response): Promise<string> {
  return ((await res.json()) as { error?: { code?: string } }).error?.code ?? '';
}

// ── 1. Falscher Tenant im Body ─────────────────────────────────────

describe('MP-0 · 1. falscher Tenant im Body', () => {
  it('Service-Pfad: Bestätigung für T1, Body sagt T2 → 403 TENANT_MISMATCH, kein Provider', async () => {
    const h = harness();
    const a = await mintTenantAssertion({ caller: 'agent-os-runner', tenantId: T1, signingKey: SIGNING_KEY });
    const res = await h.handler(opReq({ ...base, tenant_id: T2 }, { ...svc(), [TENANT_ASSERTION_HEADER]: a }));
    expect(res.status).toBe(403);
    expect(await code(res)).toBe('TENANT_MISMATCH');
    expect(h.providerCalls()).toBe(0);
    expect(h.evidence).toHaveLength(0);
  });

  it('Service-Pfad /v1/chat/completions: x-tenant-id-Header ohne Bestätigung → 403', async () => {
    const h = harness();
    const res = await h.handler(chatReq({ model: 'fast-local', messages: [{ role: 'user', content: 'x' }] }, { ...svc(), 'x-tenant-id': T2 }));
    expect(res.status).toBe(403);
    expect(await code(res)).toBe('TENANT_NOT_VERIFIED');
    expect(h.providerCalls()).toBe(0);
  });

  it('Nutzerpfad: fremder Tenant im Body → 403 (Mitgliedschaft serverseitig geprüft)', async () => {
    const h = harness();
    const res = await h.handler(opReq({ ...base, tenant_id: T2 }, user));
    expect(res.status).toBe(403);
    expect(h.providerCalls()).toBe(0);
  });

  it('Service-Pfad: Bestätigung und Body stimmen überein → Mandant aus der Bestätigung', async () => {
    const h = harness();
    const a = await mintTenantAssertion({ caller: 'agent-os-runner', tenantId: T1, signingKey: SIGNING_KEY });
    const res = await h.handler(opReq({ ...base, tenant_id: T1 }, { ...svc(), [TENANT_ASSERTION_HEADER]: a }));
    expect(res.status).toBe(200);
    expect(h.pdpSeen[0]).toMatchObject({ tenantId: T1, path: 'service' });
    expect(h.evidence.every((e) => e.tenant_id === T1)).toBe(true);
  });
});

// ── 2. Service-Pfad ohne verifizierte Bindung ───────────────────────

describe('MP-0 · 2. Service-Pfad ohne verifizierte Tenant-Bindung', () => {
  it('tenant_id im Body ohne Bestätigung → 403 TENANT_NOT_VERIFIED, kein Provider', async () => {
    const h = harness();
    const res = await h.handler(opReq({ ...base, tenant_id: T1 }, svc()));
    expect(res.status).toBe(403);
    expect(await code(res)).toBe('TENANT_NOT_VERIFIED');
    expect(h.providerCalls()).toBe(0);
  });

  it('Bestätigung eines anderen Aufrufers → 403 TENANT_ASSERTION_CALLER', async () => {
    const h = harness();
    const a = await mintTenantAssertion({ caller: 'telegram-webhook', tenantId: T1, signingKey: SIGNING_KEY });
    const res = await h.handler(opReq({ ...base, tenant_id: T1 }, { ...svc('agent-os-runner'), [TENANT_ASSERTION_HEADER]: a }));
    expect(res.status).toBe(403);
    expect(await code(res)).toBe('TENANT_ASSERTION_CALLER');
  });

  it('unbekannte Aufruferkennung kann keinen Mandanten binden', async () => {
    const a = await mintTenantAssertion({ caller: 'evil', tenantId: T1, signingKey: SIGNING_KEY });
    const b = await verifyTenantAssertion({ headers: new Headers({ [TENANT_ASSERTION_HEADER]: a }), caller: 'unknown', env: () => SIGNING_KEY });
    expect(b).toMatchObject({ kind: 'reject', rejection: { status: 403, code: 'TENANT_ASSERTION_CALLER' } });
  });

  it('abgelaufene oder zu lange gültige Bestätigung → 403 TENANT_ASSERTION_EXPIRED', async () => {
    const now = Date.now();
    const expired = await mintTenantAssertion({ caller: 'agent-os-runner', tenantId: T1, signingKey: SIGNING_KEY, now: now - 120_000 });
    const r1 = await verifyTenantAssertion({ headers: new Headers({ [TENANT_ASSERTION_HEADER]: expired }), caller: 'agent-os-runner', env: () => SIGNING_KEY, now });
    expect(r1).toMatchObject({ kind: 'reject', rejection: { code: 'TENANT_ASSERTION_EXPIRED' } });

    const future = await mintTenantAssertion({ caller: 'agent-os-runner', tenantId: T1, signingKey: SIGNING_KEY, now: now + TENANT_ASSERTION_MAX_TTL_MS });
    const r2 = await verifyTenantAssertion({ headers: new Headers({ [TENANT_ASSERTION_HEADER]: future }), caller: 'agent-os-runner', env: () => SIGNING_KEY, now });
    expect(r2).toMatchObject({ kind: 'reject', rejection: { code: 'TENANT_ASSERTION_EXPIRED' } });
  });

  it('falsche Signatur (anderer Key) und manipulierter Tenant → 403 TENANT_ASSERTION_INVALID', async () => {
    const forged = await mintTenantAssertion({ caller: 'agent-os-runner', tenantId: T1, signingKey: 'x'.repeat(48) });
    const r1 = await verifyTenantAssertion({ headers: new Headers({ [TENANT_ASSERTION_HEADER]: forged }), caller: 'agent-os-runner', env: () => SIGNING_KEY });
    expect(r1).toMatchObject({ kind: 'reject', rejection: { code: 'TENANT_ASSERTION_INVALID' } });

    const real = await mintTenantAssertion({ caller: 'agent-os-runner', tenantId: T1, signingKey: SIGNING_KEY });
    const tampered = real.replace(T1, T2);
    const r2 = await verifyTenantAssertion({ headers: new Headers({ [TENANT_ASSERTION_HEADER]: tampered }), caller: 'agent-os-runner', env: () => SIGNING_KEY });
    expect(r2).toMatchObject({ kind: 'reject', rejection: { code: 'TENANT_ASSERTION_INVALID' } });

    const r3 = await verifyTenantAssertion({ headers: new Headers({ [TENANT_ASSERTION_HEADER]: 'v1.garbage' }), caller: 'agent-os-runner', env: () => SIGNING_KEY });
    expect(r3).toMatchObject({ kind: 'reject', rejection: { code: 'TENANT_ASSERTION_INVALID' } });
  });

  it('Signing-Key fehlt am Gateway → 401 TENANT_BINDING_DISABLED (fail-closed)', async () => {
    const h = harness({ env: { AI_GATEWAY_TENANT_SIGNING_KEY: undefined } });
    const a = await mintTenantAssertion({ caller: 'agent-os-runner', tenantId: T1, signingKey: SIGNING_KEY });
    const res = await h.handler(opReq({ ...base, tenant_id: T1 }, { ...svc(), [TENANT_ASSERTION_HEADER]: a }));
    expect(res.status).toBe(401);
    expect(await code(res)).toBe('TENANT_BINDING_DISABLED');
    expect(h.providerCalls()).toBe(0);
  });

  it('mandantenloser Service-Aufruf bleibt möglich (tenant null) und hinterlässt Evidence', async () => {
    const h = harness();
    const res = await h.handler(opReq(base, svc('governance-agent')));
    expect(res.status).toBe(200);
    expect(h.pdpSeen[0].tenantId).toBeNull();
    expect(h.evidence.map((e) => [e.event_type, e.tenant_id])).toEqual([['ai:call_started', null], ['ai:call', null]]);
  });

  it('serviceTenantFrom: Claim ohne Bindung → Rejection, ohne Claim → null', () => {
    expect(serviceTenantFrom({ kind: 'none' }, T1)).toMatchObject({ status: 403, code: 'TENANT_NOT_VERIFIED' });
    expect(serviceTenantFrom({ kind: 'none' }, undefined)).toEqual({ tenantId: null });
    expect(serviceTenantFrom({ kind: 'bound', tenantId: T1 }, T1.toUpperCase())).toEqual({ tenantId: T1 });
  });

  it('Client: serviceGatewayHeaders signiert, Gateway akzeptiert genau diesen Mandanten', async () => {
    const cfg = internalGatewayConfig('telegram-webhook', (n) => ({
      SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', AI_GATEWAY_INTERNAL_KEY: INTERNAL_KEY, AI_GATEWAY_TENANT_SIGNING_KEY: SIGNING_KEY,
    } as Record<string, string>)[n]);
    expect(cfg.ok).toBe(true);
    if (!cfg.ok) return;
    const headers = await serviceGatewayHeaders(cfg.config, T1);
    expect(headers[TENANT_ASSERTION_HEADER]).toMatch(/^v1\.telegram-webhook\./);
    const b = await verifyTenantAssertion({ headers: new Headers(headers), caller: 'telegram-webhook', env: () => SIGNING_KEY });
    expect(b).toEqual({ kind: 'bound', tenantId: T1 });

    // Ohne Signing-Key keine Bestätigung → der Gateway lehnt mandantengebundene Aufrufe ab.
    const noKey = await serviceGatewayHeaders({ ...cfg.config, tenantSigningKey: undefined }, T1);
    expect(noKey[TENANT_ASSERTION_HEADER]).toBeUndefined();
  });
});

// ── 3./4. PDP-Fehler und -Timeout ───────────────────────────────────

describe('MP-0 · 3./4. PDP fail-closed', () => {
  it.each(['shadow', 'enforce'] as const)('PDP-Fehler (%s) → 503 POLICY_UNAVAILABLE, kein Provider, Block-Evidence', async (mode) => {
    const seen: PdpContext[] = [];
    const h = harness({ pdpCheck: pdpFrom(mode, async () => { throw new Error('snapshot load failed'); }, seen) });
    const res = await h.handler(opReq({ ...base, tenant_id: T1 }, user));
    expect(res.status).toBe(503);
    expect(await code(res)).toBe('POLICY_UNAVAILABLE');
    expect(h.providerCalls()).toBe(0);
    expect(h.evidence.map((e) => e.event_type)).toEqual(['ai:call_blocked']);
    expect(h.evidence[0].evidence.reasons).toEqual(['POLICY_UNAVAILABLE']);
  });

  it.each(['shadow', 'enforce'] as const)('PDP-Timeout (%s) → 503 POLICY_TIMEOUT, kein Provider', async (mode) => {
    const seen: PdpContext[] = [];
    const h = harness({ pdpCheck: pdpFrom(mode, () => new Promise<GuardedDecision>(() => {}), seen, 20) });
    const res = await h.handler(opReq({ ...base, tenant_id: T1 }, user));
    expect(res.status).toBe(503);
    expect(await code(res)).toBe('POLICY_TIMEOUT');
    expect(h.providerCalls()).toBe(0);
  });

  it('unklare Entscheidung → 503 POLICY_UNCLEAR', async () => {
    const g = await guardedDecide({ mode: 'shadow', decide: async () => ({ decision: 'maybe', reasons: [] }), log: () => {} });
    expect(g).toMatchObject({ kind: 'deny', status: 503, code: 'POLICY_UNCLEAR' });
  });

  it('shadow setzt einen Policy-Block NICHT durch (R5), enforce schon', async () => {
    const block = async () => ({ decision: 'block', reasons: [{ text_de: 'gesperrt' }], matched_policy_ids: ['p1'] });
    expect((await guardedDecide({ mode: 'shadow', decide: block, log: () => {} })).kind).toBe('ok');
    expect(await guardedDecide({ mode: 'enforce', decide: block, log: () => {} })).toMatchObject({ kind: 'deny', status: 403, code: 'POLICY_BLOCKED', cause: 'blocked' });
    expect((await guardedDecide({ mode: 'off', decide: async () => { throw new Error('x'); } })).kind).toBe('off');
    expect(parseEnforcementMode(undefined)).toBe('shadow');
  });

  it('PDP bekommt Tenant, Provider, Modellprofil und Region — vor jedem Provider-Aufruf', async () => {
    const h = harness();
    await h.handler(opReq({ ...base, tenant_id: T1 }, user));
    expect(h.pdpSeen).toEqual([{
      tenantId: T1, path: 'user', userId: 'u1', feature: 'governance_brief_daily',
      modelProfile: 'fast-local', provider: 'ollama', providerRegion: 'EU', residency: 'eu_local',
    }]);
  });
});

// ── 5. Evidence-Reservierung schlägt fehl ───────────────────────────

describe('MP-0 · 5. Evidence-Reservierung', () => {
  it('Reservierung scheitert → 503 EVIDENCE_UNAVAILABLE, kein Provider (op und chat)', async () => {
    const h = harness({ failReserve: true });
    const r1 = await h.handler(opReq({ ...base, tenant_id: T1 }, user));
    expect(r1.status).toBe(503);
    expect(await code(r1)).toBe('EVIDENCE_UNAVAILABLE');
    const r2 = await h.handler(chatReq({ model: 'fast-local', messages: [{ role: 'user', content: 'x' }], tenant_id: T1 }, user));
    expect(r2.status).toBe(503);
    expect(h.providerCalls()).toBe(0);
    expect(h.logs.filter((l) => l.event === 'reserve_failed')).toHaveLength(2);
  });

  it('Reservierung steht VOR dem Provider-Aufruf, Abschluss danach', async () => {
    const order: string[] = [];
    const evidence: string[] = [];
    const gateway: GatewayLike = {
      health: async () => ({ ok: true }),
      generate: async () => { order.push('provider'); return { provider: 'ollama', output: 'ok' }; },
      extractJson: async () => ({ output: {} }),
      embed: async () => ({ output: [] }),
      async *generateStream() { yield { event: 'done' }; },
    };
    const handler = createAiGatewayHandler({
      env: () => undefined,
      requireAuthAndTenant: fakeAuth,
      gateBuilder: async () => null,
      buildGateway: async () => gateway,
      pdpCheck: async () => { order.push('pdp'); return null; },
      anonAuditLog: async () => null,
      log: () => {},
      recordEvidence: async (e) => { order.push(e.event_type); evidence.push(e.event_type); },
    });
    expect((await handler(opReq({ ...base, tenant_id: T1 }, user))).status).toBe(200);
    expect(order).toEqual(['pdp', 'ai:call_started', 'provider', 'ai:call']);
  });

  it('Provider-Fehler nach Reservierung → Abschluss ai:call_failed mit Fehlercode', async () => {
    const evidence: AiEvidenceEventInsert[] = [];
    const handler = createAiGatewayHandler({
      env: () => undefined,
      requireAuthAndTenant: fakeAuth,
      gateBuilder: async () => null,
      buildGateway: async () => ({
        health: async () => ({ ok: true }),
        generate: async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:11434'); },
        extractJson: async () => ({ output: {} }),
        embed: async () => ({ output: [] }),
        async *generateStream() { yield { event: 'done' }; },
      }),
      pdpCheck: async () => null,
      anonAuditLog: async () => null,
      log: () => {},
      recordEvidence: async (e) => { evidence.push(e); },
    });
    const res = await handler(opReq({ ...base, tenant_id: T1 }, user));
    expect(res.status).toBe(503);
    expect(evidence.map((e) => e.event_type)).toEqual(['ai:call_started', 'ai:call_failed']);
    expect(evidence[1].evidence).toMatchObject({ stage: 'failed', error_code: 'LOCAL_PROVIDER_UNREACHABLE' });
  });
});

// ── 6. Transportfehler ohne Fallback-Erlaubnis ──────────────────────

function adapter(id: string, behaviour: () => Promise<unknown>): AiProviderAdapter {
  return {
    id,
    health: vi.fn(async () => ({ ok: true })),
    generate: vi.fn(behaviour) as unknown as AiProviderAdapter['generate'],
    extractJson: vi.fn(behaviour) as unknown as AiProviderAdapter['extractJson'],
    embed: vi.fn(behaviour) as unknown as AiProviderAdapter['embed'],
  } as unknown as AiProviderAdapter;
}

const req: AiGatewayRequest = { feature: 'f', task_type: 'chat', model_profile: 'fast-local', input: 'x' };

describe('MP-0 · 6. Provider-Fallback nur mit ausdrücklicher Erlaubnis (Deno-Router)', () => {
  it('Transportfehler ohne Erlaubnis → Fehler wird durchgereicht, Anthropic/OpenAI nicht aufgerufen', async () => {
    const local = adapter('lm_studio', async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:1234'); });
    const anthropic = adapter('anthropic', async () => ({ provider: 'anthropic', output: 'cloud' }));
    const openai = adapter('openai', async () => ({ provider: 'openai', output: 'cloud' }));
    const gw = new ServerAiGateway({ lmStudio: local, anthropic, openai, lmStudioBaseUrl: 'http://127.0.0.1:1' });
    await expect(gw.generate(req)).rejects.toThrow(/ECONNREFUSED/);
    expect(anthropic.generate).not.toHaveBeenCalled();
    expect(openai.generate).not.toHaveBeenCalled();
  });

  it('mit Erlaubnis nur für openai → genau dieser Wechsel', async () => {
    const local = adapter('lm_studio', async () => { throw new Error('fetch failed'); });
    const anthropic = adapter('anthropic', async () => ({ provider: 'anthropic', output: 'cloud' }));
    const openai = adapter('openai', async () => ({ provider: 'openai', output: 'cloud' }));
    const gw = new ServerAiGateway({ lmStudio: local, anthropic, openai, lmStudioBaseUrl: 'http://127.0.0.1:1', allowedFallbackIds: ['openai'] });
    const r = await gw.generate(req);
    expect(r.provider).toBe('openai');
    expect(anthropic.generate).not.toHaveBeenCalled();
  });

  it('explicitlyAllowed: nur ein Policy-Treffer mit allow zählt, nicht der Default', () => {
    expect(explicitlyAllowed({ decision: 'allow', reasons: [], matched_policy_ids: [] , primary_policy_id: null })).toBe(false);
    expect(explicitlyAllowed({ decision: 'allow', reasons: [], matched_policy_ids: ['p1'] })).toBe(true);
    expect(explicitlyAllowed({ decision: 'warn', reasons: [], matched_policy_ids: ['p1'] })).toBe(false);
    expect(explicitlyAllowed(null)).toBe(false);
  });
});

// Brief-Cron-Reparatur (fix/agent-os-brief-cron): Fehlerpfad + Logging des
// ai-gateway, Erkennung unerreichbarer lokaler Provider-URLs in der
// gehosteten Edge-Runtime, korrekter Payload des Governance-Brief-Runners.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createAiGatewayHandler,
  type GatewayHandlerDeps,
  type GatewayLike,
} from '../../supabase/functions/ai-gateway/handler.ts';
import {
  reportInferenceError,
  sanitizeErrorText,
  LOG_MESSAGE_MAX_CHARS,
} from '../../supabase/functions/_shared/aiGateway/errorReport.ts';
import {
  checkLocalEndpoint,
  decideLocalSlot,
  isLocalOnlyHost,
  isHostedSupabase,
  LOCAL_UNREACHABLE_MESSAGE,
  UnreachableLocalAdapter,
} from '../../supabase/functions/_shared/aiGateway/localEndpoint.ts';
import { isTransportLevelFailure, ServerAiGateway } from '../../supabase/functions/_shared/aiGateway/router.ts';
import type { AiGatewayRequest } from '../../supabase/functions/_shared/aiGateway/types.ts';

// Pfade relativ zum Repo-Root (URL-Auflösung über das Modul scheitert unter jsdom).
const repoFile = (p: string) => resolve(__dirname, '../..', p);

const INTERNAL_KEY = 'k'.repeat(48);
const T1 = '11111111-1111-4111-8111-111111111111';
const HOSTED = 'https://ebljyceifhnlzhjfyxup.supabase.co';

function harness(fail: unknown) {
  const logs: Array<Record<string, unknown>> = [];
  const throwing = async (_r: AiGatewayRequest): Promise<never> => { throw fail; };
  const gateway: GatewayLike = {
    health: async () => ({ ok: true }),
    generate: throwing,
    extractJson: throwing,
    embed: throwing,
    // deno-lint-ignore require-yield
    async *generateStream() { throw fail; },
  };
  const deps: GatewayHandlerDeps = {
    env: (n) => (n === 'AI_GATEWAY_INTERNAL_KEY' ? INTERNAL_KEY : undefined),
    requireAuthAndTenant: async () => new Response(null, { status: 401 }),
    gateBuilder: async () => null,
    buildGateway: async () => gateway,
    pdpCheck: async () => null,
    anonAuditLog: async () => null,
    log: (l) => logs.push(l),
  };
  return { handler: createAiGatewayHandler(deps), logs };
}

function briefRequest(op = 'extract_json'): Request {
  return new Request('https://x.supabase.co/functions/v1/ai-gateway', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-key': INTERNAL_KEY,
      'x-internal-caller': 'agent-os-runner',
    },
    body: JSON.stringify({
      op,
      tenant_id: T1,
      feature: 'governance_brief_daily',
      task_type: 'governance_reasoning',
      model_profile: 'strict-json',
      input: 'GEHEIMER-PROMPT-INHALT',
      system_prompt: 'SYSTEM-PROMPT-INHALT',
    }),
  });
}

describe('errorReport — stabile Codes statt Catch-all', () => {
  it.each([
    ['LM Studio returned invalid JSON', 502, 'UPSTREAM_BAD_OUTPUT'],
    ['No LM Studio model available', 502, 'UPSTREAM_UNAVAILABLE'],
    [LOCAL_UNREACHABLE_MESSAGE, 503, 'LOCAL_PROVIDER_UNREACHABLE'],
    ['Provider not configured for profile: cloud-fallback', 503, 'PROVIDER_NOT_CONFIGURED'],
    ['invalid x-api-key', 502, 'UPSTREAM_AUTH_FAILED'],
    ['Your credit balance is too low to access the Anthropic API.', 502, 'UPSTREAM_QUOTA'],
    ['messages.0.content: Input should be a valid list', 502, 'UPSTREAM_REJECTED'],
    ["Invalid type for 'messages[0].content': expected one of a string or array of objects, but got an object instead.", 502, 'UPSTREAM_REJECTED'],
    ['something completely different', 500, 'INFERENCE_ERROR'],
  ])('%s → %i %s', (msg, status, code) => {
    const r = reportInferenceError(new Error(msg));
    expect(r.status).toBe(status);
    expect(r.code).toBe(code);
  });

  it('bereinigt Credentials und kürzt', () => {
    const s = sanitizeErrorText(
      'fail Bearer abc.def.ghi key sk-ant-api03-SECRETSECRET sb_secret_XYZ123 token=hunter2 https://user:pw@host/x ' + 'y'.repeat(1000),
    );
    expect(s).not.toContain('abc.def.ghi');
    expect(s).not.toContain('SECRETSECRET');
    expect(s).not.toContain('sb_secret_XYZ123');
    expect(s).not.toContain('hunter2');
    expect(s).not.toContain('user:pw');
    expect(s.length).toBeLessThanOrEqual(LOG_MESSAGE_MAX_CHARS + 1);
  });
});

describe('ai-gateway — Fehlerpfad loggt Fehlertext (ohne Prompt) und liefert stabilen Code', () => {
  it('Provider-4xx → 502 UPSTREAM_REJECTED + Logzeile mit Aufrufer/Tenant/Feature', async () => {
    const h = harness(new Error('messages.0.content: Input should be a valid list'));
    const res = await h.handler(briefRequest());
    expect(res.status).toBe(502);
    const j = (await res.json()) as { ok: boolean; error: { code: string; message: string } };
    expect(j.ok).toBe(false);
    expect(j.error.code).toBe('UPSTREAM_REJECTED');
    const line = h.logs.find((l) => l.scope === 'ai-gateway-error');
    expect(line).toMatchObject({
      code: 'UPSTREAM_REJECTED',
      status: 502,
      path: 'service',
      internal_caller: 'agent-os-runner',
      tenant_id: T1,
      feature: 'governance_brief_daily',
      model_profile: 'strict-json',
      error: 'messages.0.content: Input should be a valid list',
    });
    const all = JSON.stringify(h.logs);
    expect(all).not.toContain('GEHEIMER-PROMPT-INHALT');
    expect(all).not.toContain('SYSTEM-PROMPT-INHALT');
  });

  it('unbekannter Fehler bleibt 500 INFERENCE_ERROR, wird aber geloggt', async () => {
    const h = harness(new Error('kaputt'));
    const res = await h.handler(briefRequest('generate'));
    expect(res.status).toBe(500);
    expect(h.logs.find((l) => l.scope === 'ai-gateway-error')).toMatchObject({ code: 'INFERENCE_ERROR', error: 'kaputt' });
  });

  it('Logzeile enthält keine Secrets aus der Provider-Meldung', async () => {
    const h = harness(new Error('Incorrect API key provided: sk-proj-ABCDEFGHIJKLMNOP'));
    const res = await h.handler(briefRequest());
    expect(res.status).toBe(502);
    expect(JSON.stringify(h.logs)).not.toContain('ABCDEFGHIJKLMNOP');
    const body = await res.text();
    expect(body).not.toContain('ABCDEFGHIJKLMNOP');
  });

  it('Stream-Fehler wird ebenfalls geloggt', async () => {
    const h = harness(new Error('invalid x-api-key'));
    const res = await h.handler(briefRequest('stream'));
    const text = await res.text();
    expect(text).toContain('UPSTREAM_AUTH_FAILED');
    expect(h.logs.find((l) => l.scope === 'ai-gateway-error')).toMatchObject({ code: 'UPSTREAM_AUTH_FAILED' });
  });
});

describe('localEndpoint — lokale Base-URL in der gehosteten Edge-Runtime', () => {
  it.each([
    'localhost', '127.0.0.1', '10.0.0.5', '192.168.1.20', '172.16.3.4', '172.31.0.1',
    '169.254.1.1', '0.0.0.0', 'host.docker.internal', 'lmstudio.local', '::1', '[::1]', 'fd12:3456::1', 'fe80::1',
  ])('%s gilt als lokal', (h) => expect(isLocalOnlyHost(h)).toBe(true));

  it.each(['llm.example.com', '8.8.8.8', '172.32.0.1', 'fdroid.example.org', 'fcbarcelona.com', 'api.anthropic.com'])(
    '%s gilt als öffentlich',
    (h) => expect(isLocalOnlyHost(h)).toBe(false),
  );

  it('nur im gehosteten Supabase wird ein lokaler Host verworfen', () => {
    expect(isHostedSupabase(HOSTED)).toBe(true);
    expect(isHostedSupabase('http://127.0.0.1:54321')).toBe(false);
    expect(checkLocalEndpoint('http://localhost:1234/v1', HOSTED)).toEqual({ ok: false, reason: 'local_only_host', host: 'localhost' });
    expect(checkLocalEndpoint('http://localhost:1234/v1', 'http://kong:8000')).toEqual({ ok: true });
    expect(checkLocalEndpoint('https://lmstudio.example.com/v1', HOSTED)).toEqual({ ok: true });
    expect(checkLocalEndpoint('not a url', HOSTED)).toMatchObject({ ok: false, reason: 'invalid_url' });
  });

  it('Meldung des deaktivierten lokalen Slots zählt als Transportfehler (→ Cloud-Kette)', () => {
    expect(isTransportLevelFailure(new Error(LOCAL_UNREACHABLE_MESSAGE))).toBe(true);
  });
});

// serverFromEnv selbst lädt supabase-js per jsr:-Import (Vault) und ist
// unter jsdom nicht importierbar. Die Entscheidung liegt deshalb rein in
// localEndpoint.ts (decideLocalSlot / UnreachableLocalAdapter) und wird hier
// zusammen mit dem echten ServerAiGateway-Router geprüft.
describe('Provider-Aufbau mit lokaler Base-URL in der Cloud', () => {
  afterEach(() => { vi.restoreAllMocks(); });
  const base = { envName: 'LM_STUDIO_BASE_URL', supabaseUrl: HOSTED };

  it('localhost + keine Cloud-Kette → 503 LOCAL_PROVIDER_UNREACHABLE (nennt nur Variablennamen)', () => {
    const d = decideLocalSlot({ ...base, baseUrl: 'http://localhost:1234/v1', hasCloud: false });
    expect(d.action).toBe('fail');
    if (d.action !== 'fail') return;
    expect(d.status).toBe(503);
    expect(d.code).toBe('LOCAL_PROVIDER_UNREACHABLE');
    expect(d.message).toContain('LM_STUDIO_BASE_URL');
    expect(d.message).not.toContain('localhost:1234');
  });

  it('localhost + Cloud-Kette → Slot deaktivieren; öffentliche URL / lokale Entwicklung → nutzen', () => {
    expect(decideLocalSlot({ ...base, baseUrl: 'http://127.0.0.1:1234/v1', hasCloud: true })).toEqual({ action: 'disable', reason: 'local_only_host' });
    expect(decideLocalSlot({ ...base, baseUrl: 'https://lmstudio.example.com/v1', hasCloud: false })).toEqual({ action: 'use' });
    expect(decideLocalSlot({ ...base, supabaseUrl: 'http://127.0.0.1:54321', baseUrl: 'http://localhost:1234/v1', hasCloud: false })).toEqual({ action: 'use' });
    expect(decideLocalSlot({ ...base, baseUrl: undefined, hasCloud: false })).toEqual({ action: 'use' });
  });

  it('deaktivierter Slot + Anthropic → kein Probe gegen localhost, direkt Cloud-Kette', async () => {
    const seen: string[] = [];
    const anthropic = {
      id: 'anthropic' as const,
      health: async () => ({ ok: true }),
      generate: async () => { throw new Error('unused'); },
      extractJson: async <T,>(r: AiGatewayRequest) => {
        seen.push(r.feature);
        return { provider: 'anthropic', model: 'claude', profile: r.model_profile, output: { narrative_de: 'ok' } as T, trace_id: 't', latency_ms: 1 };
      },
      embed: async () => { throw new Error('unused'); },
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const gw = new ServerAiGateway({
      lmStudio: new UnreachableLocalAdapter('lm_studio'),
      lmStudioBaseUrl: 'http://127.0.0.1:1234/v1',
      // deno-lint-ignore no-explicit-any
      anthropic: anthropic as any,
    });
    const res = await gw.extractJson<{ narrative_de: string }>({
      feature: 'governance_brief_daily', task_type: 'governance_reasoning', model_profile: 'strict-json', input: 'x', system_prompt: 's',
    });
    expect(res.provider).toBe('anthropic');
    expect(res.output).toEqual({ narrative_de: 'ok' });
    expect(seen).toEqual(['governance_brief_daily']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('deaktivierter Slot OHNE Cloud-Kette (Nutzer-/anon-Pfad) → Fehler, kein stiller Wechsel', async () => {
    const gw = new ServerAiGateway({ lmStudio: new UnreachableLocalAdapter('lm_studio'), lmStudioBaseUrl: 'http://127.0.0.1:1' });
    await expect(gw.generate({ feature: 'f', task_type: 'chat', model_profile: 'fast-local', input: 'x' })).rejects.toThrow(LOCAL_UNREACHABLE_MESSAGE);
  });

  it('serverFromEnv nutzt decideLocalSlot + UnreachableLocalAdapter und liest Cloud-Keys nur bei allowCloudFallback', () => {
    const src = readFileSync(repoFile('supabase/functions/_shared/aiGateway/serverFromEnv.ts'), 'utf8');
    expect(src).toMatch(/decideLocalSlot\(/);
    expect(src).toMatch(/new UnreachableLocalAdapter\(/);
    expect(src).toMatch(/if \(opts\.allowCloudFallback\) \{\s*\[anthropicKey, openaiKey\]/);
  });
});

describe('Governance-Brief-Runner — Payload und Fehlertext', () => {
  const src = readFileSync(repoFile('supabase/functions/_shared/agents/governanceBriefRunner.ts'), 'utf8');

  it('sendet input als String und den Systemprompt in system_prompt', () => {
    expect(src).not.toMatch(/input:\s*\{\s*system/);
    expect(src).toMatch(/input:\s*user,/);
    expect(src).toMatch(/system_prompt:\s*system,/);
    expect(src).toMatch(/tenant_id:\s*tenantId/);
    expect(src).toContain("internalGatewayConfig('agent-os-runner'");
  });

  it('describeGatewayError liefert Status + stabilen Code + gekürzte Meldung', async () => {
    const { describeGatewayError } = await import('../../supabase/functions/_shared/agents/governanceBriefRunner.ts');
    const resp = new Response(JSON.stringify({ ok: false, error: { code: 'UPSTREAM_REJECTED', message: 'm'.repeat(500) } }), { status: 502 });
    const msg = await describeGatewayError(resp);
    expect(msg.startsWith('ai-gateway 502 UPSTREAM_REJECTED: ')).toBe(true);
    expect(msg.length).toBeLessThan(260);
    expect(await describeGatewayError(new Response('not json', { status: 500 }))).toBe('ai-gateway 500: not json');
  });

  it('agent-os-runner schreibt brief_failed ins Function-Log', () => {
    const runner = readFileSync(repoFile('supabase/functions/agent-os-runner/index.ts'), 'utf8');
    expect(runner).toContain("event: 'brief_failed'");
  });
});

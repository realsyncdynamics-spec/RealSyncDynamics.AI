// WP9 (M3): Evidence-Nachweis pro angemeldetem KI-Call in `ai_evidence_events`.
//
// Prüft:
//   1. Erfolgreicher Call (generate, extract_json, embed, /v1/chat/completions)
//      erzeugt genau einen `ai_evidence_events`-Eintrag (`ai:call`, risk_level 'info').
//   2. PDP-Warnung (`decision: 'warn'`) → Antwort 200 + `ai:call` mit risk_level 'low',
//      policy_id und Begründungen.
//   3. PDP-Block (`pdpCheck` liefert 403 Response) → kein Provider-Aufruf,
//      403 an Client + `ai:call_blocked` mit risk_level 'high'.
//   4. Streaming (`op: 'stream'` sowie `/v1/chat/completions` mit `stream: true`)
//      schreibt den Evidence-Eintrag beim `done`-Chunk (`onDone`).
//   5. Schreibfehler in `recordEvidence` → fail-open (Antwort bleibt 200 bzw. 403)
//      und strukturierter Alarm-Log (`scope: 'ai-gateway-evidence'`, `event: 'record_failed'`).
//   6. Datenminimierung: Weder Prompt- noch Antwort-Klartext im Evidence-JSON oder
//      `event_summary` — nur `input_length` und `input_sha256`.
//   7. Anonymer Pfad (`mode: 'audit_anon'`), unauthentifizierte Aufrufe (401/403)
//      und `health` bleiben unverändert und schreiben kein `ai_evidence_events`.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createAiGatewayHandler,
  type AiEvidenceEventInsert,
  type GatewayHandlerDeps,
  type GatewayLike,
  type PdpVerdict,
  type VerifiedAuth,
} from '../../supabase/functions/ai-gateway/handler.ts';
import {
  buildAiCallEvidenceRow,
  recordAiCallEvidence,
  riskLevelForVerdict,
  normalizeVerdict,
  resolveResidencyAndRegion,
} from '../../supabase/functions/_shared/aiGateway/callEvidence.ts';
import { sha256Hex } from '../../supabase/functions/_shared/hash.ts';

const repoFile = (p: string) => resolve(__dirname, '../..', p);

const ANON_KEY = 'sb_publishable_test_anon_key';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.user-u1.sig';
const INTERNAL_KEY = 'k'.repeat(48);
const TURNSTILE_SECRET = 'ts-secret-DO-NOT-LOG-0123456789';
const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';
const POLICY_ID = '00000000-0000-0000-0000-00000000a003';
const URL_OP = 'https://x.supabase.co/functions/v1/ai-gateway';
const URL_CHAT = 'https://x.supabase.co/functions/v1/ai-gateway/v1/chat/completions';

function jsonErr(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function fakeAuth(req: Request, tenant: string | null | undefined): Promise<VerifiedAuth | Response> {
  if (req.headers.get('Authorization') !== `Bearer ${USER_TOKEN}`) {
    return jsonErr(401, 'UNAUTHORIZED', 'no user');
  }
  if (!tenant) return jsonErr(400, 'BAD_REQUEST', 'tenant_id is required');
  if (tenant !== T1) return jsonErr(403, 'FORBIDDEN', 'not a member');
  return { user: { id: 'u1' }, tenantId: tenant, admin: {} };
}

const USAGE = { input_tokens: 24, output_tokens: 16, total_tokens: 40 };

interface EvidenceHarnessOpts {
  failEvidence?: boolean;
  withEvidenceRecorder?: boolean;
  pdpResult?: Response | PdpVerdict | null;
}

function makeEvidenceHarness(opts: EvidenceHarnessOpts = {}) {
  const evidenceRows: AiEvidenceEventInsert[] = [];
  const logs: Array<Record<string, unknown>> = [];
  let providerCalls = 0;

  const reply = async () => {
    providerCalls += 1;
    return {
      provider: 'lm_studio' as const,
      model: 'qwen2.5-7b-instruct',
      profile: 'fast-local' as const,
      output: 'STRrengGeheimeAntwortVomModell42',
      usage: USAGE,
      trace_id: 'trace-99',
      latency_ms: 37,
    };
  };

  const gateway: GatewayLike = {
    health: async () => ({ ok: true }),
    generate: reply,
    extractJson: async () => ({ ...(await reply()), output: { secret: 'AntwortJSONGeheim' } }),
    embed: async () => ({ ...(await reply()), output: [0.1, 0.2] }),
    async *generateStream() {
      providerCalls += 1;
      yield { event: 'delta', text: 'GeheimerStreamText' };
      yield {
        event: 'done',
        provider: 'lm_studio',
        model: 'qwen2.5-7b-instruct',
        usage: { input_tokens: 11, output_tokens: 5, total_tokens: 16 },
        trace_id: 'stream-trace-1',
        latency_ms: 52,
      };
    },
  };

  let clock = 1_000_000;
  const deps: GatewayHandlerDeps = {
    env: (n) => {
      if (n === 'AI_GATEWAY_INTERNAL_KEY') return INTERNAL_KEY;
      if (n === 'TURNSTILE_SECRET_KEY') return TURNSTILE_SECRET;
      return undefined;
    },
    requireAuthAndTenant: fakeAuth,
    gateBuilder: async () => null,
    buildGateway: async () => gateway,
    pdpCheck: async () => opts.pdpResult ?? null,
    anonAuditLog: async () => ({
      reserve: async () => {},
      complete: async () => {},
    }),
    turnstileFetch: (async () =>
      new Response(
        JSON.stringify({ success: true, hostname: 'realsyncdynamicsai.de', action: 'audit_copilot' }),
        { status: 200 },
      )) as unknown as typeof fetch,
    now: () => (clock += 25),
    newId: () => 'req-wp9-001',
    log: (l) => logs.push(l),
    ...(opts.withEvidenceRecorder === false
      ? {}
      : {
          recordEvidence: async (entry) => {
            if (opts.failEvidence) throw new Error('ai_evidence_events insert failed: connection reset');
            evidenceRows.push(entry);
          },
        }),
  };

  return {
    handler: createAiGatewayHandler(deps),
    evidenceRows,
    logs,
    getProviderCalls: () => providerCalls,
  };
}

function opReq(body: Record<string, unknown>, headers: Record<string, string> = {}): Request {
  return new Request(URL_OP, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function chatReq(body: Record<string, unknown>, headers: Record<string, string> = {}): Request {
  return new Request(URL_CHAT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const userHeaders = { Authorization: `Bearer ${USER_TOKEN}` };
const internalHeaders = { 'x-internal-key': INTERNAL_KEY, 'x-internal-caller': 'governance-agent' };

const baseBody = {
  op: 'generate',
  tenant_id: T1,
  feature: 'governance_ai_workspace',
  task_type: 'chat',
  model_profile: 'fast-local',
  input: 'Vertraulicher Mandanten-Prompt mit geheimem Inhalt 987654321',
};

describe('callEvidence Helper — reine Funktionen & DB-Wrapper', () => {
  it('mappt PDP-Verdikte korrekt auf risk_level und event_type', async () => {
    expect(riskLevelForVerdict(normalizeVerdict('allow'))).toBe('info');
    expect(riskLevelForVerdict(normalizeVerdict(null))).toBe('info');
    expect(riskLevelForVerdict(normalizeVerdict('warn'))).toBe('low');
    expect(riskLevelForVerdict(normalizeVerdict('log_only'))).toBe('low');
    expect(riskLevelForVerdict(normalizeVerdict('block'))).toBe('high');
    expect(riskLevelForVerdict(normalizeVerdict('require_approval'))).toBe('high');
    expect(riskLevelForVerdict(normalizeVerdict('allow', true))).toBe('high');
  });

  it('leitet Residency und Region aus Provider ab', () => {
    expect(resolveResidencyAndRegion('lm_studio')).toEqual({ residency: 'eu_local', providerRegion: 'EU' });
    expect(resolveResidencyAndRegion('ollama')).toEqual({ residency: 'eu_local', providerRegion: 'EU' });
    expect(resolveResidencyAndRegion('anthropic')).toEqual({ residency: 'cloud', providerRegion: 'cloud' });
    expect(resolveResidencyAndRegion('openai')).toEqual({ residency: 'cloud', providerRegion: 'cloud' });
  });

  it('recordAiCallEvidence schreibt in ai_evidence_events und wirft bei DB-Fehler', async () => {
    const inserted: Array<{ table: string; row: Record<string, unknown> }> = [];
    const row = await buildAiCallEvidenceRow({
      tenantId: T1,
      path: 'user',
      userId: 'u1',
      feature: 'kodee_chat',
      route: '/',
      op: 'generate',
      provider: 'lm_studio',
      model: 'qwen2.5',
      modelProfile: 'fast-local',
      usage: { input_tokens: 5, output_tokens: 7 },
      verdict: 'allow',
      requestId: 'req-1',
      latencyMs: 12,
      input: 'Hallo Welt',
    });

    await recordAiCallEvidence(
      {
        from(table: string) {
          return {
            async insert(r: Record<string, unknown>) {
              inserted.push({ table, row: r });
              return { error: null };
            },
          };
        },
      },
      row,
    );

    expect(inserted).toHaveLength(1);
    expect(inserted[0].table).toBe('ai_evidence_events');
    expect(inserted[0].row.tenant_id).toBe(T1);

    await expect(
      recordAiCallEvidence(
        {
          from() {
            return {
              async insert() {
                return { error: { message: 'disk full' } };
              },
            };
          },
        },
        row,
      ),
    ).rejects.toThrow(/disk full/);
  });
});

describe('ai-gateway — WP9 Evidence pro angemeldetem KI-Call', () => {
  it('Erfolg (Nutzerpfad): erzeugt genau 1 ai_evidence_events-Eintrag mit Metadaten, Tokens und Residency', async () => {
    const h = makeEvidenceHarness();
    const res = await h.handler(opReq({ ...baseBody, user_id: 'spoofed-user' }, userHeaders));
    expect(res.status).toBe(200);
    expect(h.evidenceRows).toHaveLength(1);

    const row = h.evidenceRows[0];
    expect(row.tenant_id).toBe(T1);
    expect(row.event_type).toBe('ai:call');
    expect(row.risk_level).toBe('info');
    expect(row.policy_id).toBeNull();
    expect(row.evidence).toMatchObject({
      tenant_id: T1,
      path: 'user',
      user_id: 'u1',
      internal_caller: null,
      feature: 'governance_ai_workspace',
      route: '/',
      op: 'generate',
      provider: 'lm_studio',
      model: 'qwen2.5-7b-instruct',
      model_profile: 'fast-local',
      provider_region: 'EU',
      residency: 'eu_local',
      tokens: { input: 24, output: 16, total: 40 },
      input_tokens: 24,
      output_tokens: 16,
      total_tokens: 40,
      verdict: 'allow',
      pdp_decision: 'allow',
      request_id: 'trace-99',
      latency_ms: 37,
      input_length: baseBody.input.length,
      input_sha256: await sha256Hex(baseBody.input),
    });
  });

  it('Datenminimierung: speichert weder Prompt- noch Antwort-Klartext im Evidence-JSON oder event_summary', async () => {
    const secretPrompt = 'SENSITIVER_PROMPT_PERSONENBEZOGEN_MAX_MUSTERMANN_IBAN_DE89370400440532013000';
    const secretSystem = 'GEHEIMER_SYSTEM_PROMPT_NICHT_SPEICHERN';
    const h = makeEvidenceHarness();

    const res = await h.handler(
      opReq({ ...baseBody, input: secretPrompt, system_prompt: secretSystem }, userHeaders),
    );
    expect(res.status).toBe(200);
    expect(h.evidenceRows).toHaveLength(1);

    const serialized = JSON.stringify(h.evidenceRows[0]);
    expect(serialized).not.toContain(secretPrompt);
    expect(serialized).not.toContain('MAX_MUSTERMANN');
    expect(serialized).not.toContain(secretSystem);
    expect(serialized).not.toContain('STRrengGeheimeAntwortVomModell42');
    expect(h.evidenceRows[0].evidence.input_length).toBe(secretPrompt.length);
    expect(h.evidenceRows[0].evidence.input_sha256).toBe(await sha256Hex(secretPrompt));
    expect('input' in h.evidenceRows[0].evidence).toBe(false);
    expect('output' in h.evidenceRows[0].evidence).toBe(false);
    expect('system_prompt' in h.evidenceRows[0].evidence).toBe(false);
  });

  it('PDP-Warnung (warn): Antwort 200 mit governance-Hinweis + Evidence-Eintrag mit risk_level low', async () => {
    const h = makeEvidenceHarness({
      pdpResult: {
        decision: 'warn',
        reasons: [{ text_de: ' Drittland-Hinweis gemäß Richtlinie ' }],
        primary_policy_id: POLICY_ID,
      },
    });
    const res = await h.handler(opReq(baseBody, userHeaders));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { governance?: { decision: string; reasons: string[] } };
    expect(body.governance?.decision).toBe('warn');

    expect(h.evidenceRows).toHaveLength(1);
    const row = h.evidenceRows[0];
    expect(row.event_type).toBe('ai:call');
    expect(row.risk_level).toBe('low');
    expect(row.policy_id).toBe(POLICY_ID);
    expect(row.evidence.verdict).toBe('warn');
    expect(row.evidence.reasons).toEqual([' Drittland-Hinweis gemäß Richtlinie ']);
  });

  it('PDP-Block (pdpCheck liefert Response): kein Provider-Aufruf, 403 an Client + 1 ai:call_blocked Eintrag (risk_level high)', async () => {
    const h = makeEvidenceHarness({
      pdpResult: jsonErr(403, 'POLICY_BLOCKED', 'Durch Unternehmensrichtlinie blockiert.'),
    });
    const res = await h.handler(opReq(baseBody, userHeaders));
    expect(res.status).toBe(403);
    expect(h.getProviderCalls()).toBe(0);

    expect(h.evidenceRows).toHaveLength(1);
    const row = h.evidenceRows[0];
    expect(row.tenant_id).toBe(T1);
    expect(row.event_type).toBe('ai:call_blocked');
    expect(row.risk_level).toBe('high');
    expect(row.evidence.verdict).toBe('block');
    expect(row.evidence.tokens).toEqual({ input: 0, output: 0, total: 0 });
    expect(JSON.stringify(row)).not.toContain(baseBody.input);
  });

  it('PDP-Block auf /v1/chat/completions: 403 + 1 ai:call_blocked Eintrag ohne Prompt-Klartext', async () => {
    const h = makeEvidenceHarness({
      pdpResult: jsonErr(403, 'POLICY_BLOCKED', 'Blockiert.'),
    });
    const secretMsg = 'Geheime Chat-Nachricht im OpenAI-Format';
    const res = await h.handler(
      chatReq({ model: 'fast-local', messages: [{ role: 'user', content: secretMsg }], tenant_id: T1 }, userHeaders),
    );
    expect(res.status).toBe(403);
    expect(h.getProviderCalls()).toBe(0);
    expect(h.evidenceRows).toHaveLength(1);
    expect(h.evidenceRows[0].event_type).toBe('ai:call_blocked');
    expect(h.evidenceRows[0].risk_level).toBe('high');
    expect(h.evidenceRows[0].evidence.route).toBe('/v1/chat/completions');
    expect(JSON.stringify(h.evidenceRows[0])).not.toContain(secretMsg);
  });

  it('Streaming (op: stream): erzeugt genau 1 Evidence-Eintrag nach Stream-Abschluss (onDone)', async () => {
    const h = makeEvidenceHarness();
    const res = await h.handler(opReq({ ...baseBody, op: 'stream' }, userHeaders));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"event":"done"');

    expect(h.evidenceRows).toHaveLength(1);
    const row = h.evidenceRows[0];
    expect(row.event_type).toBe('ai:call');
    expect(row.risk_level).toBe('info');
    expect(row.evidence).toMatchObject({
      tenant_id: T1,
      route: '/',
      op: 'stream',
      provider: 'lm_studio',
      model: 'qwen2.5-7b-instruct',
      tokens: { input: 11, output: 5, total: 16 },
      request_id: 'stream-trace-1',
      latency_ms: 52,
    });
    expect(JSON.stringify(row)).not.toContain('GeheimerStreamText');
  });

  it('OpenAI-kompatibler Pfad (/v1/chat/completions, sync & stream): schreibt Evidence-Eintrag', async () => {
    const h = makeEvidenceHarness();
    const resSync = await h.handler(
      chatReq({ model: 'fast-local', messages: [{ role: 'user', content: 'Hallo' }], tenant_id: T1 }, userHeaders),
    );
    expect(resSync.status).toBe(200);
    expect(h.evidenceRows).toHaveLength(1);
    expect(h.evidenceRows[0].evidence).toMatchObject({
      tenant_id: T1,
      route: '/v1/chat/completions',
      op: 'chat.completions',
      feature: 'openai_compat',
    });

    const resStream = await h.handler(
      chatReq(
        { model: 'fast-local', stream: true, messages: [{ role: 'user', content: 'Hallo Stream' }], tenant_id: T1 },
        userHeaders,
      ),
    );
    expect(resStream.status).toBe(200);
    await resStream.text();
    expect(h.evidenceRows).toHaveLength(2);
    expect(h.evidenceRows[1].evidence).toMatchObject({
      tenant_id: T1,
      route: '/v1/chat/completions',
      op: 'chat.completions.stream',
      feature: 'openai_compat',
      tokens: { input: 11, output: 5, total: 16 },
    });
  });

  it('Service-Pfad: mit tenant_id wird Evidence mit internal_caller gebucht, ohne tenant_id nicht', async () => {
    const h = makeEvidenceHarness();
    const resWithTenant = await h.handler(
      opReq({ ...baseBody, op: 'extract_json', model_profile: 'strict-json' }, internalHeaders),
    );
    expect(resWithTenant.status).toBe(200);
    expect(h.evidenceRows).toHaveLength(1);
    expect(h.evidenceRows[0].evidence).toMatchObject({
      tenant_id: T1,
      path: 'service',
      user_id: null,
      internal_caller: 'governance-agent',
      op: 'extract_json',
    });

    const withoutTenant: Record<string, unknown> = { ...baseBody };
    delete withoutTenant.tenant_id;
    const resNoTenant = await h.handler(opReq(withoutTenant, internalHeaders));
    expect(resNoTenant.status).toBe(200);
    expect(h.evidenceRows).toHaveLength(1);
  });

  it('Fehlerverhalten (fail-open + Alarm-Log): Evidence-Schreibfehler bricht weder 200- noch 403-Antwort', async () => {
    const hOk = makeEvidenceHarness({ failEvidence: true });
    const resOk = await hOk.handler(opReq(baseBody, userHeaders));
    expect(resOk.status).toBe(200);
    const errLog = hOk.logs.find((l) => l.scope === 'ai-gateway-evidence');
    expect(errLog).toMatchObject({
      scope: 'ai-gateway-evidence',
      event: 'record_failed',
      tenant_id: T1,
      feature: 'governance_ai_workspace',
      route: '/',
    });

    const hBlocked = makeEvidenceHarness({
      failEvidence: true,
      pdpResult: jsonErr(403, 'POLICY_BLOCKED', 'Blockiert.'),
    });
    const resBlocked = await hBlocked.handler(opReq(baseBody, userHeaders));
    expect(resBlocked.status).toBe(403);
    expect(hBlocked.logs.some((l) => l.scope === 'ai-gateway-evidence' && l.event === 'record_failed')).toBe(true);
  });

  it('Anonymer Pfad (mode: audit_anon), unauthentifizierte Calls und health erzeugen keinen ai_evidence_events-Eintrag', async () => {
    const h = makeEvidenceHarness();

    // 1. Anon Audit-Copilot
    const resAnon = await h.handler(
      opReq(
        { mode: 'audit_anon', turnstile_token: 'tok-ok', input: { question: 'Was bedeutet Befund X?' } },
        { apikey: ANON_KEY, 'x-forwarded-for': '203.0.113.77' },
      ),
    );
    expect(resAnon.status).toBe(200);

    // 2. Unauthentifiziert (401) und fremder Tenant (403)
    expect((await h.handler(opReq(baseBody))).status).toBe(401);
    expect((await h.handler(opReq({ ...baseBody, tenant_id: T2 }, userHeaders))).status).toBe(403);

    // 3. Health-Check
    expect((await h.handler(opReq({ op: 'health', tenant_id: T1 }, userHeaders))).status).toBe(200);

    expect(h.evidenceRows).toHaveLength(0);
  });

  it('Verdrahtungs-Check: ai-gateway/index.ts und ai-invoke/index.ts binden callEvidence ein', () => {
    const gwIndex = readFileSync(repoFile('supabase/functions/ai-gateway/index.ts'), 'utf8');
    expect(gwIndex).toContain('recordAiCallEvidence');
    expect(gwIndex).toContain('recordEvidence: recordGatewayEvidence');

    const aiInvoke = readFileSync(repoFile('supabase/functions/ai-invoke/index.ts'), 'utf8');
    expect(aiInvoke).toContain('buildAiCallEvidenceRow');
    expect(aiInvoke).toContain('recordAiCallEvidence');
    expect(aiInvoke).toContain("scope: 'ai-invoke-evidence'");
  });
});

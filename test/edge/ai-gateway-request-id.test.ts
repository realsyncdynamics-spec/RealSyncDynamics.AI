/**
 * Fix 3 (MP-0 Nachtrag, Codex P2 ai-gateway/handler.ts:492):
 * Die erzeugte Request-ID muss in den Provider-Request.
 *
 * Das Finding trifft zu. Belegt am Pfad:
 *   - handler.govern() erzeugte die ID lokal (`request.trace_id ?? newId()`),
 *     schrieb sie aber nicht zurueck in den Request.
 *   - router.ts:163 setzt `trace_id: request.trace_id ?? crypto.randomUUID()`
 *     — ohne Rueckschreiben also eine ZWEITE ID.
 *   - openaiCompat.ts:159 baut die Antwort-ID aus `response.trace_id`.
 * Ergebnis vorher: die Antwort trug eine andere ID als die Evidence, eine
 * vom Nutzer gemeldete Antwort-ID liess sich dem Pruefpfad nicht zuordnen.
 *
 * Der governance-router macht es seit MP-0 richtig (index.ts: 380/381);
 * dieser Fix zieht den ai-gateway nach.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createAiGatewayHandler,
  type GatewayHandlerDeps,
  type GatewayLike,
  type VerifiedAuth,
} from '../../supabase/functions/ai-gateway/handler.ts';
import type { AiEvidenceEventInsert } from '../../supabase/functions/_shared/aiGateway/callEvidence.ts';
import type { AiGatewayRequest } from '../../supabase/functions/_shared/aiGateway/types.ts';

const USER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.user-u1.sig';
const T1 = '11111111-1111-4111-8111-111111111111';
const URL_OP = 'https://x.supabase.co/functions/v1/ai-gateway';
const NEW_ID = 'req-fix3';

async function fakeAuth(req: Request, tenant: string | null | undefined): Promise<VerifiedAuth | Response> {
  if (req.headers.get('Authorization') !== `Bearer ${USER_TOKEN}`) {
    return new Response('{}', { status: 401 });
  }
  return { user: { id: 'u1' }, tenantId: tenant as string, admin: {} };
}

function harness() {
  const evidence: AiEvidenceEventInsert[] = [];
  /** Requests, wie der Provider sie sieht. */
  const seen: AiGatewayRequest[] = [];

  const gateway: GatewayLike = {
    health: async () => ({ ok: true }),
    generate: async (request: AiGatewayRequest) => {
      seen.push(request);
      // Wie ServerAiGateway (router.ts:163): die Antwort uebernimmt die
      // trace_id des Requests, sonst eine neue.
      return {
        provider: 'ollama',
        model: 'llama3.1:8b',
        output: 'ok',
        usage: { input_tokens: 1, output_tokens: 1 },
        trace_id: request.trace_id ?? 'ZWEITE-ID',
      };
    },
    extractJson: async () => ({ provider: 'ollama', model: 'm', output: { ok: true } }),
    embed: async () => ({ provider: 'ollama', model: 'm', output: [0.1] }),
    async *generateStream() { yield { event: 'done' }; },
  };

  const deps: GatewayHandlerDeps = {
    env: (n) => (n === 'AI_GATEWAY_LOCAL_REGION' ? 'eu' : undefined),
    requireAuthAndTenant: fakeAuth,
    gateBuilder: async () => null,
    buildGateway: async () => gateway,
    pdpCheck: async () => null,
    providerTarget: () => ({ provider: 'ollama', localRegion: 'eu' }),
    anonAuditLog: async () => null,
    log: () => {},
    newId: () => NEW_ID,
    recordEvidence: async (e) => { evidence.push(e); },
  };

  return { handler: createAiGatewayHandler(deps), evidence, seen };
}

const body = {
  op: 'generate',
  feature: 'governance_brief_daily',
  task_type: 'chat',
  model_profile: 'fast-local',
  input: 'Hallo',
  tenant_id: T1,
};

function opReq(extra: Record<string, unknown> = {}): Request {
  return new Request(URL_OP, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${USER_TOKEN}` },
    body: JSON.stringify({ ...body, ...extra }),
  });
}

function requestIdsOf(evidence: AiEvidenceEventInsert[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const e of evidence) {
    out[e.event_type] = (e.evidence as { request_id?: string | null }).request_id ?? null;
  }
  return out;
}

describe('Request-ID wird in den Provider-Request uebertragen', () => {
  it('ohne trace_id vom Aufrufer: Provider-Request traegt die erzeugte ID', async () => {
    const h = harness();
    const res = await h.handler(opReq());
    expect(res.status).toBe(200);

    expect(h.seen).toHaveLength(1);
    expect(h.seen[0].trace_id).toBe(NEW_ID);
  });

  it('started- und Abschluss-Evidence tragen dieselbe ID wie die Antwort', async () => {
    const h = harness();
    const res = await h.handler(opReq());
    expect(res.status).toBe(200);

    const ids = requestIdsOf(h.evidence);
    expect(ids['ai:call_started']).toBe(NEW_ID);
    expect(ids['ai:call']).toBe(NEW_ID);

    // Die Antwort des Providers haette ohne Rueckschreiben 'ZWEITE-ID'
    // getragen — genau der im Finding beschriebene Bruch.
    expect(h.seen[0].trace_id).toBe(NEW_ID);
    expect(h.seen[0].trace_id).not.toBe('ZWEITE-ID');
  });

  it('eine vom Aufrufer gesetzte trace_id bleibt unveraendert', async () => {
    const h = harness();
    const res = await h.handler(opReq({ trace_id: 'vom-aufrufer' }));
    expect(res.status).toBe(200);

    expect(h.seen[0].trace_id).toBe('vom-aufrufer');
    const ids = requestIdsOf(h.evidence);
    expect(ids['ai:call_started']).toBe('vom-aufrufer');
    expect(ids['ai:call']).toBe('vom-aufrufer');
  });

  it('das Rueckschreiben steht vor der Evidence-Reservierung', () => {
    const src = readFileSync(
      resolve(__dirname, '../../supabase/functions/ai-gateway/handler.ts'),
      'utf8',
    );
    const writeBack = src.indexOf('request.trace_id = requestId');
    const reserve = src.indexOf("stage: 'started'");
    expect(writeBack).toBeGreaterThan(0);
    expect(reserve).toBeGreaterThan(writeBack);
  });
});

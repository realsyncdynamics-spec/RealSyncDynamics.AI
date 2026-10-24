import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import {
  createGatewayApp,
  mapVoiceStartError,
  resetProcessVoiceRuntimeForTests,
  VOICE_HTTP_INSTRUCTIONS_DEFAULT,
} from '../src/gateway.js';
import type { Env } from '../src/env.js';
import {
  GrokProvider,
  type RealtimeSocketEvent,
  type RealtimeSocketEventType,
  type RealtimeSocketInit,
  type RealtimeSocketLike,
} from '../src/providers/grok-provider.js';
import {
  VoiceSessionRuntime,
  createMemoryVoiceStore,
  createVoiceToolClient,
  createVoiceToolGateway,
  type VoiceConsentVerifier,
  type VoiceToolHttpOutcome,
} from '../src/voice/session-runtime.js';
import type { VoiceSessionConfig, VoiceProviderSession } from '../src/voice-provider-types.js';

const TOKEN = 'test-voice-session-token';
const TENANT = '11111111-1111-1111-1111-111111111111';
const BOT = '22222222-2222-2222-2222-222222222222';
const DISCLOSURE = 'Hinweis: Sie sprechen mit einem KI-Assistenten.';
const POLICY = 'appointment.booking.v1';

class MockSocket implements RealtimeSocketLike {
  readyState = 0;
  readonly sent: Array<Record<string, unknown>> = [];
  private readonly listeners = new Map<RealtimeSocketEventType, Set<(e: RealtimeSocketEvent) => void>>();

  constructor(
    readonly url: string,
    readonly init: RealtimeSocketInit,
  ) {}

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(): void {
    this.readyState = 3;
    queueMicrotask(() => this.dispatch('close', { code: 1000, reason: '' }));
  }

  addEventListener(type: RealtimeSocketEventType, l: (e: RealtimeSocketEvent) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(l);
  }

  removeEventListener(type: RealtimeSocketEventType, l: (e: RealtimeSocketEvent) => void): void {
    this.listeners.get(type)?.delete(l);
  }

  open(): void {
    this.readyState = 1;
    this.dispatch('open', {});
  }

  server(msg: Record<string, unknown>): void {
    this.dispatch('message', { data: JSON.stringify(msg) });
  }

  private dispatch(type: RealtimeSocketEventType, e: RealtimeSocketEvent): void {
    for (const l of [...(this.listeners.get(type) ?? [])]) l(e);
  }
}

const tick = () => new Promise<void>((r) => setImmediate(r));

function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    nodeEnv: 'test',
    port: 0,
    apiToken: TOKEN,
    ollamaUrl: 'http://ollama',
    openclawUrl: 'http://openclaw',
    n8nUrl: 'http://n8n',
    ...overrides,
  };
}

interface Harness {
  store: ReturnType<typeof createMemoryVoiceStore>;
  createSessionCalls: VoiceSessionConfig[];
  sockets: MockSocket[];
  baseUrl: string;
  server: http.Server;
  runtime: VoiceSessionRuntime;
  /** Antworten von /voice-tool an die Runtime (nur mit loopback). */
  outcomes: VoiceToolHttpOutcome[];
}

async function startHarness(overrides: {
  seedConfig?: boolean;
  insertSessionThrows?: boolean;
  apiToken?: string | null;
  storeNull?: boolean;
  /** Runtime ruft /voice-tool dieses Servers echt per HTTP auf. */
  loopback?: boolean;
  verifyConsent?: VoiceConsentVerifier;
} = {}): Promise<Harness> {
  resetProcessVoiceRuntimeForTests();
  const store = createMemoryVoiceStore();
  if (overrides.seedConfig !== false && !overrides.storeNull) {
    store.seedBotConfig({
      tenantId: TENANT,
      botId: BOT,
      provider: 'grok',
      model: 'grok-voice-think-fast-2.0',
      voice: 'eve',
      language: 'de-DE',
      disclosureText: DISCLOSURE,
      policyRef: POLICY,
      offeredTools: ['lookup_kb', 'schedule_appointment'],
      status: 'active',
    });
  }
  if (overrides.insertSessionThrows) {
    store.insertSession = async () => {
      throw new Error('http_409: missing voice_sessions parent');
    };
  }

  const createSessionCalls: VoiceSessionConfig[] = [];
  const sockets: MockSocket[] = [];

  const baseProvider = new GrokProvider({
    socketFactory: (url, init) => {
      const s = new MockSocket(url, init);
      sockets.push(s);
      return s;
    },
    getApiKey: () => 'test-xai-key-not-real',
    connectTimeoutMs: 200,
    closeTimeoutMs: 50,
  });

  const provider = new Proxy(baseProvider, {
    get(target, prop, receiver) {
      if (prop === 'createSession') {
        return async (
          config: VoiceSessionConfig,
          onEvent: Parameters<GrokProvider['createSession']>[1],
        ): Promise<VoiceProviderSession> => {
          createSessionCalls.push(config);
          const pending = target.createSession(config, onEvent);
          await tick();
          const socket = sockets.at(-1);
          if (socket) {
            socket.open();
            socket.server({ type: 'session.created', session: { id: 'xai_1' } });
            socket.server({ type: 'session.updated', session: {} });
          }
          return pending;
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  const outcomes: VoiceToolHttpOutcome[] = [];
  let baseUrl = '';
  const runtime = new VoiceSessionRuntime({
    provider,
    store: overrides.storeNull ? null : store,
    toolGateway: overrides.storeNull
      ? createVoiceToolGateway({ env: {} })
      : createVoiceToolGateway({ store }),
    voiceToolClient: {
      evaluate: async (req) => {
        if (!overrides.loopback) return { ok: false, reason: 'unused' };
        const outcome = await createVoiceToolClient({ baseUrl, getApiToken: () => TOKEN }).evaluate(req);
        outcomes.push(outcome);
        return outcome;
      },
    },
    verifyConsent: overrides.verifyConsent,
  });

  const app = createGatewayApp({
    env: testEnv({ apiToken: overrides.apiToken === undefined ? TOKEN : overrides.apiToken }),
    voiceRuntime: runtime,
  });

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
  return {
    store,
    createSessionCalls,
    sockets,
    baseUrl,
    server,
    runtime,
    outcomes,
  };
}

async function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { status: res.status, json };
}

describe('POST /voice-sessions', () => {
  let h: Harness;

  before(async () => {
    // per-test harness in each it — nothing here
  });

  after(async () => {
    resetProcessVoiceRuntimeForTests();
  });

  it('401 ohne Auth und bei falschem Token; Store/Provider unberührt', async () => {
    h = await startHarness();
    try {
      const noAuth = await postJson(h.baseUrl, '/voice-sessions', { bot_id: BOT });
      assert.equal(noAuth.status, 401);
      assert.equal(noAuth.json.reason, 'missing_token');

      const bad = await postJson(
        h.baseUrl,
        '/voice-sessions',
        { bot_id: BOT },
        { Authorization: 'Bearer wrong-token' },
      );
      assert.equal(bad.status, 401);
      assert.equal(h.createSessionCalls.length, 0);
      assert.equal(h.store.listSessions(TENANT).length, 0);
    } finally {
      await new Promise<void>((r) => h.server.close(() => r()));
    }
  });

  it('startSession nutzt Server-Snapshot; voice_sessions trägt Config-Werte', async () => {
    h = await startHarness();
    try {
      const res = await postJson(
        h.baseUrl,
        '/voice-sessions',
        { bot_id: BOT },
        { Authorization: `Bearer ${TOKEN}` },
      );
      assert.equal(res.status, 201);
      assert.equal(res.json.ok, true);
      const sessionId = String(res.json.session_id);
      assert.match(sessionId, /^[0-9a-f-]{36}$/i);

      const rows = h.store.listSessions(TENANT);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.id, sessionId);
      assert.equal(rows[0]!.tenantId, TENANT);
      assert.equal(rows[0]!.botId, BOT);
      assert.equal(rows[0]!.model, 'grok-voice-think-fast-2.0');
      assert.equal(rows[0]!.policyRef, POLICY);
      assert.equal(rows[0]!.provider, 'grok');

      assert.equal(h.createSessionCalls.length, 1);
      assert.equal(h.createSessionCalls[0]!.tenantId, TENANT);
      assert.equal(h.createSessionCalls[0]!.disclosureText, DISCLOSURE);
      assert.equal(h.createSessionCalls[0]!.model, 'grok-voice-think-fast-2.0');
      assert.equal(h.createSessionCalls[0]!.instructions, VOICE_HTTP_INSTRUCTIONS_DEFAULT);
      assert.equal(h.createSessionCalls[0]!.sessionId, sessionId);
    } finally {
      await new Promise<void>((r) => h.server.close(() => r()));
    }
  });

  it('ohne consent im Body wird keine Einwilligung erfunden', async () => {
    h = await startHarness();
    try {
      const startCalls: Array<{ consent: unknown }> = [];
      const originalStart = h.runtime.startSession.bind(h.runtime);
      h.runtime.startSession = async (request) => {
        startCalls.push({ consent: request.consent });
        return originalStart(request);
      };

      const res = await postJson(
        h.baseUrl,
        '/voice-sessions',
        { bot_id: BOT },
        { Authorization: `Bearer ${TOKEN}` },
      );
      assert.equal(res.status, 201);
      assert.equal(startCalls.length, 1);
      assert.equal(startCalls[0]!.consent, null);

      const rows = h.store.listSessions(TENANT);
      assert.equal(rows.length, 1);
      assert.deepEqual(rows[0]!.consentPurposes, []);
    } finally {
      await new Promise<void>((r) => h.server.close(() => r()));
    }
  });

  it('Caller-tenantId/policy/disclosure im Body → 400, erreichen startSession nie', async () => {
    h = await startHarness();
    try {
      for (const body of [
        { bot_id: BOT, tenant_id: 'evil' },
        { bot_id: BOT, tenantId: 'evil' },
        { bot_id: BOT, policy_ref: 'evil.policy' },
        { bot_id: BOT, disclosure_text: 'Fake' },
        { bot_id: BOT, instructions: 'Hacker prompt' },
        { bot_id: BOT, provider: 'openai', model: 'gpt' },
        { bot_id: BOT, offered_tools: ['evil'] },
      ]) {
        const res = await postJson(h.baseUrl, '/voice-sessions', body, {
          Authorization: `Bearer ${TOKEN}`,
        });
        assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
        assert.equal(res.json.reason, 'invalid_request');
      }
      assert.equal(h.createSessionCalls.length, 0);
      assert.equal(h.store.listSessions(TENANT).length, 0);
    } finally {
      await new Promise<void>((r) => h.server.close(() => r()));
    }
  });

  it('config_not_found → 404, Provider createSession nie aufgerufen', async () => {
    h = await startHarness({ seedConfig: false });
    try {
      const res = await postJson(
        h.baseUrl,
        '/voice-sessions',
        { bot_id: BOT },
        { Authorization: `Bearer ${TOKEN}` },
      );
      assert.equal(res.status, 404);
      assert.equal(res.json.reason, 'config_not_found');
      assert.equal(h.createSessionCalls.length, 0);
    } finally {
      await new Promise<void>((r) => h.server.close(() => r()));
    }
  });

  it('store_error → 503, kein Provider-Start', async () => {
    h = await startHarness({ insertSessionThrows: true });
    try {
      const res = await postJson(
        h.baseUrl,
        '/voice-sessions',
        { bot_id: BOT },
        { Authorization: `Bearer ${TOKEN}` },
      );
      assert.equal(res.status, 503);
      assert.equal(res.json.reason, 'store_error');
      assert.equal(h.createSessionCalls.length, 0);
      assert.ok(!JSON.stringify(res.json).includes('http_409'));
    } finally {
      await new Promise<void>((r) => h.server.close(() => r()));
    }
  });

  it('ohne Store → 503 not_configured (kein Legacy-HTTP-Start)', async () => {
    h = await startHarness({ storeNull: true });
    try {
      const res = await postJson(
        h.baseUrl,
        '/voice-sessions',
        { bot_id: BOT },
        { Authorization: `Bearer ${TOKEN}` },
      );
      assert.equal(res.status, 503);
      assert.equal(res.json.reason, 'not_configured');
      assert.equal(h.createSessionCalls.length, 0);
    } finally {
      await new Promise<void>((r) => h.server.close(() => r()));
    }
  });

  it('fehlendes AGENT_RUNTIME_API_TOKEN → 503 missing_token', async () => {
    h = await startHarness({ apiToken: null });
    try {
      const res = await postJson(
        h.baseUrl,
        '/voice-sessions',
        { bot_id: BOT },
        { Authorization: `Bearer ${TOKEN}` },
      );
      assert.equal(res.status, 503);
      assert.equal(res.json.reason, 'missing_token');
      assert.equal(h.createSessionCalls.length, 0);
    } finally {
      await new Promise<void>((r) => h.server.close(() => r()));
    }
  });
});

describe('mapVoiceStartError', () => {
  it('mappt stabile Codes ohne Secrets', () => {
    assert.deepEqual(mapVoiceStartError(new Error('voice-runtime: config_not_found')), {
      status: 404,
      reason: 'config_not_found',
    });
    assert.deepEqual(mapVoiceStartError(new Error('voice-runtime: store_error')), {
      status: 503,
      reason: 'store_error',
    });
    assert.deepEqual(mapVoiceStartError(new Error('provider blew up with key sk-secret')), {
      status: 502,
      reason: 'provider_error',
    });
  });
});

describe('POST /voice-tool — Rechte und Zustand nur aus der Session (SEC-01, SEC-05)', () => {
  const TENANT_B = '33333333-3333-3333-3333-333333333333';
  const BOT_B = '44444444-4444-4444-4444-444444444444';
  const auth = { Authorization: `Bearer ${TOKEN}` };
  const consent = {
    purposes: ['execute_tools', 'store_evidence'],
    withdrawn_at: null,
  };
  /** Testweise: behauptete Einwilligung gilt als nachgewiesen. */
  const trustClaimed: VoiceConsentVerifier = ({ claimed }) => claimed;

  type Trace = Array<{ check: string; result: string; detail: string }>;

  async function startSession(h: Harness, botId: string): Promise<{ sessionId: string; socket: MockSocket }> {
    const res = await postJson(h.baseUrl, '/voice-sessions', { bot_id: botId, consent }, auth);
    assert.equal(res.status, 201);
    return { sessionId: String(res.json.session_id), socket: h.sockets.at(-1)! };
  }

  async function callTool(h: Harness, socket: MockSocket, callId: string, tool: string) {
    const before = h.outcomes.length;
    socket.server({
      type: 'response.function_call_arguments.done',
      call_id: callId,
      name: tool,
      arguments: JSON.stringify({ query: 'x' }),
    });
    for (let i = 0; i < 100 && h.outcomes.length === before; i += 1) {
      await new Promise<void>((r) => setTimeout(r, 5));
    }
    await tick();
    return h.outcomes[before];
  }

  function trace(outcome: VoiceToolHttpOutcome | undefined): Trace {
    return (outcome?.decision?.trace ?? []) as Trace;
  }

  function forgedBody(sessionId: string, tenantId: string, tool: string) {
    return {
      tenantId,
      agentId: 'agent_voice_nora_v01',
      sessionId,
      requestId: `req_${tool}`,
      tool,
      args: {},
      session: { killSwitch: false, turnCount: 0, toolCount: 0, rateLimit: { maxTurns: 99, maxTools: 99 } },
      consent: { purposes: ['execute_tools', 'store_evidence'], withdrawnAt: null },
    };
  }

  it('angemeldeter Call eines angebotenen Tools → ALLOW mit Mandant und Bot aus der Session', async () => {
    const h = await startHarness({ loopback: true, verifyConsent: trustClaimed });
    try {
      const { sessionId, socket } = await startSession(h, BOT);
      const outcome = await callTool(h, socket, 'call_ok', 'lookup_kb');
      assert.equal(outcome?.ok, true);
      assert.equal(outcome?.decision?.verdict, 'ALLOW');
      assert.equal(outcome?.decision?.tenantId, TENANT);
      assert.equal(outcome?.decision?.sessionId, sessionId);
      assert.match(trace(outcome).find((s) => s.check === 'permission')?.detail ?? '', new RegExp(BOT));
    } finally {
      await new Promise<void>((r) => h.server.close(() => r()));
    }
  });

  it('nicht angebotenes Tool erreicht /voice-tool nie', async () => {
    const h = await startHarness({ loopback: true, verifyConsent: trustClaimed });
    try {
      const { socket } = await startSession(h, BOT);
      socket.server({
        type: 'response.function_call_arguments.done',
        call_id: 'call_ticket',
        name: 'create_ticket',
        arguments: '{}',
      });
      await new Promise<void>((r) => setTimeout(r, 30));
      assert.equal(h.outcomes.length, 0);
    } finally {
      await new Promise<void>((r) => h.server.close(() => r()));
    }
  });

  it('gefälschte Anfrage mit Body-Zustand → 403 voice_session_unknown, auch für eine echte Session', async () => {
    const h = await startHarness({ loopback: true, verifyConsent: trustClaimed });
    try {
      const { sessionId } = await startSession(h, BOT);
      for (const body of [
        forgedBody(sessionId, TENANT, 'lookup_kb'),
        forgedBody(sessionId, TENANT_B, 'lookup_kb'),
        forgedBody('55555555-5555-5555-5555-555555555555', TENANT, 'lookup_kb'),
      ]) {
        const res = await postJson(h.baseUrl, '/voice-tool', body, auth);
        assert.equal(res.status, 403);
        assert.equal(res.json.reason, 'voice_session_unknown');
        assert.equal(res.json.decision, undefined);
      }
    } finally {
      await new Promise<void>((r) => h.server.close(() => r()));
    }
  });

  it('Bot B bekommt nur seine eigenen Tools, Mandant B aus seiner Session', async () => {
    const h = await startHarness({ loopback: true, verifyConsent: trustClaimed });
    h.store.seedBotConfig({
      tenantId: TENANT_B,
      botId: BOT_B,
      provider: 'grok',
      model: 'grok-voice-think-fast-2.0',
      disclosureText: DISCLOSURE,
      policyRef: POLICY,
      offeredTools: ['lookup_kb'],
      status: 'active',
    });
    try {
      await startSession(h, BOT);
      const { socket: socketB } = await startSession(h, BOT_B);
      const ownB = await callTool(h, socketB, 'call_b', 'lookup_kb');
      assert.equal(ownB?.decision?.verdict, 'ALLOW');
      assert.equal(ownB?.decision?.tenantId, TENANT_B);

      const before = h.outcomes.length;
      socketB.server({
        type: 'response.function_call_arguments.done',
        call_id: 'call_b_sched',
        name: 'schedule_appointment',
        arguments: '{}',
      });
      await new Promise<void>((r) => setTimeout(r, 30));
      assert.equal(h.outcomes.length, before, 'schedule_appointment ist für Bot B nicht angeboten');
    } finally {
      await new Promise<void>((r) => h.server.close(() => r()));
    }
  });

  it('Kill-Switch in voice_sessions greift für die laufende Session', async () => {
    const h = await startHarness({ loopback: true, verifyConsent: trustClaimed });
    try {
      const { sessionId, socket } = await startSession(h, BOT);
      const first = await callTool(h, socket, 'call_1', 'lookup_kb');
      assert.equal(first?.decision?.verdict, 'ALLOW');

      await h.store.updateSessionStatus(TENANT, sessionId, { killSwitch: true });
      const second = await callTool(h, socket, 'call_2', 'lookup_kb');
      assert.equal(second?.ok, false);
      assert.equal(second?.decision?.verdict, 'DENY');
      assert.equal(trace(second).find((s) => s.check === 'kill_switch')?.result, 'fail');
    } finally {
      await new Promise<void>((r) => h.server.close(() => r()));
    }
  });

  it('ohne Einwilligungsnachweis wird abgelehnt, obwohl der Start eine Einwilligung behauptet', async () => {
    const h = await startHarness({ loopback: true });
    try {
      const { socket } = await startSession(h, BOT);
      const outcome = await callTool(h, socket, 'call_c', 'lookup_kb');
      assert.equal(outcome?.ok, false);
      assert.equal(outcome?.decision?.verdict, 'DENY');
      assert.equal(trace(outcome).find((s) => s.check === 'consent')?.result, 'fail');
    } finally {
      await new Promise<void>((r) => h.server.close(() => r()));
    }
  });
});

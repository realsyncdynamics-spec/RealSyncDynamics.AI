import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GrokProvider,
  type RealtimeSocketEvent,
  type RealtimeSocketEventType,
  type RealtimeSocketInit,
  type RealtimeSocketLike,
} from '../src/providers/grok-provider.js';
import {
  VoiceSessionRuntime,
  canonicalToolArgs,
  createMemoryVoiceStore,
  createVoiceToolClient,
  createVoiceToolGateway,
  sanitizeToolArgs,
  type VoiceConsentVerifier,
  type VoiceSessionStartRequest,
  type VoiceToolClient,
  type VoiceToolHttpOutcome,
  type VoiceToolHttpRequest,
} from '../src/voice/session-runtime.js';
import type { ToolGatewayInput } from '../src/voice/tool-gateway.js';
import type { VoiceProviderEvent, VoiceToolDefinition, VoiceToolResult } from '../src/voice-provider-types.js';
import type { VoicePolicyDecision } from '../src/voice-types.js';

const PLACEHOLDER_KEY = 'test-placeholder-not-a-real-key';
const PLACEHOLDER_TOKEN = 'test-runtime-token';

function policyDecision(
  overrides: Partial<VoicePolicyDecision> & Pick<VoicePolicyDecision, 'verdict' | 'sessionId' | 'tenantId'>,
): VoicePolicyDecision {
  return {
    decisionId: 'dec_rt_1',
    requestId: 'vt_call',
    reason: 'test',
    risk: 'medium',
    piiDetected: false,
    auditRequired: true,
    trace: [{ check: 'audit', result: 'pass', detail: 'voice.channel.v1' }],
    decidedAt: '2026-10-06T12:00:00.000Z',
    decidedBy: 'policy-engine',
    ...overrides,
  };
}

/** Entscheidung gebunden an genau diesen Request (wie das echte /voice-tool). */
function allowOutcome(
  req: Pick<VoiceToolHttpRequest, 'tenantId' | 'sessionId' | 'requestId'>,
  verdict: VoicePolicyDecision['verdict'] = 'ALLOW',
): VoiceToolHttpOutcome {
  return {
    ok: true,
    verdict,
    status: verdict === 'REQUIRE_CONFIRMATION' ? 'confirmation_required' : 'accepted',
    decision: policyDecision({
      verdict,
      tenantId: req.tenantId,
      sessionId: req.sessionId,
      requestId: req.requestId,
    }),
  };
}

// ─── Mock-WebSocket (wie grok-provider.test) ────────────────────────────────

class MockSocket implements RealtimeSocketLike {
  readyState = 0;
  readonly sent: Array<Record<string, unknown>> = [];
  closeCalls: Array<{ code?: number; reason?: string }> = [];
  private readonly listeners = new Map<RealtimeSocketEventType, Set<(e: RealtimeSocketEvent) => void>>();

  constructor(
    readonly url: string,
    readonly init: RealtimeSocketInit,
  ) {}

  send(data: string): void {
    if (this.readyState !== 1) throw new Error('mock: not open');
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    if (this.readyState === 3) return;
    this.readyState = 3;
    queueMicrotask(() => this.dispatch('close', { code: code ?? 1000, reason: reason ?? '' }));
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

  sentOfType(type: string): Array<Record<string, unknown>> {
    return this.sent.filter((m) => m.type === type);
  }

  private dispatch(type: RealtimeSocketEventType, e: RealtimeSocketEvent): void {
    for (const l of [...(this.listeners.get(type) ?? [])]) l(e);
  }
}

const TOOL_DEFS: VoiceToolDefinition[] = [
  {
    name: 'lookup_kb',
    description: 'Wissensbasis',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'schedule_appointment',
    description: 'Termin',
    parameters: { type: 'object', properties: { when: { type: 'string' } } },
  },
];

const DISCLOSURE = 'Hinweis: Sie sprechen mit einem KI-Assistenten.';

function startRequest(overrides: Partial<VoiceSessionStartRequest> = {}): VoiceSessionStartRequest {
  return {
    tenantId: 'tenant_mueller_sanitaer',
    botId: 'bot_nora_1',
    sessionId: 'sess_rt_1',
    correlationId: 'corr_rt_1',
    model: 'grok-voice-think-fast-2.0',
    voice: 'eve',
    language: 'de-DE',
    instructions: 'Du bist Nora.',
    disclosureText: DISCLOSURE,
    tools: TOOL_DEFS,
    inputAudio: { encoding: 'pcm16', sampleRateHz: 24000 },
    outputAudio: { encoding: 'g711_ulaw', sampleRateHz: 8000 },
    session: {
      killSwitch: false,
      turnCount: 1,
      toolCount: 0,
      rateLimit: { maxTurns: 20, maxTools: 8 },
    },
    consent: { purposes: ['execute_tools', 'store_evidence'], withdrawnAt: null },
    ...overrides,
  };
}

interface Harness {
  runtime: VoiceSessionRuntime;
  sockets: MockSocket[];
  voiceToolCalls: VoiceToolHttpRequest[];
  voiceToolImpl: (req: VoiceToolHttpRequest) => Promise<VoiceToolHttpOutcome>;
  events: VoiceProviderEvent[];
  factoryHeaders: Array<Record<string, string>>;
  /** Alle Ergebnisse, die die Runtime an den Provider zurückgibt (auch nach Close). */
  results: VoiceToolResult[];
  /** Provider-Event direkt an die Runtime — umgeht den Duplikat-Schutz des Providers. */
  emit: (event: VoiceProviderEvent) => void;
}

function harness(
  overrides: {
    voiceToolImpl?: (req: VoiceToolHttpRequest) => Promise<VoiceToolHttpOutcome>;
    getApiKey?: () => string | null;
    /** Default: Memory-Store explizit (kein Produktiv-Default). */
    injectMemoryStore?: boolean;
    /** Optional: komplett eigenes Gateway (z. B. werfendes Stub). */
    toolGateway?: ReturnType<typeof createVoiceToolGateway>;
    verifyConsent?: VoiceConsentVerifier;
  } = {},
): Harness {
  const h: Harness = {
    runtime: undefined as unknown as VoiceSessionRuntime,
    sockets: [],
    voiceToolCalls: [],
    voiceToolImpl:
      overrides.voiceToolImpl ??
      (async (req) => allowOutcome(req, 'ALLOW')),
    events: [],
    factoryHeaders: [],
    results: [],
    emit: () => {
      throw new Error('harness: keine Session gestartet');
    },
  };

  const client: VoiceToolClient = {
    evaluate: async (req) => {
      h.voiceToolCalls.push(req);
      return h.voiceToolImpl(req);
    },
  };

  const baseProvider = new GrokProvider({
    socketFactory: (url, init) => {
      h.factoryHeaders.push({ ...init.headers });
      const s = new MockSocket(url, init);
      h.sockets.push(s);
      return s;
    },
    getApiKey: overrides.getApiKey ?? (() => PLACEHOLDER_KEY),
    connectTimeoutMs: 200,
    closeTimeoutMs: 50,
  });
  const provider = new Proxy(baseProvider, {
    get(target, prop, receiver) {
      if (prop === 'createSession') {
        return async (...args: Parameters<GrokProvider['createSession']>) => {
          h.emit = args[1];
          return target.createSession(...args);
        };
      }
      if (prop === 'submitToolResult') {
        return async (sessionId: string, result: VoiceToolResult) => {
          h.results.push(result);
          return target.submitToolResult(sessionId, result);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  const injectMemory = overrides.injectMemoryStore !== false;
  const toolGateway =
    overrides.toolGateway ??
    (injectMemory
      ? createVoiceToolGateway({ store: createMemoryVoiceStore() })
      : createVoiceToolGateway({ env: {} }));
  h.runtime = new VoiceSessionRuntime({
    provider,
    voiceToolClient: client,
    toolGateway,
    // Legacy-Tests: kein Persistenz-Store (unabhängig von Env-Credentials).
    store: null,
    onEvent: (e) => h.events.push(e),
    verifyConsent: overrides.verifyConsent,
  });
  return h;
}

const tick = () => new Promise<void>((r) => setImmediate(r));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function openRuntime(h: Harness, req: VoiceSessionStartRequest = startRequest()) {
  const pending = h.runtime.startSession(req);
  await tick();
  const socket = h.sockets.at(-1)!;
  socket.open();
  socket.server({ type: 'session.created', session: { id: 'xai_1' } });
  socket.server({ type: 'session.updated', session: {} });
  const session = await pending;
  return { session, socket };
}

function functionCall(callId: string, name: string, args: unknown) {
  return {
    type: 'response.function_call_arguments.done',
    call_id: callId,
    name,
    arguments: typeof args === 'string' ? args : JSON.stringify(args),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('VoiceSessionRuntime — Disclosure', () => {
  it('spricht disclosureText verbatim zuerst per force_message', async () => {
    const h = harness();
    const { socket } = await openRuntime(h);
    const items = socket.sentOfType('conversation.item.create');
    assert.equal(items.length, 1);
    assert.deepEqual(items[0]!.item, {
      type: 'force_message',
      role: 'assistant',
      interruptible: false,
      content: [{ type: 'output_text', text: DISCLOSURE }],
    });
    assert.deepEqual(socket.sent.map((m) => m.type), ['session.update', 'conversation.item.create']);
  });

  it('lehnt Session ohne disclosureText fail-closed ab', async () => {
    const h = harness();
    await assert.rejects(
      h.runtime.startSession(startRequest({ disclosureText: '   ' })),
      /disclosureText fehlt/,
    );
    assert.equal(h.sockets.length, 0);
  });

  it('optionales greetingText ist nicht Disclosure und hat keinen Code-Default', async () => {
    const h = harness();
    const { socket } = await openRuntime(
      h,
      startRequest({
        greetingText: 'Eure KI läuft — aber wer kontrolliert sie?',
      }),
    );
    const force = socket.sentOfType('conversation.item.create')[0]!.item as {
      content: Array<{ text: string }>;
    };
    assert.equal(force.content[0]!.text, DISCLOSURE);
    assert.ok(!force.content[0]!.text.includes('Eure KI läuft'));
    const update = socket.sentOfType('session.update')[0]!.session as { instructions: string };
    assert.ok(update.instructions.includes('Eure KI läuft'));
  });
});

describe('VoiceSessionRuntime — Tenant und /voice-tool', () => {
  it('verwirft eingeschleustes tenantId/botId in Tool-Args und nutzt Session-Kontext', async () => {
    const h = harness();
    const { socket } = await openRuntime(h);
    socket.server(
      functionCall('call_1', 'lookup_kb', {
        query: 'Öffnungszeiten',
        tenantId: 'tenant_evil',
        botId: 'bot_evil',
        tenant_id: 'tenant_evil',
        bot_id: 'bot_evil',
      }),
    );
    await wait(20);
    assert.equal(h.voiceToolCalls.length, 1);
    const req = h.voiceToolCalls[0]!;
    assert.equal(req.tenantId, 'tenant_mueller_sanitaer');
    assert.deepEqual(req.args, { query: 'Öffnungszeiten' });
    assert.ok(!JSON.stringify(req).includes('evil'));
    assert.deepEqual(h.runtime.getSessionContext('sess_rt_1'), {
      tenantId: 'tenant_mueller_sanitaer',
      botId: 'bot_nora_1',
      sessionId: 'sess_rt_1',
    });
    const out = socket.sentOfType('conversation.item.create').filter(
      (m) => (m.item as { type?: string }).type === 'function_call_output',
    );
    assert.equal(out.length, 1);
    const payload = JSON.parse((out[0]!.item as { output: string }).output) as {
      outcome: string;
      verified: boolean;
      output: { verdict: string; execution?: string };
    };
    assert.equal(payload.outcome, 'failed');
    assert.equal(payload.verified, false);
    assert.equal(payload.output.verdict, 'ALLOW');
    assert.equal(payload.output.reason, 'not_configured');
  });

  it('unbekanntes Tool → denied ohne /voice-tool-Aufruf', async () => {
    const h = harness();
    const { socket } = await openRuntime(h);
    socket.server(functionCall('call_x', 'transfer_money', { amount: 1000 }));
    await wait(20);
    assert.equal(h.voiceToolCalls.length, 0);
    const out = socket.sentOfType('conversation.item.create').filter(
      (m) => (m.item as { type?: string }).type === 'function_call_output',
    );
    assert.equal(out.length, 1);
    const payload = JSON.parse((out[0]!.item as { output: string }).output) as {
      outcome: string;
      verified: boolean;
      output: { reason: string };
    };
    assert.equal(payload.outcome, 'denied');
    assert.equal(payload.verified, false);
    assert.equal(payload.output.reason, 'unknown_tool');
  });

  it('/voice-tool-Fehler und Timeout → denied an das Modell', async () => {
    const h = harness({
      voiceToolImpl: async () => ({ ok: false, reason: 'timeout' }),
    });
    const { socket } = await openRuntime(h, startRequest({ sessionId: 'sess_rt_to' }));
    socket.server(functionCall('call_to', 'lookup_kb', { query: 'x' }));
    await wait(20);
    assert.equal(h.voiceToolCalls.length, 1);
    const out = socket.sentOfType('conversation.item.create').filter(
      (m) => (m.item as { type?: string }).type === 'function_call_output',
    );
    const payload = JSON.parse((out.at(-1)!.item as { output: string }).output) as {
      outcome: string;
      output: { reason: string };
    };
    assert.equal(payload.outcome, 'denied');
    assert.equal(payload.output.reason, 'timeout');

    const h2 = harness({
      voiceToolImpl: async () => ({ ok: false, reason: 'transport_error' }),
    });
    const { socket: s2 } = await openRuntime(h2, startRequest({ sessionId: 'sess_rt_err' }));
    s2.server(functionCall('call_err', 'lookup_kb', { query: 'y' }));
    await wait(20);
    const out2 = s2.sentOfType('conversation.item.create').filter(
      (m) => (m.item as { type?: string }).type === 'function_call_output',
    );
    const payload2 = JSON.parse((out2.at(-1)!.item as { output: string }).output) as {
      outcome: string;
      output: { reason: string };
    };
    assert.equal(payload2.outcome, 'denied');
    assert.equal(payload2.output.reason, 'transport_error');
  });

  it('REQUIRE_CONFIRMATION von /voice-tool → awaiting_confirmation', async () => {
    const h = harness({
      voiceToolImpl: async (req) =>
        allowOutcome(req, 'REQUIRE_CONFIRMATION'),
    });
    const { socket } = await openRuntime(h);
    socket.server(
      functionCall('call_c', 'schedule_appointment', {
        when: 'Fr 9:00',
        customer_name: 'Max',
      }),
    );
    await wait(20);
    const out = socket.sentOfType('conversation.item.create').filter(
      (m) => (m.item as { type?: string }).type === 'function_call_output',
    );
    const payload = JSON.parse((out.at(-1)!.item as { output: string }).output) as {
      outcome: string;
      verified: boolean;
      output: { verdict: string };
    };
    assert.equal(payload.outcome, 'awaiting_confirmation');
    assert.equal(payload.verified, false);
    assert.equal(payload.output.verdict, 'REQUIRE_CONFIRMATION');
  });

  it('ohne Decision-Payload → denied missing_policy_decision (kein Fake)', async () => {
    const h = harness({
      voiceToolImpl: async () => ({ ok: true, verdict: 'ALLOW', status: 'accepted' }),
    });
    const { socket } = await openRuntime(h, startRequest({ sessionId: 'sess_rt_nodec' }));
    socket.server(functionCall('call_nd', 'lookup_kb', { query: 'x' }));
    await wait(20);
    const out = socket.sentOfType('conversation.item.create').filter(
      (m) => (m.item as { type?: string }).type === 'function_call_output',
    );
    const payload = JSON.parse((out.at(-1)!.item as { output: string }).output) as {
      outcome: string;
      verified: boolean;
      output: { reason: string };
    };
    assert.equal(payload.outcome, 'denied');
    assert.equal(payload.verified, false);
    assert.equal(payload.output.reason, 'missing_policy_decision');
  });

  it('ohne Store → failed/not_configured (kein Memory-Default)', async () => {
    const h = harness({ injectMemoryStore: false });
    const { socket } = await openRuntime(h, startRequest({ sessionId: 'sess_rt_nostore' }));
    socket.server(
      functionCall('call_ns', 'schedule_appointment', {
        customer_name: 'Max',
        when: 'Fr 9:00',
      }),
    );
    await wait(20);
    const out = socket.sentOfType('conversation.item.create').filter(
      (m) => (m.item as { type?: string }).type === 'function_call_output',
    );
    const payload = JSON.parse((out.at(-1)!.item as { output: string }).output) as {
      outcome: string;
      verified: boolean;
      output: { reason: string };
    };
    assert.equal(payload.outcome, 'failed');
    assert.equal(payload.verified, false);
    assert.equal(payload.output.reason, 'not_configured');
  });

  it('Gateway wirft → genau ein submitToolResult mit outcome denied (kein Hänger)', async () => {
    const h = harness({
      toolGateway: {
        handle: async () => {
          throw new Error('simulated gateway crash — must not hang tool call');
        },
      },
    });
    const { socket } = await openRuntime(h, startRequest({ sessionId: 'sess_rt_throw' }));
    socket.server(functionCall('call_throw', 'lookup_kb', { query: 'x' }));
    await wait(30);
    const out = socket.sentOfType('conversation.item.create').filter(
      (m) => (m.item as { type?: string }).type === 'function_call_output',
    );
    assert.equal(out.length, 1, 'genau ein Tool-Ergebnis an den Provider');
    const payload = JSON.parse((out[0]!.item as { output: string }).output) as {
      outcome: string;
      verified: boolean;
      output: { reason: string };
    };
    assert.equal(payload.outcome, 'denied');
    assert.equal(payload.verified, false);
    assert.equal(payload.output.reason, 'internal_error');
    assert.ok(!JSON.stringify(payload).includes('simulated gateway crash'));
  });

  it('reserviert toolCount vor dem Await und erhöht turnCount bei finalem Nutzer-Turn', async () => {
    const seen: number[] = [];
    const turns: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const h = harness({
      voiceToolImpl: async (req) => {
        // Wie das Gateway: Zähler kommen serverseitig aus der Session (SEC-05).
        const ctx = await h.runtime.resolveToolPolicyContext(req.sessionId, req.requestId, req.tool, req.args);
        seen.push(ctx!.session.toolCount);
        turns.push(ctx!.session.turnCount);
        await gate;
        return allowOutcome(req, 'ALLOW');
      },
    });
    const { socket } = await openRuntime(
      h,
      startRequest({
        session: {
          killSwitch: false,
          turnCount: 0,
          toolCount: 0,
          rateLimit: { maxTurns: 20, maxTools: 8 },
        },
      }),
    );
    socket.server({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'u1',
      transcript: 'Bitte Öffnungszeiten',
    });
    socket.server(functionCall('call_a', 'lookup_kb', { query: 'a' }));
    socket.server(functionCall('call_b', 'lookup_kb', { query: 'b' }));
    await wait(30);
    assert.deepEqual(seen, [0, 1], 'parallele Calls bekommen unterschiedliche toolCounts');
    assert.deepEqual(turns, [1, 1]);
    release();
    await wait(30);
  });
});

describe('VoiceSessionRuntime — Policy-Kontext nur serverseitig (SEC-05)', () => {
  it('/voice-tool-Body trägt weder Session-Zustand noch Einwilligung', async () => {
    const h = harness();
    const { socket } = await openRuntime(h);
    socket.server(functionCall('call_body', 'lookup_kb', { query: 'x' }));
    await wait(20);
    assert.equal(h.voiceToolCalls.length, 1);
    const req = h.voiceToolCalls[0]! as unknown as Record<string, unknown>;
    assert.equal('session' in req, false);
    assert.equal('consent' in req, false);
  });

  it('Kontext nur für den gerade angemeldeten Call; danach, fremd oder mit anderem Tool → undefined', async () => {
    type Ctx = Awaited<ReturnType<VoiceSessionRuntime['resolveToolPolicyContext']>>;
    let inFlight: Ctx;
    let otherTool: Ctx;
    let otherRequest: Ctx;
    const h = harness({
      voiceToolImpl: async (req) => {
        inFlight = await h.runtime.resolveToolPolicyContext(req.sessionId, req.requestId, req.tool, req.args);
        otherTool = await h.runtime.resolveToolPolicyContext(req.sessionId, req.requestId, 'create_ticket', req.args);
        otherRequest = await h.runtime.resolveToolPolicyContext(req.sessionId, 'vt_forged', req.tool, req.args);
        return { ok: false, reason: 'test_stop' };
      },
    });
    const { socket } = await openRuntime(h);
    socket.server(functionCall('call_p', 'lookup_kb', { query: 'x' }));
    await wait(20);
    assert.equal(inFlight?.session.tenantId, 'tenant_mueller_sanitaer');
    assert.equal(otherTool, undefined);
    assert.equal(otherRequest, undefined);
    assert.equal(await h.runtime.resolveToolPolicyContext('sess_rt_1', 'vt_call_p', 'lookup_kb', { query: 'x' }), undefined);
    assert.equal(await h.runtime.resolveToolPolicyContext('sess_unknown', 'vt_call_p', 'lookup_kb', { query: 'x' }), undefined);
  });

  it('behauptete Einwilligung zählt ohne Nachweis nicht; mit Verifier schon', async () => {
    const read = async (verifyConsent?: VoiceConsentVerifier) => {
      let consent: unknown = 'unset';
      const h = harness({
        verifyConsent,
        voiceToolImpl: async (req) => {
          const ctx = await h.runtime.resolveToolPolicyContext(req.sessionId, req.requestId, req.tool, req.args);
          consent = ctx?.consent;
          return { ok: false, reason: 'test_stop' };
        },
      });
      const { socket } = await openRuntime(h);
      socket.server(functionCall('call_c', 'lookup_kb', { query: 'x' }));
      await wait(20);
      return consent;
    };

    assert.equal(await read(), null, 'Default: nicht verifiziert');
    assert.equal(
      await read(() => {
        throw new Error('consent_store_down');
      }),
      null,
      'Verifier-Fehler → nicht verifiziert',
    );
    assert.deepEqual(await read(({ claimed }) => claimed), {
      purposes: ['execute_tools', 'store_evidence'],
      withdrawnAt: null,
    });
  });

  it('Kill-Switch aus dem Start bleibt wirksam, Legacy ohne Store', async () => {
    let killSwitch: boolean | undefined;
    const h = harness({
      voiceToolImpl: async (req) => {
        const ctx = await h.runtime.resolveToolPolicyContext(req.sessionId, req.requestId, req.tool, req.args);
        killSwitch = ctx?.session.killSwitch;
        return { ok: false, reason: 'test_stop' };
      },
    });
    const { socket } = await openRuntime(
      h,
      startRequest({
        session: { killSwitch: true, turnCount: 0, toolCount: 0, rateLimit: { maxTurns: 20, maxTools: 8 } },
      }),
    );
    socket.server(functionCall('call_k', 'lookup_kb', { query: 'x' }));
    await wait(20);
    assert.equal(killSwitch, true);
  });
});

describe('VoiceSessionRuntime — Abbruch, Replay, Bindung (SEC-05 Härtung)', () => {
  const recordingGateway = (handled: ToolGatewayInput[]) => ({
    handle: async (input: ToolGatewayInput): Promise<VoiceToolResult> => {
      handled.push(input);
      return { callId: input.callId, outcome: 'denied', verified: false, output: { reason: 'recorded' } };
    },
  });
  const toolCall = (callId: string, name = 'lookup_kb', args: unknown = { query: 'x' }): VoiceProviderEvent => ({
    type: 'tool.call',
    sessionId: 'sess_rt_1',
    call: { callId, name, arguments: args },
  });

  it('Abbruch während /voice-tool → session_closed, kein Kontext, Gateway wird nie aufgerufen', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let afterClose: unknown = 'unset';
    const handled: ToolGatewayInput[] = [];
    const h = harness({
      toolGateway: recordingGateway(handled),
      voiceToolImpl: async (req) => {
        await gate;
        afterClose = await h.runtime.resolveToolPolicyContext(req.sessionId, req.requestId, req.tool, req.args);
        return allowOutcome(req);
      },
    });
    const { socket } = await openRuntime(h);
    socket.server(functionCall('call_abort', 'lookup_kb', { query: 'x' }));
    await wait(10);
    assert.equal(h.voiceToolCalls.length, 1);

    const closing = h.runtime.closeSession('sess_rt_1');
    release();
    await closing;
    await wait(20);
    assert.equal(afterClose, undefined, 'nach Beginn des Abbruchs keine Entscheidung mehr');
    assert.equal(handled.length, 0);
    assert.equal(h.results.at(-1)?.output.reason, 'session_closed');
  });

  it('nach Beginn des Abbruchs wird kein neuer Call mehr angemeldet', async () => {
    const h = harness();
    await openRuntime(h);
    const closing = h.runtime.closeSession('sess_rt_1');
    h.emit(toolCall('call_late'));
    await closing;
    await wait(20);
    assert.equal(h.voiceToolCalls.length, 0);
    assert.equal(h.results.at(-1)?.output.reason, 'session_closed');
  });

  it('Abbruch zwischen Entscheidung und Executor → session_inactive, kein Termin; ohne Abbruch executed', async () => {
    const run = async (abortBeforeExecutor: boolean) => {
      const store = createMemoryVoiceStore();
      let appointments = 0;
      const insertAppointment = store.insertAppointment.bind(store);
      store.insertAppointment = async (row) => {
        appointments += 1;
        return insertAppointment(row);
      };
      const h = harness({ toolGateway: createVoiceToolGateway({ store, allowWriteTools: true }) });
      if (abortBeforeExecutor) {
        // Konkurrierender Abbruch, während das Gateway die Ausführung vorbereitet
        // (nach der Policy-Entscheidung, vor dem Executor).
        const insertExecution = store.insertExecution.bind(store);
        store.insertExecution = async (row) => {
          void h.runtime.closeSession('sess_rt_1');
          return insertExecution(row);
        };
      }
      await openRuntime(h);
      h.emit(toolCall('call_appt', 'schedule_appointment', { customer_name: 'Max', when: '2026-10-10T09:00:00.000Z' }));
      await wait(80);
      return { result: h.results.at(-1), appointments };
    };

    const aborted = await run(true);
    assert.equal(aborted.result?.outcome, 'denied');
    assert.equal(aborted.result?.output.reason, 'session_inactive');
    assert.equal(aborted.appointments, 0);

    const normal = await run(false);
    assert.equal(normal.result?.outcome, 'executed');
    assert.equal(normal.result?.verified, true);
    assert.equal(normal.appointments, 1);
  });

  it('Policy-Kontext höchstens einmal je Anmeldung: parallel und wiederholt', async () => {
    const got: unknown[] = [];
    const h = harness({
      voiceToolImpl: async (req) => {
        const resolve = () => h.runtime.resolveToolPolicyContext(req.sessionId, req.requestId, req.tool, req.args);
        got.push(...(await Promise.all([resolve(), resolve()])));
        got.push(await resolve());
        return { ok: false, reason: 'test_stop' };
      },
    });
    const { socket } = await openRuntime(h);
    socket.server(functionCall('call_once', 'lookup_kb', { query: 'x' }));
    await wait(20);
    assert.equal(got.length, 3);
    assert.equal(got.filter((c) => c !== undefined).length, 1, 'genau eine Entscheidung');
    assert.equal(got[2], undefined, 'Replay nach dem ersten Abruf');
  });

  it('Entscheidung zu einer anderen requestId → request_mismatch, keine Ausführung; passende → Gateway', async () => {
    const handled: ToolGatewayInput[] = [];
    const h = harness({
      toolGateway: recordingGateway(handled),
      voiceToolImpl: async (req) =>
        allowOutcome(req.requestId === 'vt_call_foreign' ? { ...req, requestId: 'vt_call_other' } : req),
    });
    await openRuntime(h);
    h.emit(toolCall('call_foreign'));
    await wait(20);
    assert.equal(handled.length, 0);
    assert.equal(h.results.at(-1)?.output.reason, 'request_mismatch');

    h.emit(toolCall('call_own'));
    await wait(20);
    assert.equal(handled.length, 1);
    assert.equal(handled[0]!.decision.requestId, 'vt_call_own');
    assert.ok(handled[0]!.executionGuard, 'Gateway bekommt den Guard der Session');
  });

  it('wiederverwendete callId: parallel und nach Abschluss → duplicate_call_id, neue callId geht durch', async () => {
    const h = harness();
    await openRuntime(h);
    h.emit(toolCall('call_dup'));
    h.emit(toolCall('call_dup'));
    await wait(20);
    assert.equal(h.voiceToolCalls.length, 1);
    assert.ok(h.results.some((r) => r.output.reason === 'duplicate_call_id'));

    h.emit(toolCall('call_dup'));
    await wait(20);
    assert.equal(h.voiceToolCalls.length, 1, 'auch nach Abschluss kein zweiter Aufruf');
    assert.equal(h.results.at(-1)?.output.reason, 'duplicate_call_id');

    h.emit(toolCall('call_new'));
    await wait(20);
    assert.equal(h.voiceToolCalls.length, 2);
    assert.equal(h.voiceToolCalls[1]!.requestId, 'vt_call_new');
  });

  it('abweichende Args → kein Kontext und Anmeldung nicht verbraucht; gleiche Args in anderer Key-Reihenfolge → Kontext', async () => {
    const args = { query: 'Öffnungszeiten', filter: { lang: 'de', scope: { site: 'hq', tags: ['a', 'b'] } } };
    const forged: Array<Record<string, unknown>> = [
      { ...args, priority: 'high' },
      { query: 'Öffnungszeiten' },
      { ...args, query: 'Max Mustermann, IBAN DE89370400440532013000' },
      { ...args, filter: { lang: 'de', scope: { site: 'hq', tags: ['b', 'a'] } } },
      { ...args, filter: { lang: 'de', scope: { site: 'branch', tags: ['a', 'b'] } } },
      { ...args, filter: { lang: 'de', scope: { site: 'hq', tags: ['a', 'b'], extra: true } } },
      { ...args, filter: { lang: 'de', scope: { site: 'hq', tags: ['a', 2] } } },
      { ...args, filter: { lang: 'de', scope: { site: 'hq', tags: ['a', 'b'] } }, tenantId: 'tenant_x' },
    ];
    const reordered = { filter: { scope: { tags: ['a', 'b'], site: 'hq' }, lang: 'de' }, query: 'Öffnungszeiten' };
    const got: { forged: unknown[]; legit?: unknown; replay?: unknown } = { forged: [] };
    const h = harness({
      voiceToolImpl: async (req) => {
        for (const other of forged) {
          got.forged.push(await h.runtime.resolveToolPolicyContext(req.sessionId, req.requestId, req.tool, other));
        }
        got.legit = await h.runtime.resolveToolPolicyContext(req.sessionId, req.requestId, req.tool, reordered);
        got.replay = await h.runtime.resolveToolPolicyContext(req.sessionId, req.requestId, req.tool, req.args);
        return { ok: false, reason: 'test_stop' };
      },
    });
    await openRuntime(h);
    h.emit(toolCall('call_args', 'lookup_kb', args));
    await wait(20);
    assert.equal(got.forged.length, forged.length);
    assert.ok(got.forged.every((c) => c === undefined), 'keine Entscheidung zu abweichenden Args');
    assert.ok(got.legit, 'Anmeldung nach den Fehlversuchen noch offen');
    assert.equal(got.replay, undefined, 'danach verbraucht');
  });

  it('parallel: abweichende Args verbrauchen die Anmeldung nicht, passende bekommt genau einen Kontext', async () => {
    let results: unknown[] = [];
    const h = harness({
      voiceToolImpl: async (req) => {
        const resolve = (args: Record<string, unknown>) =>
          h.runtime.resolveToolPolicyContext(req.sessionId, req.requestId, req.tool, args);
        results = await Promise.all([
          resolve({ ...req.args, priority: 'high' }),
          resolve(req.args),
          resolve({ query: 'anders' }),
          resolve(req.args),
        ]);
        return { ok: false, reason: 'test_stop' };
      },
    });
    await openRuntime(h);
    h.emit(toolCall('call_par', 'lookup_kb', { query: 'x' }));
    await wait(20);
    assert.equal(results[0], undefined);
    assert.ok(results[1], 'erster passender Abruf');
    assert.equal(results[2], undefined);
    assert.equal(results[3], undefined, 'zweiter passender Abruf: verbraucht');
  });

  it('nicht serialisierbare Args → invalid_arguments, keine Anmeldung', async () => {
    const h = harness();
    await openRuntime(h);
    const cyclic: Record<string, unknown> = { query: 'x' };
    cyclic.self = cyclic;
    h.emit(toolCall('call_cyclic', 'lookup_kb', cyclic));
    h.emit(toolCall('call_bigint', 'lookup_kb', { query: 'x', n: 1n }));
    await wait(20);
    assert.equal(h.voiceToolCalls.length, 0);
    assert.deepEqual(
      h.results.map((r) => r.output.reason),
      ['invalid_arguments', 'invalid_arguments'],
    );
  });
});

describe('canonicalToolArgs — kanonische Normalisierung (SEC-05)', () => {
  it('Key-Reihenfolge egal auf jeder Ebene, auch in Objekten in Arrays', () => {
    const a = { b: 1, a: { d: [{ y: 2, x: 1 }, 'z'], c: null } };
    const b = { a: { c: null, d: [{ x: 1, y: 2 }, 'z'] }, b: 1 };
    assert.equal(canonicalToolArgs(a), canonicalToolArgs(b));
    assert.equal(canonicalToolArgs(a), '{"a":{"c":null,"d":[{"x":1,"y":2},"z"]},"b":1}');
  });

  it('Werte, Typen, Array-Reihenfolge und zusätzliche Keys zählen, auch verschachtelt', () => {
    const base = canonicalToolArgs({ q: 'x', f: { n: 1, l: ['a', 'b'], o: { k: true } } });
    for (const other of [
      { q: 'x', f: { n: '1', l: ['a', 'b'], o: { k: true } } },
      { q: 'x', f: { n: 1, l: ['b', 'a'], o: { k: true } } },
      { q: 'x', f: { n: 1, l: ['a', 'b'], o: { k: 'true' } } },
      { q: 'x', f: { n: 1, l: ['a', 'b'], o: { k: true, m: null } } },
      { q: 'x', f: { n: 1, l: ['a', 'b'], o: {} } },
      { q: 'x', f: { n: 1, l: ['a', 'b', null], o: { k: true } } },
      { q: 'x', f: { n: 1, l: { 0: 'a', 1: 'b' }, o: { k: true } } },
      { q: 'x ', f: { n: 1, l: ['a', 'b'], o: { k: true } } },
    ]) {
      assert.notEqual(canonicalToolArgs(other), base, JSON.stringify(other));
    }
  });

  it('identisch nach dem JSON-Transport zu /voice-tool', () => {
    const args = {
      when: new Date('2026-10-10T09:00:00.000Z'),
      skip: undefined,
      list: [undefined, Number.NaN, -0, 1e21],
      nested: { z: 'ü\u2028"', a: { '10': 1, '9': 2, b: 3 } },
    };
    const wire = JSON.parse(JSON.stringify(args)) as Record<string, unknown>;
    assert.equal(canonicalToolArgs(wire), canonicalToolArgs(args));
    assert.equal(canonicalToolArgs({ a: 1, skip: undefined }), canonicalToolArgs({ a: 1 }));
  });

  it('nicht serialisierbar → null', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    assert.equal(canonicalToolArgs(cyclic), null);
    assert.equal(canonicalToolArgs({ n: 1n }), null);
    assert.equal(canonicalToolArgs(undefined), null);
  });
});

describe('VoiceSessionRuntime — ws Authorization und Secrets', () => {
  it('ws-Factory (socketFactory) setzt Authorization-Header aus dem API-Key-Getter', async () => {
    const h = harness();
    await openRuntime(h);
    assert.equal(h.factoryHeaders.length, 1);
    assert.equal(h.factoryHeaders[0]!.Authorization, `Bearer ${PLACEHOLDER_KEY}`);
  });

  it('XAI_API_KEY und Token erscheinen in keinem Event und keinem /voice-tool-Body', async () => {
    const h = harness();
    const { socket } = await openRuntime(h);
    socket.server(functionCall('call_s', 'lookup_kb', { query: 'x' }));
    await wait(20);
    const blob = JSON.stringify({ events: h.events, voiceTool: h.voiceToolCalls, sent: socket.sent });
    assert.ok(!blob.includes(PLACEHOLDER_KEY));
    assert.ok(!blob.includes(PLACEHOLDER_TOKEN));
  });
});

describe('createVoiceToolClient — HTTP fail-closed', () => {
  it('Timeout und fehlender Token → ok:false', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = createVoiceToolClient({
      baseUrl: 'http://voice-tool.test',
      getApiToken: () => PLACEHOLDER_TOKEN,
      timeoutMs: 30,
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => resolve(), 5_000);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(t);
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
        return new Response('{}', { status: 200 });
      },
    });
    const outcome = await client.evaluate({
      tenantId: 't1',
      sessionId: 's1',
      requestId: 'r1',
      tool: 'lookup_kb',
      args: { query: 'x' },
    });
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.equal(outcome.reason, 'timeout');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, 'http://voice-tool.test/voice-tool');
    const sentBody = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>;
    assert.equal('session' in sentBody, false);
    assert.equal('consent' in sentBody, false);
    assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, `Bearer ${PLACEHOLDER_TOKEN}`);

    const noToken = createVoiceToolClient({
      baseUrl: 'http://voice-tool.test',
      getApiToken: () => '',
      fetchImpl: async () => new Response('{}', { status: 200 }),
    });
    const denied = await noToken.evaluate({
      tenantId: 't1',
      sessionId: 's1',
      requestId: 'r1',
      tool: 'lookup_kb',
      args: {},
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.reason, 'missing_token');
  });
});

describe('sanitizeToolArgs', () => {
  it('entfernt tenantId/botId und lehnt Prototype-Keys ab', () => {
    assert.deepEqual(sanitizeToolArgs({ query: 'x', tenantId: 'evil', bot_id: 'evil' }), { query: 'x' });
    const polluted = JSON.parse('{"query":"x","__proto__":{"polluted":true}}') as Record<string, unknown>;
    assert.equal(sanitizeToolArgs(polluted), null);
    assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  });
});

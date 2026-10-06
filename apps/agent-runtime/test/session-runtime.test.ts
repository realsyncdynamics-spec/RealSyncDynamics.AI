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
  createVoiceToolClient,
  sanitizeToolArgs,
  type VoiceSessionStartRequest,
  type VoiceToolClient,
  type VoiceToolHttpOutcome,
  type VoiceToolHttpRequest,
} from '../src/voice/session-runtime.js';
import type { VoiceProviderEvent, VoiceToolDefinition } from '../src/voice-provider-types.js';

const PLACEHOLDER_KEY = 'test-placeholder-not-a-real-key';
const PLACEHOLDER_TOKEN = 'test-runtime-token';

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
}

function harness(
  overrides: {
    voiceToolImpl?: (req: VoiceToolHttpRequest) => Promise<VoiceToolHttpOutcome>;
    getApiKey?: () => string | null;
  } = {},
): Harness {
  const h: Harness = {
    runtime: undefined as unknown as VoiceSessionRuntime,
    sockets: [],
    voiceToolCalls: [],
    voiceToolImpl:
      overrides.voiceToolImpl ??
      (async () => ({ ok: true, verdict: 'ALLOW', status: 'accepted' })),
    events: [],
    factoryHeaders: [],
  };

  const client: VoiceToolClient = {
    evaluate: async (req) => {
      h.voiceToolCalls.push(req);
      return h.voiceToolImpl(req);
    },
  };

  const provider = new GrokProvider({
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

  h.runtime = new VoiceSessionRuntime({
    provider,
    voiceToolClient: client,
    onEvent: (e) => h.events.push(e),
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
    assert.equal(payload.output.execution, 'deferred_to_pr4');
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
      voiceToolImpl: async () => ({
        ok: true,
        verdict: 'REQUIRE_CONFIRMATION',
        status: 'confirmation_required',
      }),
    });
    const { socket } = await openRuntime(h);
    socket.server(functionCall('call_c', 'schedule_appointment', { when: 'Fr 9:00' }));
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

  it('reserviert toolCount vor dem Await und erhöht turnCount bei finalem Nutzer-Turn', async () => {
    const seen: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const h = harness({
      voiceToolImpl: async (req) => {
        seen.push(req.session.toolCount);
        await gate;
        return { ok: true, verdict: 'ALLOW', status: 'accepted' };
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
    assert.equal(h.voiceToolCalls[0]!.session.turnCount, 1);
    assert.equal(h.voiceToolCalls[1]!.session.turnCount, 1);
    release();
    await wait(30);
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
      session: { killSwitch: false, turnCount: 0, toolCount: 0, rateLimit: { maxTurns: 10, maxTools: 5 } },
      consent: null,
    });
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.equal(outcome.reason, 'timeout');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, 'http://voice-tool.test/voice-tool');
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
      session: { killSwitch: false, turnCount: 0, toolCount: 0, rateLimit: { maxTurns: 10, maxTools: 5 } },
      consent: null,
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

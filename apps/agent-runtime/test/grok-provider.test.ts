import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as contract from '../../../packages/agent-runtime-contracts/src/index.js';
import {
  GROK_REALTIME_URL,
  GrokProvider,
  UnsupportedAudioFormatError,
  toXaiAudioFormat,
  toXaiLanguageHint,
  type RealtimeSocketEvent,
  type RealtimeSocketEventType,
  type RealtimeSocketInit,
  type RealtimeSocketLike,
} from '../src/providers/grok-provider.js';
import { evaluateVoiceToolRequest } from '../src/voice-policy.js';
import {
  CONTRACT_TOOL_NAMES,
  VOICE_PROVIDER_IDS,
  normalizeProviderToolCall,
  type AudioFormat,
  type ProviderToolCall,
  type VoiceProviderEvent,
  type VoiceSessionConfig,
  type VoiceToolResult,
} from '../src/voice-provider-types.js';
import { VOICE_AGENT_ID, type VoiceToolName } from '../src/voice-types.js';

// Offensichtlicher Platzhalter — kein echter Key, es gibt keinen Netzwerkzugriff.
const PLACEHOLDER_KEY = 'test-placeholder-not-a-real-key';

// ─── Mock-WebSocket ─────────────────────────────────────────────────────────

class MockSocket implements RealtimeSocketLike {
  readyState = 0;
  readonly sent: Array<Record<string, unknown>> = [];
  closeCalls: Array<{ code?: number; reason?: string }> = [];
  /** Wenn false, feuert close() kein Close-Event (Timeout-Pfad). */
  emitCloseOnClose = true;
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
    this.readyState = 2;
    if (this.emitCloseOnClose) {
      queueMicrotask(() => {
        this.readyState = 3;
        this.dispatch('close', { code: code ?? 1000, reason: reason ?? '' });
      });
    }
  }

  addEventListener(type: RealtimeSocketEventType, l: (e: RealtimeSocketEvent) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(l);
  }

  removeEventListener(type: RealtimeSocketEventType, l: (e: RealtimeSocketEvent) => void): void {
    this.listeners.get(type)?.delete(l);
  }

  listenerCount(): number {
    let n = 0;
    for (const set of this.listeners.values()) n += set.size;
    return n;
  }

  // Server-Seite
  open(): void {
    this.readyState = 1;
    this.dispatch('open', {});
  }
  server(msg: Record<string, unknown>): void {
    this.dispatch('message', { data: JSON.stringify(msg) });
  }
  serverRaw(data: unknown): void {
    this.dispatch('message', { data });
  }
  serverClose(code = 1000): void {
    this.readyState = 3;
    this.dispatch('close', { code, reason: '' });
  }
  transportError(): void {
    this.dispatch('error', {});
  }
  sentOfType(type: string): Array<Record<string, unknown>> {
    return this.sent.filter((m) => m.type === type);
  }

  private dispatch(type: RealtimeSocketEventType, e: RealtimeSocketEvent): void {
    for (const l of [...(this.listeners.get(type) ?? [])]) l(e);
  }
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const TOOL_DEFS: VoiceSessionConfig['tools'] = [
  {
    name: 'lookup_kb',
    description: 'Wissensbasis durchsuchen',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'schedule_appointment',
    description: 'Termin vorschlagen',
    parameters: { type: 'object', properties: { when: { type: 'string' } } },
  },
];

function config(overrides: Partial<VoiceSessionConfig> = {}): VoiceSessionConfig {
  return {
    tenantId: 'tenant_mueller_sanitaer',
    botId: 'bot_nora_1',
    sessionId: 'sess_grok_1',
    correlationId: 'corr_1',
    provider: 'grok',
    model: 'grok-voice-think-fast-2.0',
    voice: 'eve',
    language: 'de-DE',
    instructions: 'Du bist Nora, die Telefonassistenz.',
    disclosureText: 'Hinweis: Sie sprechen mit einem KI-Assistenten.',
    tools: TOOL_DEFS,
    inputAudio: { encoding: 'pcm16', sampleRateHz: 24000 },
    outputAudio: { encoding: 'g711_ulaw', sampleRateHz: 8000 },
    ...overrides,
  };
}

interface Harness {
  provider: GrokProvider;
  sockets: MockSocket[];
  events: VoiceProviderEvent[];
  factoryCalls: number;
}

function harness(opts: Partial<ConstructorParameters<typeof GrokProvider>[0]> = {}): Harness {
  const h: Harness = { provider: undefined as unknown as GrokProvider, sockets: [], events: [], factoryCalls: 0 };
  h.provider = new GrokProvider({
    socketFactory: (url, init) => {
      h.factoryCalls += 1;
      const s = new MockSocket(url, init);
      h.sockets.push(s);
      return s;
    },
    getApiKey: () => PLACEHOLDER_KEY,
    connectTimeoutMs: 200,
    closeTimeoutMs: 50,
    ...opts,
  });
  return h;
}

const tick = () => new Promise<void>((r) => setImmediate(r));

/** Baut eine offene Session auf: open → session.created → session.updated. */
async function openSession(h: Harness, cfg: VoiceSessionConfig = config()) {
  const pending = h.provider.createSession(cfg, (e) => h.events.push(e));
  await tick();
  const socket = h.sockets.at(-1)!;
  socket.open();
  socket.server({ type: 'session.created', session: { id: 'xai_sess_42', object: 'realtime.session' } });
  socket.server({ type: 'conversation.created', conversation: { id: 'conv_1' } });
  socket.server({ type: 'session.updated', session: {} });
  const session = await pending;
  return { session, socket };
}

function functionCall(callId: string | undefined, name: string, args: unknown, extra: Record<string, unknown> = {}) {
  return {
    type: 'response.function_call_arguments.done',
    response_id: 'resp_1',
    item_id: 'item_1',
    ...(callId === undefined ? {} : { call_id: callId }),
    name,
    arguments: typeof args === 'string' ? args : JSON.stringify(args),
    ...extra,
  };
}

const ofType = <T extends VoiceProviderEvent['type']>(events: VoiceProviderEvent[], type: T) =>
  events.filter((e): e is Extract<VoiceProviderEvent, { type: T }> => e.type === type);

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GrokProvider — Session-Aufbau', () => {
  it('verbindet mit wss://api.x.ai/v1/realtime, Bearer-Header aus dem Getter, session.opened', async () => {
    const h = harness();
    const { session, socket } = await openSession(h);
    assert.equal(h.provider.id, 'grok');
    assert.equal(socket.url, `${GROK_REALTIME_URL}?model=grok-voice-think-fast-2.0`);
    assert.equal(socket.init.headers.Authorization, `Bearer ${PLACEHOLDER_KEY}`);
    assert.deepEqual(session, {
      sessionId: 'sess_grok_1',
      provider: 'grok',
      model: 'grok-voice-think-fast-2.0',
      providerSessionRef: 'xai_sess_42',
      status: 'open',
    });
    assert.deepEqual(ofType(h.events, 'session.opened'), [
      { type: 'session.opened', sessionId: 'sess_grok_1', providerSessionRef: 'xai_sess_42' },
    ]);
  });

  it('session.update enthält de-DE-Hinweis, Formate, Stimme, server_vad und die Tools', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    const [update] = socket.sentOfType('session.update');
    assert.ok(update);
    assert.deepEqual(update.session, {
      instructions: 'Du bist Nora, die Telefonassistenz.',
      voice: 'eve',
      turn_detection: { type: 'server_vad' },
      audio: {
        input: { format: { type: 'audio/pcm', rate: 24000 }, transcription: { language_hint: 'de' } },
        output: { format: { type: 'audio/pcmu' } },
      },
      tools: [
        { type: 'function', name: 'lookup_kb', description: 'Wissensbasis durchsuchen', parameters: TOOL_DEFS[0]!.parameters },
        { type: 'function', name: 'schedule_appointment', description: 'Termin vorschlagen', parameters: TOOL_DEFS[1]!.parameters },
      ],
    });
    // Weder Key noch Tenant/Bot gehen an xAI.
    const wire = JSON.stringify(socket.sent);
    assert.ok(!wire.includes(PLACEHOLDER_KEY));
    assert.ok(!wire.includes('tenant_mueller_sanitaer'));
    assert.ok(!wire.includes('bot_nora_1'));
  });

  it('Default-Sprache de-DE greift bei leerer Sprache', async () => {
    const h = harness();
    const { socket } = await openSession(h, config({ language: '' }));
    const update = socket.sentOfType('session.update')[0]!;
    const audio = (update.session as { audio: { input: { transcription?: { language_hint: string } } } }).audio;
    assert.equal(audio.input.transcription?.language_hint, 'de');
  });

  it('spricht den Disclosure-Text per force_message vor session.opened, ohne response.create', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    const items = socket.sentOfType('conversation.item.create');
    assert.equal(items.length, 1);
    assert.deepEqual(items[0]!.item, {
      type: 'force_message',
      role: 'assistant',
      interruptible: false,
      content: [{ type: 'output_text', text: 'Hinweis: Sie sprechen mit einem KI-Assistenten.' }],
    });
    assert.equal(socket.sentOfType('response.create').length, 0);
    assert.deepEqual(socket.sent.map((m) => m.type), ['session.update', 'conversation.item.create']);
  });

  it('manueller Turn-Modus: turn_detection null und commitAudio sendet input_audio_buffer.commit', async () => {
    const h = harness({ turnDetection: 'manual' });
    const { socket } = await openSession(h);
    const update = socket.sentOfType('session.update')[0]!;
    assert.deepEqual((update.session as { turn_detection: unknown }).turn_detection, { type: null });
    await h.provider.commitAudio('sess_grok_1');
    assert.equal(socket.sentOfType('input_audio_buffer.commit').length, 1);
  });

  it('commitAudio ist im server_vad-Modus gesperrt', async () => {
    const h = harness();
    await openSession(h);
    await assert.rejects(h.provider.commitAudio('sess_grok_1'), /manual/);
  });

  it('lehnt fehlenden API-Key ab, ohne zu verbinden', async () => {
    const h = harness({ getApiKey: () => undefined });
    await assert.rejects(h.provider.createSession(config(), () => {}), /API-Key nicht konfiguriert/);
    assert.equal(h.factoryCalls, 0);
  });

  it('Default-Getter liest XAI_API_KEY aus der Umgebung', async () => {
    const before = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = PLACEHOLDER_KEY;
    try {
      const sockets: MockSocket[] = [];
      const p = new GrokProvider({
        socketFactory: (url, init) => {
          const s = new MockSocket(url, init);
          sockets.push(s);
          return s;
        },
        connectTimeoutMs: 50,
      });
      const pending = p.createSession(config(), () => {});
      await tick();
      assert.equal(sockets[0]!.init.headers.Authorization, `Bearer ${PLACEHOLDER_KEY}`);
      await p.closeSession('sess_grok_1');
      await assert.rejects(pending, /geschlossen/);
    } finally {
      if (before === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = before;
    }
  });

  it('lehnt nicht freigegebene Tool-Definitionen vor dem Verbinden ab', async () => {
    const h = harness();
    const tools = [
      ...TOOL_DEFS,
      { name: 'delete_database' as VoiceToolName, description: 'x', parameters: { type: 'object' } },
    ];
    await assert.rejects(h.provider.createSession(config({ tools }), () => {}), /nicht freigegeben/);
    assert.equal(h.factoryCalls, 0);
  });

  it('lehnt einen anderen Provider und fehlenden Tenant ab', async () => {
    const h = harness();
    await assert.rejects(h.provider.createSession(config({ provider: 'openai' }), () => {}), /provider/);
    await assert.rejects(h.provider.createSession(config({ tenantId: '' }), () => {}), /tenantId/);
    assert.equal(h.factoryCalls, 0);
  });

  it('Timeout beim Aufbau: reject, Socket zu, keine Listener', async () => {
    const h = harness({ connectTimeoutMs: 20 });
    const pending = h.provider.createSession(config(), (e) => h.events.push(e));
    await tick();
    const socket = h.sockets[0]!;
    socket.open(); // aber kein session.updated
    await assert.rejects(pending, /Timeout/);
    assert.ok(socket.closeCalls.length >= 1);
    assert.equal(socket.listenerCount(), 0);
    assert.equal(h.provider.getSession('sess_grok_1'), undefined);
  });

  it('Verbindungsabbruch beim Aufbau: reject statt hängen', async () => {
    const h = harness();
    const pending = h.provider.createSession(config(), () => {});
    await tick();
    h.sockets[0]!.serverClose(1006);
    await assert.rejects(pending, /geschlossen/);
    assert.equal(h.sockets[0]!.listenerCount(), 0);
  });

  it('xAI-error vor session.updated lehnt createSession fail-closed ab (kein Timeout, kein error vor opened)', async () => {
    const h = harness({ connectTimeoutMs: 5_000 });
    const pending = h.provider.createSession(config(), (e) => h.events.push(e));
    await tick();
    const socket = h.sockets[0]!;
    socket.open();
    socket.server({ type: 'session.created', session: { id: 'xai_sess_bad' } });
    // Ungültige Stimme/Modell/Format → error vor session.updated
    socket.server({
      type: 'error',
      error: { type: 'invalid_request_error', code: 'invalid_voice', message: 'voice "bogus" not supported' },
    });
    await assert.rejects(pending, /xAI-Fehler beim Session-Aufbau \(xai\.invalid_voice\)/);
    assert.equal(ofType(h.events, 'error').length, 0, 'kein error-Event vor session.opened');
    assert.equal(ofType(h.events, 'session.opened').length, 0);
    assert.ok(socket.closeCalls.length >= 1);
    assert.equal(socket.listenerCount(), 0);
    assert.equal(h.provider.getSession('sess_grok_1'), undefined);
  });

  it('Konstruktor ohne socketFactory schlägt fehl', () => {
    assert.throws(() => new GrokProvider({} as never), /socketFactory/);
  });
});

describe('GrokProvider — Audio', () => {
  it('sendAudio schickt Base64 per input_audio_buffer.append', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    const audio = new Uint8Array([1, 2, 3, 255]).buffer;
    await h.provider.sendAudio('sess_grok_1', audio);
    assert.deepEqual(socket.sentOfType('input_audio_buffer.append'), [
      { type: 'input_audio_buffer.append', audio: 'AQID/w==' },
    ]);
  });

  it('response.output_audio.delta (und Alias response.audio.delta) → audio.output', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.server({ type: 'response.output_audio.delta', response_id: 'r', item_id: 'i', delta: 'AQID' });
    socket.server({ type: 'response.audio.delta', delta: Buffer.from([9, 8]).toString('base64') });
    const audio = ofType(h.events, 'audio.output');
    assert.equal(audio.length, 2);
    assert.deepEqual([...new Uint8Array(audio[0]!.audio)], [1, 2, 3]);
    assert.deepEqual([...new Uint8Array(audio[1]!.audio)], [9, 8]);
    assert.ok(audio[0]!.audio instanceof ArrayBuffer);
  });

  it('sendAudio auf unbekannter Session schlägt fehl', async () => {
    const h = harness();
    await assert.rejects(h.provider.sendAudio('nope', new ArrayBuffer(2)), /nicht offen/);
  });

  it('nicht unterstützte Formate sind fail-closed (opus, G.711 ≠ 8 kHz)', async () => {
    const h = harness();
    await assert.rejects(
      h.provider.createSession(config({ inputAudio: { encoding: 'opus', sampleRateHz: 24000 } }), () => {}),
      (err: unknown) => err instanceof UnsupportedAudioFormatError && /input opus@24000/.test(err.message),
    );
    await assert.rejects(
      h.provider.createSession(config({ outputAudio: { encoding: 'g711_alaw', sampleRateHz: 16000 } }), () => {}),
      /output g711_alaw@16000 Hz nicht unterstützt/,
    );
    assert.equal(h.factoryCalls, 0);
  });

  it('Mapping Vertrag ↔ xAI ist explizit', () => {
    const cases: Array<[AudioFormat, unknown]> = [
      [{ encoding: 'pcm16', sampleRateHz: 8000 }, { type: 'audio/pcm', rate: 8000 }],
      [{ encoding: 'pcm16', sampleRateHz: 16000 }, { type: 'audio/pcm', rate: 16000 }],
      [{ encoding: 'pcm16', sampleRateHz: 24000 }, { type: 'audio/pcm', rate: 24000 }],
      [{ encoding: 'pcm16', sampleRateHz: 48000 }, { type: 'audio/pcm', rate: 48000 }],
      [{ encoding: 'g711_ulaw', sampleRateHz: 8000 }, { type: 'audio/pcmu' }],
      [{ encoding: 'g711_alaw', sampleRateHz: 8000 }, { type: 'audio/pcma' }],
    ];
    for (const [input, expected] of cases) assert.deepEqual(toXaiAudioFormat('input', input), expected);
    assert.throws(() => toXaiAudioFormat('input', { encoding: 'pcm16', sampleRateHz: 44100 as never }));
    assert.throws(() => toXaiAudioFormat('input', { encoding: 'mp3' as never, sampleRateHz: 24000 }));
  });

  it('Sprach-Mapping auf xAI language_hint', () => {
    assert.equal(toXaiLanguageHint('de-DE'), 'de');
    assert.equal(toXaiLanguageHint(undefined), 'de');
    assert.equal(toXaiLanguageHint('fr-FR'), 'fr');
    assert.equal(toXaiLanguageHint('es-MX'), 'es-MX');
    assert.equal(toXaiLanguageHint('es'), undefined);
    assert.equal(toXaiLanguageHint('xx-YY'), undefined);
  });
});

describe('GrokProvider — Transkripte', () => {
  it('Nutzer: updated → partial, completed → final', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.server({ type: 'conversation.item.input_audio_transcription.updated', item_id: 'm1', transcript: 'Hallo, ich' });
    socket.server({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'm1', transcript: 'Hallo, ich brauche einen Termin.' });
    assert.deepEqual(ofType(h.events, 'transcript.user'), [
      { type: 'transcript.user', sessionId: 'sess_grok_1', text: 'Hallo, ich', final: false },
      { type: 'transcript.user', sessionId: 'sess_grok_1', text: 'Hallo, ich brauche einen Termin.', final: true },
    ]);
  });

  it('Assistant: Deltas kumuliert, done → final (auch ohne transcript-Feld)', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.server({ type: 'response.output_audio_transcript.delta', item_id: 'a1', delta: 'Gern, ' });
    socket.server({ type: 'response.output_audio_transcript.delta', item_id: 'a1', delta: 'wann passt es?' });
    socket.server({ type: 'response.output_audio_transcript.done', item_id: 'a1' });
    assert.deepEqual(ofType(h.events, 'transcript.assistant'), [
      { type: 'transcript.assistant', sessionId: 'sess_grok_1', text: 'Gern, ', final: false },
      { type: 'transcript.assistant', sessionId: 'sess_grok_1', text: 'Gern, wann passt es?', final: false },
      { type: 'transcript.assistant', sessionId: 'sess_grok_1', text: 'Gern, wann passt es?', final: true },
    ]);
  });
});

describe('GrokProvider — Tool-Calls', () => {
  it('Tool-Call wird nur als Event gemeldet — nichts wird ausgeführt oder an xAI zurückgeschickt', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    const sentBefore = socket.sent.length;
    socket.server(functionCall('call_1', 'lookup_kb', { query: 'Öffnungszeiten' }));
    socket.server({ type: 'response.done', response: { id: 'resp_1', status: 'completed' } });
    assert.deepEqual(ofType(h.events, 'tool.call'), [
      { type: 'tool.call', sessionId: 'sess_grok_1', call: { callId: 'call_1', name: 'lookup_kb', arguments: { query: 'Öffnungszeiten' } } },
    ]);
    assert.equal(socket.sent.length, sentBefore, 'kein function_call_output, kein response.create ohne submitToolResult');
  });

  it('submitToolResult → function_call_output + response.create', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.server(functionCall('call_1', 'lookup_kb', { query: 'x' }));
    const result: VoiceToolResult = { callId: 'call_1', outcome: 'executed', verified: true, output: { answer: 'Mo–Fr 8–17 Uhr' } };
    await h.provider.submitToolResult('sess_grok_1', result);
    const tail = socket.sent.slice(-2);
    assert.deepEqual(tail[0], {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: 'call_1',
        output: JSON.stringify({ outcome: 'executed', verified: true, output: { answer: 'Mo–Fr 8–17 Uhr' } }),
      },
    });
    assert.deepEqual(tail[1], { type: 'response.create' });
    await assert.rejects(h.provider.submitToolResult('sess_grok_1', result), /bereits beantwortet/);
  });

  it('parallele Calls: genau ein response.create, erst nach allen Ergebnissen und nach response.done', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.server({ type: 'response.created', response: { id: 'resp_1' } });
    socket.server(functionCall('call_a', 'lookup_kb', { query: 'a' }));
    socket.server(functionCall('call_b', 'schedule_appointment', { when: 'Fr 9:00' }));
    await h.provider.submitToolResult('sess_grok_1', { callId: 'call_a', outcome: 'executed', verified: true, output: {} });
    assert.equal(socket.sentOfType('response.create').length, 0);
    await h.provider.submitToolResult('sess_grok_1', { callId: 'call_b', outcome: 'awaiting_confirmation', verified: false, output: {} });
    assert.equal(socket.sentOfType('response.create').length, 0, 'Antwort läuft noch');
    socket.server({ type: 'response.done', response: { id: 'resp_1', status: 'completed' } });
    assert.equal(socket.sentOfType('response.create').length, 1);
    assert.equal(socket.sentOfType('conversation.item.create').filter((m) => (m.item as { type: string }).type === 'function_call_output').length, 2);
  });

  it('tenantId/botId aus der Provider-Payload werden ignoriert', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.server(
      functionCall(
        'call_t',
        'lookup_kb',
        { query: 'x', tenantId: 'tenant_evil', botId: 'bot_evil', tenant_id: 'tenant_evil', bot_id: 'bot_evil' },
        { tenantId: 'tenant_evil', botId: 'bot_evil', session_id: 'sess_evil' },
      ),
    );
    const [call] = ofType(h.events, 'tool.call');
    assert.ok(call);
    assert.equal(call.sessionId, 'sess_grok_1');
    assert.deepEqual(call.call.arguments, { query: 'x' });
    assert.ok(!JSON.stringify(h.events).includes('evil'));
    assert.deepEqual(h.provider.getSessionContext('sess_grok_1'), {
      tenantId: 'tenant_mueller_sanitaer',
      botId: 'bot_nora_1',
      sessionId: 'sess_grok_1',
      correlationId: 'corr_1',
    });
  });

  it('__proto__/constructor/prototype in Tool-Args werden fail-closed als invalid_arguments abgelehnt (CWE-1321)', async () => {
    const h = harness();
    const { socket } = await openSession(h);

    const protoKeysBefore = Reflect.ownKeys(Object.prototype);
    const tenantDescBefore = Object.getOwnPropertyDescriptor(Object.prototype, 'tenantId');
    const pollutedDescBefore = Object.getOwnPropertyDescriptor(Object.prototype, 'polluted');

    // JSON.parse-String: "__proto__" wird Own-Key (nicht Object.create-Pfad).
    const pollutedArgs = JSON.parse(
      '{"query":"x","__proto__":{"polluted":true,"tenantId":"tenant_evil","botId":"bot_evil"},"constructor":{"name":"Evil"},"prototype":{"polluted":true}}',
    ) as Record<string, unknown>;
    assert.ok(Object.hasOwn(pollutedArgs, '__proto__'), 'Voraussetzung: __proto__ ist Own-Key nach JSON.parse');
    assert.ok(Object.hasOwn(pollutedArgs, 'constructor'));
    assert.ok(Object.hasOwn(pollutedArgs, 'prototype'));

    socket.serverRaw(
      JSON.stringify({
        type: 'response.function_call_arguments.done',
        call_id: 'call_proto',
        name: 'lookup_kb',
        arguments: JSON.stringify(pollutedArgs),
      }),
    );

    // Fail-closed: kein tool.call, keine Argument-Struktur mit Prototype-Keys.
    assert.equal(ofType(h.events, 'tool.call').length, 0);
    assert.equal(ofType(h.events, 'error')[0]?.code, 'tool_call_rejected.invalid_arguments');

    // Object.prototype unverändert — kein neues Property durch Pollution.
    assert.deepEqual(Reflect.ownKeys(Object.prototype), protoKeysBefore);
    assert.deepEqual(Object.getOwnPropertyDescriptor(Object.prototype, 'tenantId'), tenantDescBefore);
    assert.deepEqual(Object.getOwnPropertyDescriptor(Object.prototype, 'polluted'), pollutedDescBefore);
    assert.equal(({} as { polluted?: boolean }).polluted, undefined);
    assert.equal(({} as { tenantId?: string }).tenantId, undefined);
    assert.equal(({} as { botId?: string }).botId, undefined);

    // Kein verarbeitetes Ergebnis mit diesen Keys als Own-Properties.
    const calls = ofType(h.events, 'tool.call');
    for (const event of calls) {
      assert.equal(Object.hasOwn(event.call.arguments, '__proto__'), false);
      assert.equal(Object.hasOwn(event.call.arguments, 'constructor'), false);
      assert.equal(Object.hasOwn(event.call.arguments, 'prototype'), false);
    }

    const denial = socket
      .sentOfType('conversation.item.create')
      .filter((m) => (m.item as { type?: string }).type === 'function_call_output')
      .at(-1)!;
    const out = JSON.parse((denial.item as { output: string }).output) as {
      outcome: string;
      verified: boolean;
      output: { reason: string };
    };
    assert.equal(out.outcome, 'denied');
    assert.equal(out.verified, false);
    assert.equal(out.output.reason, 'invalid_arguments');
    assert.deepEqual(h.provider.getSessionContext('sess_grok_1')?.tenantId, 'tenant_mueller_sanitaer');
  });

  it('unbekanntes Tool: kein tool.call, Fehler-Event, Ablehnung an das Modell', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.server(functionCall('call_x', 'transfer_money', { amount: 1000 }));
    assert.equal(ofType(h.events, 'tool.call').length, 0);
    assert.deepEqual(ofType(h.events, 'error'), [
      { type: 'error', sessionId: 'sess_grok_1', code: 'tool_call_rejected.unknown_tool', retryable: false },
    ]);
    const out = socket.sentOfType('conversation.item.create').at(-1)!;
    assert.deepEqual(out.item, {
      type: 'function_call_output',
      call_id: 'call_x',
      output: JSON.stringify({ outcome: 'denied', verified: false, output: { reason: 'unknown_tool' } }),
    });
    assert.deepEqual(socket.sent.at(-1), { type: 'response.create' });
    await assert.rejects(
      h.provider.submitToolResult('sess_grok_1', { callId: 'call_x', outcome: 'executed', verified: false, output: {} }),
      /callId unbekannt/,
    );
  });

  it('Contract-Tool, das nicht angeboten wurde, ist tool_not_offered', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.server(functionCall('call_e', 'export_transcript', { format: 'json' }));
    assert.equal(ofType(h.events, 'tool.call').length, 0);
    assert.equal(ofType(h.events, 'error')[0]?.code, 'tool_call_rejected.tool_not_offered');
  });

  it('Tool außerhalb der freigegebenen Liste (allowedTools) ist unknown_tool', async () => {
    const h = harness({ allowedTools: ['lookup_kb', 'schedule_appointment', 'evil_tool'] });
    const { socket } = await openSession(h);
    socket.server(functionCall('call_ev', 'evil_tool', {}));
    assert.equal(ofType(h.events, 'tool.call').length, 0);
    assert.equal(ofType(h.events, 'error')[0]?.code, 'tool_call_rejected.unknown_tool');
  });

  it('fehlende Call-ID, kaputte Argumente und Duplikate werden abgelehnt', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.server(functionCall(undefined, 'lookup_kb', { query: 'x' }));
    socket.server(functionCall('call_bad', 'lookup_kb', '{nicht json'));
    socket.server(functionCall('call_arr', 'lookup_kb', '[1,2]'));
    socket.server(functionCall('call_ok', 'lookup_kb', { query: 'x' }));
    socket.server(functionCall('call_ok', 'lookup_kb', { query: 'y' }));
    assert.deepEqual(
      ofType(h.events, 'error').map((e) => e.code),
      [
        'tool_call_rejected.missing_call_id',
        'tool_call_rejected.invalid_arguments',
        'tool_call_rejected.invalid_arguments',
        'tool_call_rejected.duplicate_call_id',
      ],
    );
    assert.equal(ofType(h.events, 'tool.call').length, 1);
  });

  it('submitToolResult prüft verified/outcome fail-closed', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.server(functionCall('call_v', 'lookup_kb', { query: 'x' }));
    await assert.rejects(
      h.provider.submitToolResult('sess_grok_1', { callId: 'call_v', outcome: 'denied', verified: true, output: {} }),
      /verified=true nur bei outcome "executed"/,
    );
    await assert.rejects(
      h.provider.submitToolResult('sess_grok_1', { callId: 'call_v', outcome: 'done' as never, verified: false, output: {} }),
      /outcome/,
    );
  });
});

describe('GrokProvider — Fehler und Lebenszyklus', () => {
  it('xAI-error → error-Event mit Code, ohne Meldungstext', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.server({ type: 'error', error: { type: 'invalid_request_error', code: 'invalid_request_error', message: 'Max Mustermann +49 170 1234567' } });
    socket.server({ type: 'error', error: { type: 'internal_error', code: 'internal_error', message: 'boom' } });
    assert.deepEqual(ofType(h.events, 'error'), [
      { type: 'error', sessionId: 'sess_grok_1', code: 'xai.invalid_request_error', retryable: false },
      { type: 'error', sessionId: 'sess_grok_1', code: 'xai.internal_error', retryable: true },
    ]);
    assert.ok(!JSON.stringify(h.events).includes('Mustermann'));
    assert.equal(h.provider.getSession('sess_grok_1')?.status, 'open', 'Fehler sind laut xAI meist recoverable');
  });

  it('kaputte Server-Nachricht → provider_protocol_error, Session bleibt offen', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.serverRaw('{oops');
    assert.equal(ofType(h.events, 'error')[0]?.code, 'provider_protocol_error');
    assert.equal(h.provider.getSession('sess_grok_1')?.status, 'open');
  });

  it('Socket-Close durch xAI → session.closed(provider), Listener weg, Session entfernt', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.serverClose(1000);
    assert.deepEqual(ofType(h.events, 'session.closed'), [
      { type: 'session.closed', sessionId: 'sess_grok_1', reason: 'provider' },
    ]);
    assert.equal(socket.listenerCount(), 0);
    assert.equal(h.provider.getSession('sess_grok_1'), undefined);
    await assert.rejects(h.provider.sendAudio('sess_grok_1', new ArrayBuffer(4)), /nicht offen/);
    socket.server({ type: 'response.output_audio.delta', delta: 'AQID' });
    assert.equal(ofType(h.events, 'audio.output').length, 0);
  });

  it('Transportfehler + Close → session.closed(error)', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.transportError();
    socket.serverClose(1006);
    assert.equal(ofType(h.events, 'error')[0]?.code, 'transport_error');
    assert.equal(ofType(h.events, 'session.closed')[0]?.reason, 'error');
  });

  it('closeSession ist idempotent (auch parallel) und meldet genau ein session.closed', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    await Promise.all([h.provider.closeSession('sess_grok_1'), h.provider.closeSession('sess_grok_1')]);
    await h.provider.closeSession('sess_grok_1');
    await h.provider.closeSession('unbekannt');
    assert.deepEqual(ofType(h.events, 'session.closed'), [
      { type: 'session.closed', sessionId: 'sess_grok_1', reason: 'runtime' },
    ]);
    assert.equal(socket.closeCalls.length, 1);
    assert.equal(socket.closeCalls[0]!.code, 1000);
    assert.equal(socket.listenerCount(), 0);
  });

  it('closeSession beendet auch ohne Close-Event (Timeout) und hinterlässt nichts', async () => {
    const h = harness({ closeTimeoutMs: 10 });
    const { socket } = await openSession(h);
    socket.emitCloseOnClose = false;
    await h.provider.closeSession('sess_grok_1', 'caller');
    assert.equal(ofType(h.events, 'session.closed')[0]?.reason, 'caller');
    assert.equal(socket.listenerCount(), 0);
    assert.equal(h.provider.getSession('sess_grok_1'), undefined);
  });

  it('API-Key taucht in keinem Event auf', async () => {
    const h = harness();
    const { socket } = await openSession(h);
    socket.server({ type: 'error', error: { code: 'invalid_request_error' } });
    await h.provider.closeSession('sess_grok_1');
    assert.ok(!JSON.stringify(h.events).includes(PLACEHOLDER_KEY));
  });
});

describe('Vertrags-Parität (lokaler Spiegel ↔ packages/agent-runtime-contracts)', () => {
  it('GrokProvider ist dem Contract-Interface zuweisbar (Typprüfung)', () => {
    const asContract: contract.VoiceProvider = harness().provider;
    assert.equal(asContract.id, 'grok');
  });

  it('Tool-Namen und Provider-IDs sind identisch', () => {
    assert.deepEqual([...CONTRACT_TOOL_NAMES], [...contract.CONTRACT_TOOL_NAMES]);
    assert.deepEqual([...VOICE_PROVIDER_IDS], [...contract.VOICE_PROVIDER_IDS]);
  });

  it('normalizeProviderToolCall verhält sich identisch', () => {
    const ctx = {
      requestId: 'r1',
      sessionId: 's1',
      tenantId: 't1',
      agentId: VOICE_AGENT_ID,
      offeredTools: ['lookup_kb'],
      now: '2026-10-06T10:00:00.000Z',
    };
    const calls: ProviderToolCall[] = [
      { callId: 'c1', name: 'lookup_kb', arguments: '{"query":"x"}' },
      { callId: '', name: 'lookup_kb', arguments: {} },
      { callId: 'c2', name: 'rm_rf', arguments: {} },
      { callId: 'c3', name: 'create_ticket', arguments: {} },
      { callId: 'c4', name: 'lookup_kb', arguments: '{kaputt' },
      { callId: 'c5', name: 'lookup_kb', arguments: [1] },
    ];
    for (const call of calls) {
      assert.deepEqual(normalizeProviderToolCall(call, ctx), contract.normalizeProviderToolCall(call, ctx));
    }
  });
});

describe('Anbindung an den /voice-tool-Prüfpfad (evaluateVoiceToolRequest)', () => {
  async function runThroughPolicy(tool: VoiceToolName, args: Record<string, unknown>) {
    const h = harness();
    const { socket } = await openSession(h);
    socket.server(functionCall('call_p', tool, { ...args, tenantId: 'tenant_evil' }));
    socket.server({ type: 'response.done', response: { id: 'resp_1', status: 'completed' } });
    const [event] = ofType(h.events, 'tool.call');
    assert.ok(event);
    const ctx = h.provider.getSessionContext(event.sessionId)!;
    const normalized = normalizeProviderToolCall(event.call, {
      requestId: 'req_p',
      sessionId: ctx.sessionId,
      tenantId: ctx.tenantId,
      agentId: VOICE_AGENT_ID,
      offeredTools: TOOL_DEFS.map((t) => t.name),
      now: '2026-10-06T10:00:00.000Z',
    });
    assert.ok(normalized.ok);
    assert.equal(normalized.request.tenantId, 'tenant_mueller_sanitaer');
    const decision = evaluateVoiceToolRequest({
      session: {
        sessionId: ctx.sessionId,
        tenantId: ctx.tenantId,
        killSwitch: false,
        turnCount: 1,
        toolCount: 0,
        rateLimit: { maxTurns: 20, maxTools: 8 },
      },
      request: normalized.request,
      consent: { purposes: ['execute_tools', 'store_evidence'], withdrawnAt: null },
    });
    // Ohne Ausführungsschicht (PR 4) gibt es nie "executed"/verified.
    const result: VoiceToolResult = {
      callId: event.call.callId,
      outcome: decision.verdict === 'DENY' ? 'denied' : decision.verdict === 'REQUIRE_CONFIRMATION' ? 'awaiting_confirmation' : 'failed',
      verified: false,
      output: { verdict: decision.verdict },
    };
    await h.provider.submitToolResult(event.sessionId, result);
    return { decision, socket };
  }

  it('schedule_appointment → REQUIRE_CONFIRMATION → awaiting_confirmation an xAI', async () => {
    const { decision, socket } = await runThroughPolicy('schedule_appointment', { when: 'Fr 9:00' });
    assert.equal(decision.verdict, 'REQUIRE_CONFIRMATION');
    assert.equal(decision.tenantId, 'tenant_mueller_sanitaer');
    const out = socket.sentOfType('conversation.item.create').at(-1)!.item as { output: string };
    assert.deepEqual(JSON.parse(out.output), {
      outcome: 'awaiting_confirmation',
      verified: false,
      output: { verdict: 'REQUIRE_CONFIRMATION' },
    });
    assert.deepEqual(socket.sent.at(-1), { type: 'response.create' });
  });

  it('lookup_kb → ALLOW, Tenant-Check besteht trotz eingeschleustem tenantId', async () => {
    const { decision } = await runThroughPolicy('lookup_kb', { query: 'Öffnungszeiten' });
    assert.equal(decision.verdict, 'ALLOW');
    assert.equal(decision.trace.find((s) => s.check === 'tenant')?.result, 'pass');
  });
});

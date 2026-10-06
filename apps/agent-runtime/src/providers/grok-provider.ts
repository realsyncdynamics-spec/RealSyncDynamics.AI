/**
 * Grok-Realtime-Adapter (PR 2 der Voice-Runtime).
 *
 * Implementiert den VoiceProvider-Vertrag gegen die xAI Realtime Voice API
 * ("Speech to Speech", WebSocket `wss://api.x.ai/v1/realtime`).
 * Quellen (abgerufen 2026-10-06):
 *  - https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech
 *  - https://docs.x.ai/developers/rest-api-reference/inference/voice#realtime
 *  - https://docs.x.ai/voice-realtime.ws.json (Schemas der Client-/Server-Events)
 *
 * Grenzen dieses Adapters:
 *  - Er führt NIE ein Tool aus. `response.function_call_arguments.done` wird
 *    nur als `tool.call`-Event gemeldet; ein Ergebnis geht ausschließlich über
 *    submitToolResult zurück an xAI (function_call_output + response.create).
 *  - tenantId/botId kommen nur aus der VoiceSessionConfig des Aufrufers.
 *    Gleichnamige Felder in Provider-Payloads werden ignoriert bzw. aus den
 *    Tool-Argumenten entfernt.
 *  - Der API-Key kommt über einen injizierten Getter (Default: Env
 *    XAI_API_KEY), steht nie im Code und wird nie geloggt. Der Adapter
 *    loggt überhaupt nicht.
 *  - Die WebSocket-Implementierung wird injiziert (socketFactory). Node 20
 *    (Dockerfile, CI) hat keinen globalen WebSocket-Client mit Headern; die
 *    Wahl der Implementierung (z. B. `ws`) gehört in die Session-Runtime.
 */

import {
  type AudioFormat,
  type ProviderToolCall,
  type ToolCallRejection,
  type VoiceProvider,
  type VoiceProviderEvent,
  type VoiceProviderId,
  type VoiceProviderSession,
  type VoiceProviderSessionStatus,
  type VoiceSessionConfig,
  type VoiceToolDefinition,
  type VoiceToolResult,
  isContractToolName,
} from '../voice-provider-types.js';
import { VOICE_AGENT_TOOLS } from '../voice-types.js';

// ─── WebSocket-Abstraktion (injizierbar) ────────────────────────────────────

/** Minimal-Interface; passt auf `ws` (EventTarget-API) und WHATWG-WebSocket. */
export interface RealtimeSocketEvent {
  data?: unknown;
  code?: number;
  reason?: unknown;
}

export type RealtimeSocketEventType = 'open' | 'message' | 'error' | 'close';

export interface RealtimeSocketLike {
  /** 0 CONNECTING · 1 OPEN · 2 CLOSING · 3 CLOSED (WHATWG/ws). */
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: RealtimeSocketEventType, listener: (event: RealtimeSocketEvent) => void): void;
  removeEventListener(type: RealtimeSocketEventType, listener: (event: RealtimeSocketEvent) => void): void;
}

export interface RealtimeSocketInit {
  headers: Record<string, string>;
}

export type RealtimeSocketFactory = (url: string, init: RealtimeSocketInit) => RealtimeSocketLike;

const WS_OPEN = 1;

// ─── Konfiguration ──────────────────────────────────────────────────────────

export type ApiKeyGetter = () => string | null | undefined | Promise<string | null | undefined>;

export interface GrokProviderOptions {
  /** Pflicht: erzeugt die WebSocket-Verbindung (Tests: Mock). */
  socketFactory: RealtimeSocketFactory;
  /** Liefert den xAI-API-Key serverseitig. Default: process.env.XAI_API_KEY. */
  getApiKey?: ApiKeyGetter;
  /** Default: wss://api.x.ai/v1/realtime */
  baseUrl?: string;
  /** Timeout für Verbindungsaufbau bis `session.updated`. Default 10 000 ms. */
  connectTimeoutMs?: number;
  /** Wartezeit auf das Close-Event nach closeSession. Default 2 000 ms. */
  closeTimeoutMs?: number;
  /**
   * `server_vad` (Default): xAI erkennt Turn-Ende selbst, sendAudio genügt.
   * `manual`: turn_detection.type = null, Turn-Ende über commitAudio().
   */
  turnDetection?: 'server_vad' | 'manual';
  /** Disclosure-Text per `force_message` vor dem ersten Turn sprechen. Default true. */
  speakDisclosure?: boolean;
  /** Freigegebene Tool-Namen. Default: VOICE_AGENT_TOOLS (Nora). */
  allowedTools?: readonly string[];
}

export const GROK_REALTIME_URL = 'wss://api.x.ai/v1/realtime';
export const DEFAULT_LANGUAGE = 'de-DE';

/** Felder, die nie aus Provider-Payloads übernommen werden. */
export const RESERVED_PAYLOAD_KEYS: readonly string[] = ['tenantId', 'tenant_id', 'botId', 'bot_id'];

// ─── Mapping Vertrag ↔ xAI ──────────────────────────────────────────────────

export interface XaiAudioFormat {
  type: 'audio/pcm' | 'audio/pcmu' | 'audio/pcma';
  rate?: number;
}

export class UnsupportedAudioFormatError extends Error {
  constructor(direction: 'input' | 'output', format: AudioFormat, detail: string) {
    super(
      `grok: Audio-Format ${direction} ${String(format?.encoding)}@${String(format?.sampleRateHz)} Hz nicht unterstützt — ${detail}`,
    );
    this.name = 'UnsupportedAudioFormatError';
  }
}

/**
 * Vertrag → xAI (`audio.{input,output}.format`):
 *   pcm16     @ 8000|16000|24000|48000 → { type: 'audio/pcm', rate }
 *   g711_ulaw @ 8000                   → { type: 'audio/pcmu' }
 *   g711_alaw @ 8000                   → { type: 'audio/pcma' }
 *   opus                               → fail-closed (siehe unten)
 * `rate` gilt laut xAI nur für audio/pcm; G.711 ist fest 8 kHz.
 */
export function toXaiAudioFormat(direction: 'input' | 'output', format: AudioFormat): XaiAudioFormat {
  const encoding = format?.encoding;
  const rate = format?.sampleRateHz;
  switch (encoding) {
    case 'pcm16':
      if (rate === 8000 || rate === 16000 || rate === 24000 || rate === 48000) {
        return { type: 'audio/pcm', rate };
      }
      throw new UnsupportedAudioFormatError(direction, format, 'pcm16 erlaubt laut Vertrag 8000/16000/24000/48000 Hz.');
    case 'g711_ulaw':
      if (rate === 8000) return { type: 'audio/pcmu' };
      throw new UnsupportedAudioFormatError(direction, format, 'G.711 μ-law (audio/pcmu) ist bei xAI fest 8000 Hz.');
    case 'g711_alaw':
      if (rate === 8000) return { type: 'audio/pcma' };
      throw new UnsupportedAudioFormatError(direction, format, 'G.711 A-law (audio/pcma) ist bei xAI fest 8000 Hz.');
    case 'opus':
      throw new UnsupportedAudioFormatError(
        direction,
        format,
        'xAI erwartet je Payload genau ein rohes Opus-Paket (24 kHz); diese Paketierung ist im Vertrag nicht abgebildet.',
      );
    default:
      throw new UnsupportedAudioFormatError(direction, format, 'unbekannte Kodierung.');
  }
}

/** Sprachcodes laut xAI-Tabelle "Supported Languages" (Stand 2026-10-06). */
const XAI_LANGUAGE_HINTS: readonly string[] = [
  'en', 'ar-EG', 'ar-SA', 'ar-AE', 'bn', 'zh', 'fr', 'de', 'hi', 'id', 'it',
  'ja', 'ko', 'pt-BR', 'pt-PT', 'ru', 'es-MX', 'es-ES', 'tr', 'vi',
];
/** Für es/pt verlangt xAI eine Regionalvariante; die nackte Sprache wird abgelehnt. */
const REGION_REQUIRED = new Set(['es', 'pt']);

/**
 * BCP-47 der Bot-Konfiguration → `audio.input.transcription.language_hint`.
 * de-DE → de (xAI listet Deutsch als `de`). Unbekannt → undefined (xAI
 * erkennt die Sprache dann automatisch).
 */
export function toXaiLanguageHint(language: string | undefined | null): string | undefined {
  const tag = (language ?? '').trim() || DEFAULT_LANGUAGE;
  const exact = XAI_LANGUAGE_HINTS.find((h) => h.toLowerCase() === tag.toLowerCase());
  if (exact) return exact;
  const primary = tag.split('-')[0]?.toLowerCase() ?? '';
  if (REGION_REQUIRED.has(primary)) return undefined;
  return XAI_LANGUAGE_HINTS.find((h) => h.toLowerCase() === primary);
}

export interface XaiFunctionTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Vertrag → xAI `session.tools[]` (Custom Function Tool, flache Form laut Guide). */
export function toXaiTool(tool: VoiceToolDefinition): XaiFunctionTool {
  return {
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };
}

// ─── Session-Zustand ────────────────────────────────────────────────────────

interface SessionContext {
  readonly tenantId: string;
  readonly botId: string;
  readonly sessionId: string;
  readonly correlationId: string;
}

interface SessionState {
  readonly ctx: SessionContext;
  readonly model: string;
  readonly offeredTools: ReadonlySet<string>;
  readonly onEvent: (event: VoiceProviderEvent) => void;
  readonly socket: RealtimeSocketLike;
  readonly listeners: Array<[RealtimeSocketEventType, (event: RealtimeSocketEvent) => void]>;
  status: VoiceProviderSessionStatus;
  providerSessionRef: string | null;
  /** Offene Tool-Calls (callId → Name), warten auf submitToolResult. */
  readonly pendingCalls: Map<string, string>;
  /** Alle je gesehenen callIds (Duplikat-Schutz). */
  readonly seenCalls: Set<string>;
  responseInFlight: boolean;
  needsResponseCreate: boolean;
  /** Assistant-Transkript je item_id (Deltas kumuliert). */
  readonly assistantText: Map<string, string>;
  sawProviderError: boolean;
  closeReason: 'caller' | 'runtime' | 'provider' | 'error' | null;
  connectTimer: ReturnType<typeof setTimeout> | null;
  closeTimer: ReturnType<typeof setTimeout> | null;
  setup: { resolve: (s: VoiceProviderSession) => void; reject: (e: Error) => void } | null;
  closeWaiters: Array<() => void>;
  speakDisclosure: boolean;
  disclosureText: string;
}

type ScreenResult =
  | { ok: true; call: ProviderToolCall }
  | { ok: false; callId: string | null; reason: ToolCallRejection | 'duplicate_call_id' };

// ─── Provider ───────────────────────────────────────────────────────────────

export class GrokProvider implements VoiceProvider {
  readonly id: VoiceProviderId = 'grok';

  private readonly socketFactory: RealtimeSocketFactory;
  private readonly getApiKey: ApiKeyGetter;
  private readonly baseUrl: string;
  private readonly connectTimeoutMs: number;
  private readonly closeTimeoutMs: number;
  private readonly turnDetection: 'server_vad' | 'manual';
  private readonly speakDisclosure: boolean;
  private readonly allowedTools: ReadonlySet<string>;
  private readonly sessions = new Map<string, SessionState>();

  constructor(options: GrokProviderOptions) {
    if (!options || typeof options.socketFactory !== 'function') {
      throw new Error('grok: socketFactory fehlt — WebSocket-Implementierung muss injiziert werden.');
    }
    this.socketFactory = options.socketFactory;
    this.getApiKey = options.getApiKey ?? (() => process.env.XAI_API_KEY);
    this.baseUrl = options.baseUrl ?? GROK_REALTIME_URL;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
    this.closeTimeoutMs = options.closeTimeoutMs ?? 2_000;
    this.turnDetection = options.turnDetection ?? 'server_vad';
    this.speakDisclosure = options.speakDisclosure ?? true;
    const allowed = options.allowedTools ?? VOICE_AGENT_TOOLS;
    // Nur Contract-Tools können je freigegeben sein — auch wenn die Option mehr nennt.
    this.allowedTools = new Set(allowed.filter((t) => isContractToolName(t)));
  }

  /** Serverseitiger Kontext einer Session (tenantId/botId aus der Config, nie vom Provider). */
  getSessionContext(sessionId: string): SessionContext | undefined {
    return this.sessions.get(sessionId)?.ctx;
  }

  getSession(sessionId: string): VoiceProviderSession | undefined {
    const s = this.sessions.get(sessionId);
    return s ? this.snapshot(s) : undefined;
  }

  async createSession(
    config: VoiceSessionConfig,
    onEvent: (event: VoiceProviderEvent) => void,
  ): Promise<VoiceProviderSession> {
    // 1. Fail-closed validieren, bevor irgendetwas das Netz berührt.
    if (!config || config.provider !== 'grok') {
      throw new Error('grok: config.provider muss "grok" sein.');
    }
    for (const key of ['tenantId', 'botId', 'sessionId', 'correlationId'] as const) {
      if (typeof config[key] !== 'string' || config[key].trim() === '') {
        throw new Error(`grok: config.${key} fehlt (serverseitig aufzulösen).`);
      }
    }
    if (typeof config.model !== 'string' || config.model.trim() === '' || /\s/.test(config.model)) {
      throw new Error('grok: config.model fehlt oder ist ungültig.');
    }
    if (typeof onEvent !== 'function') throw new Error('grok: onEvent fehlt.');
    if (this.sessions.has(config.sessionId)) {
      throw new Error('grok: Session existiert bereits.');
    }
    const inputFormat = toXaiAudioFormat('input', config.inputAudio);
    const outputFormat = toXaiAudioFormat('output', config.outputAudio);
    const tools = this.validateTools(config.tools);

    const apiKey = await this.getApiKey();
    if (typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new Error('grok: xAI-API-Key nicht konfiguriert.');
    }
    if (this.sessions.has(config.sessionId)) {
      throw new Error('grok: Session existiert bereits.');
    }

    const url = `${this.baseUrl}?model=${encodeURIComponent(config.model)}`;
    const socket = this.socketFactory(url, { headers: { Authorization: `Bearer ${apiKey.trim()}` } });

    const state: SessionState = {
      ctx: Object.freeze({
        tenantId: config.tenantId,
        botId: config.botId,
        sessionId: config.sessionId,
        correlationId: config.correlationId,
      }),
      model: config.model,
      offeredTools: new Set(tools.map((t) => t.name)),
      onEvent,
      socket,
      listeners: [],
      status: 'connecting',
      providerSessionRef: null,
      pendingCalls: new Map(),
      seenCalls: new Set(),
      responseInFlight: false,
      needsResponseCreate: false,
      assistantText: new Map(),
      sawProviderError: false,
      closeReason: null,
      connectTimer: null,
      closeTimer: null,
      setup: null,
      closeWaiters: [],
      speakDisclosure: this.speakDisclosure,
      disclosureText: typeof config.disclosureText === 'string' ? config.disclosureText.trim() : '',
    };
    this.sessions.set(config.sessionId, state);

    const languageHint = toXaiLanguageHint(config.language);
    const sessionUpdate = {
      type: 'session.update',
      session: {
        instructions: config.instructions,
        ...(config.voice ? { voice: config.voice } : {}),
        turn_detection: { type: this.turnDetection === 'server_vad' ? 'server_vad' : null },
        audio: {
          input: {
            format: inputFormat,
            ...(languageHint ? { transcription: { language_hint: languageHint } } : {}),
          },
          output: { format: outputFormat },
        },
        tools: tools.map(toXaiTool),
      },
    };

    return new Promise<VoiceProviderSession>((resolve, reject) => {
      state.setup = { resolve, reject };
      state.connectTimer = setTimeout(() => {
        this.failSetup(state, new Error('grok: Timeout beim Session-Aufbau.'));
      }, this.connectTimeoutMs);

      this.listen(state, 'open', () => {
        try {
          this.send(state, sessionUpdate);
        } catch {
          this.failSetup(state, new Error('grok: session.update konnte nicht gesendet werden.'));
        }
      });
      this.listen(state, 'message', (event) => this.onMessage(state, event.data));
      this.listen(state, 'error', () => {
        if (state.setup) {
          this.failSetup(state, new Error('grok: WebSocket-Fehler beim Session-Aufbau.'));
          return;
        }
        state.sawProviderError = true;
        this.emit(state, { type: 'error', sessionId: state.ctx.sessionId, code: 'transport_error', retryable: true });
      });
      this.listen(state, 'close', () => this.onSocketClosed(state));
    });
  }

  async sendAudio(sessionId: string, audio: ArrayBuffer): Promise<void> {
    const state = this.requireOpen(sessionId);
    if (!(audio instanceof ArrayBuffer)) throw new Error('grok: audio muss ein ArrayBuffer sein.');
    if (audio.byteLength === 0) return;
    this.send(state, { type: 'input_audio_buffer.append', audio: Buffer.from(audio).toString('base64') });
  }

  /** Nur im manuellen Turn-Modus: schließt den Nutzer-Turn ab (input_audio_buffer.commit). */
  async commitAudio(sessionId: string): Promise<void> {
    const state = this.requireOpen(sessionId);
    if (this.turnDetection !== 'manual') {
      throw new Error('grok: commitAudio nur mit turnDetection "manual" (xAI: commit nur bei turn_detection null).');
    }
    this.send(state, { type: 'input_audio_buffer.commit' });
  }

  async submitToolResult(sessionId: string, result: VoiceToolResult): Promise<void> {
    const state = this.requireOpen(sessionId);
    if (!result || typeof result.callId !== 'string' || !state.pendingCalls.has(result.callId)) {
      throw new Error('grok: callId unbekannt oder bereits beantwortet.');
    }
    const outcomes: ReadonlyArray<VoiceToolResult['outcome']> = ['executed', 'denied', 'awaiting_confirmation', 'failed'];
    if (!outcomes.includes(result.outcome)) throw new Error('grok: ungültiges outcome.');
    if (typeof result.verified !== 'boolean') throw new Error('grok: verified muss boolean sein.');
    if (result.verified && result.outcome !== 'executed') {
      throw new Error('grok: verified=true nur bei outcome "executed".');
    }
    if (typeof result.output !== 'object' || result.output === null || Array.isArray(result.output)) {
      throw new Error('grok: output muss ein Objekt sein.');
    }
    const output = JSON.stringify({ outcome: result.outcome, verified: result.verified, output: result.output });
    this.sendFunctionOutput(state, result.callId, output);
  }

  async closeSession(sessionId: string, reason: 'caller' | 'runtime' = 'runtime'): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state || state.status === 'closed' || state.status === 'failed') return;
    if (state.status === 'closing') {
      await new Promise<void>((resolve) => state.closeWaiters.push(resolve));
      return;
    }
    if (state.setup) {
      this.failSetup(state, new Error('grok: Session wurde während des Aufbaus geschlossen.'));
      return;
    }
    state.status = 'closing';
    state.closeReason = reason;
    const done = new Promise<void>((resolve) => state.closeWaiters.push(resolve));
    state.closeTimer = setTimeout(() => this.finalize(state), this.closeTimeoutMs);
    try {
      state.socket.close(1000, 'session closed');
    } catch {
      this.finalize(state);
    }
    await done;
  }

  // ─── intern ───────────────────────────────────────────────────────────────

  private validateTools(tools: VoiceToolDefinition[] | undefined): VoiceToolDefinition[] {
    if (tools === undefined) return [];
    if (!Array.isArray(tools)) throw new Error('grok: config.tools muss ein Array sein.');
    const seen = new Set<string>();
    for (const tool of tools) {
      const name = (tool as { name?: unknown })?.name;
      if (typeof name !== 'string' || !this.allowedTools.has(name)) {
        throw new Error(`grok: Tool "${String(name)}" ist nicht freigegeben.`);
      }
      if (seen.has(name)) throw new Error(`grok: Tool "${name}" doppelt definiert.`);
      seen.add(name);
      if (typeof tool.description !== 'string') throw new Error(`grok: Tool "${name}" ohne description.`);
      if (typeof tool.parameters !== 'object' || tool.parameters === null || Array.isArray(tool.parameters)) {
        throw new Error(`grok: Tool "${name}" ohne gültiges JSON-Schema.`);
      }
    }
    return tools;
  }

  private listen(
    state: SessionState,
    type: RealtimeSocketEventType,
    listener: (event: RealtimeSocketEvent) => void,
  ): void {
    state.socket.addEventListener(type, listener);
    state.listeners.push([type, listener]);
  }

  private send(state: SessionState, message: Record<string, unknown>): void {
    if (state.socket.readyState !== WS_OPEN) throw new Error('grok: WebSocket ist nicht offen.');
    state.socket.send(JSON.stringify(message));
  }

  private emit(state: SessionState, event: VoiceProviderEvent): void {
    try {
      state.onEvent(event);
    } catch {
      // Ein werfender Konsument darf den Socket-Handler nicht abbrechen.
    }
  }

  private requireOpen(sessionId: string): SessionState {
    const state = this.sessions.get(sessionId);
    if (!state || state.status !== 'open') throw new Error('grok: Session nicht offen.');
    return state;
  }

  private snapshot(state: SessionState): VoiceProviderSession {
    return {
      sessionId: state.ctx.sessionId,
      provider: 'grok',
      model: state.model,
      providerSessionRef: state.providerSessionRef,
      status: state.status,
    };
  }

  private onMessage(state: SessionState, data: unknown): void {
    if (state.status === 'closed' || state.status === 'failed') return;
    let text: string | null = null;
    if (typeof data === 'string') text = data;
    else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      // transport=json ist gesetzt; Binärframes sind nicht erwartet.
      return;
    }
    if (text === null) return;
    let msg: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
      msg = parsed as Record<string, unknown>;
    } catch {
      this.emit(state, { type: 'error', sessionId: state.ctx.sessionId, code: 'provider_protocol_error', retryable: true });
      return;
    }
    const sessionId = state.ctx.sessionId; // nie aus der Payload
    const type = typeof msg.type === 'string' ? msg.type : '';

    switch (type) {
      case 'session.created': {
        const ref = str(obj(msg.session)?.id);
        if (ref) state.providerSessionRef = ref;
        return;
      }
      case 'conversation.created': {
        const ref = str(obj(msg.conversation)?.id);
        if (ref && !state.providerSessionRef) state.providerSessionRef = ref;
        return;
      }
      case 'session.updated': {
        if (!state.setup) return;
        if (state.speakDisclosure && state.disclosureText) {
          try {
            // xAI-Extension: verbatim per TTS, ohne Modell; kein response.create danach.
            this.send(state, {
              type: 'conversation.item.create',
              item: {
                type: 'force_message',
                role: 'assistant',
                interruptible: false,
                content: [{ type: 'output_text', text: state.disclosureText }],
              },
            });
          } catch {
            this.failSetup(state, new Error('grok: Disclosure konnte nicht gesendet werden.'));
            return;
          }
        }
        const setup = state.setup;
        state.setup = null;
        clearTimer(state, 'connectTimer');
        state.status = 'open';
        this.emit(state, { type: 'session.opened', sessionId, providerSessionRef: state.providerSessionRef });
        setup.resolve(this.snapshot(state));
        return;
      }
      case 'response.output_audio.delta':
      case 'response.audio.delta': {
        const b64 = str(msg.delta);
        if (!b64) return;
        this.emit(state, { type: 'audio.output', sessionId, audio: base64ToArrayBuffer(b64) });
        return;
      }
      case 'conversation.item.input_audio_transcription.updated':
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = str(msg.transcript);
        if (transcript === null) return;
        this.emit(state, {
          type: 'transcript.user',
          sessionId,
          text: transcript,
          final: type.endsWith('.completed'),
        });
        return;
      }
      case 'response.output_audio_transcript.delta': {
        const delta = str(msg.delta);
        if (delta === null) return;
        const itemId = str(msg.item_id) ?? '';
        const text = (state.assistantText.get(itemId) ?? '') + delta;
        state.assistantText.set(itemId, text);
        this.emit(state, { type: 'transcript.assistant', sessionId, text, final: false });
        return;
      }
      case 'response.output_audio_transcript.done': {
        const itemId = str(msg.item_id) ?? '';
        const text = str(msg.transcript) ?? state.assistantText.get(itemId) ?? '';
        state.assistantText.delete(itemId);
        this.emit(state, { type: 'transcript.assistant', sessionId, text, final: true });
        return;
      }
      case 'response.created':
        state.responseInFlight = true;
        return;
      case 'response.done':
        state.responseInFlight = false;
        this.maybeContinue(state);
        return;
      case 'response.function_call_arguments.done':
        this.onFunctionCall(state, msg);
        return;
      case 'error': {
        const err = obj(msg.error);
        const code = str(err?.code) ?? str(err?.type) ?? 'unknown';
        state.sawProviderError = true;
        this.emit(state, {
          type: 'error',
          sessionId,
          code: `xai.${sanitizeCode(code)}`,
          retryable: code === 'internal_error' || code === 'timeout',
        });
        return;
      }
      default:
        // Übrige Server-Events (speech_started, output_item.*, mcp_* …) sind
        // für den Vertrag nicht relevant und werden bewusst verworfen.
        return;
    }
  }

  private onFunctionCall(state: SessionState, msg: Record<string, unknown>): void {
    const sessionId = state.ctx.sessionId;
    const screened = this.screenToolCall(state, msg);
    if (!screened.ok) {
      this.emit(state, {
        type: 'error',
        sessionId,
        code: `tool_call_rejected.${screened.reason}`,
        retryable: false,
      });
      // Fail-closed: das Modell erfährt die Ablehnung, damit es nicht auf ein
      // Ergebnis wartet. Es wird nichts ausgeführt.
      if (screened.callId && screened.reason !== 'duplicate_call_id') {
        state.seenCalls.add(screened.callId);
        state.pendingCalls.set(screened.callId, '');
        try {
          this.sendFunctionOutput(
            state,
            screened.callId,
            JSON.stringify({ outcome: 'denied', verified: false, output: { reason: screened.reason } }),
          );
        } catch {
          state.pendingCalls.delete(screened.callId);
        }
      }
      return;
    }
    state.seenCalls.add(screened.call.callId);
    state.pendingCalls.set(screened.call.callId, screened.call.name);
    this.emit(state, { type: 'tool.call', sessionId, call: screened.call });
  }

  /**
   * Erste, billigste Schranke vor normalizeProviderToolCall + Policy:
   * gleiche Gründe wie der Contract, plus Duplikat-Schutz. Reservierte
   * Felder (tenantId/botId) werden aus den Argumenten entfernt.
   */
  private screenToolCall(state: SessionState, msg: Record<string, unknown>): ScreenResult {
    const rawId = str(msg.call_id);
    const callId = rawId && rawId.trim() !== '' ? rawId : null;
    if (!callId) return { ok: false, callId: null, reason: 'missing_call_id' };
    if (state.seenCalls.has(callId)) return { ok: false, callId, reason: 'duplicate_call_id' };
    const name = str(msg.name) ?? '';
    if (!isContractToolName(name) || !this.allowedTools.has(name)) return { ok: false, callId, reason: 'unknown_tool' };
    if (!state.offeredTools.has(name)) return { ok: false, callId, reason: 'tool_not_offered' };

    let args: unknown = msg.arguments ?? {};
    if (typeof args === 'string') {
      try {
        args = args.trim() === '' ? {} : JSON.parse(args);
      } catch {
        return { ok: false, callId, reason: 'invalid_arguments' };
      }
    }
    if (typeof args !== 'object' || args === null || Array.isArray(args)) {
      return { ok: false, callId, reason: 'invalid_arguments' };
    }
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
      if (RESERVED_PAYLOAD_KEYS.includes(key)) continue;
      clean[key] = value;
    }
    return { ok: true, call: { callId, name, arguments: clean } };
  }

  private sendFunctionOutput(state: SessionState, callId: string, output: string): void {
    this.send(state, {
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id: callId, output },
    });
    state.pendingCalls.delete(callId);
    state.needsResponseCreate = true;
    this.maybeContinue(state);
  }

  /**
   * xAI: bei parallelen Tool-Calls erst alle function_call_output senden,
   * dann genau ein response.create. Solange die auslösende Antwort noch
   * läuft (vor response.done), wird response.create zurückgestellt.
   */
  private maybeContinue(state: SessionState): void {
    if (!state.needsResponseCreate || state.pendingCalls.size > 0 || state.responseInFlight) return;
    if (state.status !== 'open' || state.socket.readyState !== WS_OPEN) return;
    state.needsResponseCreate = false;
    this.send(state, { type: 'response.create' });
  }

  private failSetup(state: SessionState, error: Error): void {
    const setup = state.setup;
    if (!setup) return;
    state.setup = null;
    state.status = 'failed';
    this.detach(state);
    try {
      state.socket.close(1000, 'setup failed');
    } catch {
      // Socket evtl. noch im Handshake — Aufräumen geht trotzdem weiter.
    }
    setup.reject(error);
  }

  private onSocketClosed(state: SessionState): void {
    if (state.setup) {
      this.failSetup(state, new Error('grok: Verbindung beim Session-Aufbau geschlossen.'));
      return;
    }
    this.finalize(state);
  }

  private finalize(state: SessionState): void {
    if (state.status === 'closed' || state.status === 'failed') return;
    const reason = state.closeReason ?? (state.sawProviderError ? 'error' : 'provider');
    state.status = 'closed';
    this.detach(state);
    this.emit(state, { type: 'session.closed', sessionId: state.ctx.sessionId, reason });
    const waiters = state.closeWaiters.splice(0);
    for (const w of waiters) w();
  }

  /** Entfernt Listener, Timer und den Session-Eintrag. */
  private detach(state: SessionState): void {
    clearTimer(state, 'connectTimer');
    clearTimer(state, 'closeTimer');
    for (const [type, listener] of state.listeners.splice(0)) {
      try {
        state.socket.removeEventListener(type, listener);
      } catch {
        // ignorieren
      }
    }
    state.pendingCalls.clear();
    state.assistantText.clear();
    if (this.sessions.get(state.ctx.sessionId) === state) this.sessions.delete(state.ctx.sessionId);
    if (state.status === 'failed') {
      const waiters = state.closeWaiters.splice(0);
      for (const w of waiters) w();
    }
  }
}

// ─── Helfer ─────────────────────────────────────────────────────────────────

function obj(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function sanitizeCode(code: string): string {
  return code.replace(/[^a-z0-9_.-]/gi, '_').slice(0, 64) || 'unknown';
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bytes = Buffer.from(b64, 'base64');
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

function clearTimer(state: SessionState, key: 'connectTimer' | 'closeTimer'): void {
  const timer = state[key];
  if (timer) clearTimeout(timer);
  state[key] = null;
}

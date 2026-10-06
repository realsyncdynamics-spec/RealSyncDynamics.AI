/**
 * Voice Session-Runtime (PR 3 + PR 4 Anbindung).
 *
 * Verdrahtet den Grok-Realtime-Adapter mit `ws` und leitet jeden
 * `tool.call` an POST /voice-tool (Policy) und anschließend an das
 * Tool-Gateway (Ausführung/Verifikation/Evidenz, PR 4) weiter.
 *
 * Grenzen:
 *  - tenantId/botId ausschließlich aus dem Session-Kontext.
 *  - Disclosure ist Pflicht und wird verbatim gesprochen.
 *  - Kein voice_channels / bot_agents. Keine Secrets im Code/Log.
 *  - evaluate() in policy-engine.ts bleibt unberührt.
 */

import {
  GrokProvider,
  type ApiKeyGetter,
  type RealtimeSocketFactory,
} from '../providers/grok-provider.js';
import {
  isContractToolName,
  type AudioFormat,
  type ProviderToolCall,
  type VoiceProviderEvent,
  type VoiceProviderSession,
  type VoiceToolDefinition,
  type VoiceToolResult,
} from '../voice-provider-types.js';
import { VOICE_AGENT_ID, type VoiceConsent } from '../voice-types.js';
import {
  createVoiceToolGateway,
  type VoiceToolGateway,
} from './tool-gateway.js';
import {
  createVoiceToolClient,
  sanitizeToolArgs,
  type VoiceToolClient,
  type VoiceToolSessionSnapshot,
} from './voice-tool-client.js';
import { createWsSocketFactory } from './ws-socket-factory.js';

export interface VoiceSessionStartRequest {
  /** Serverseitig aufgelöst (voice_number_bindings) — nie aus URL/Body. */
  tenantId: string;
  botId: string;
  sessionId: string;
  correlationId: string;
  model: string;
  voice?: string;
  language: string;
  instructions: string;
  /**
   * Pflicht-Hinweis (Art. 50 EU AI Act) aus voice_bot_configs.disclosure_text.
   * Wird verbatim gesprochen. Leer/fehlend → fail-closed.
   */
  disclosureText: string;
  /**
   * Optionale Begrüßung NACH der Disclosure. Kein Default im Code —
   * Marketing-Story-Texte gehören hierher, nicht in disclosureText.
   */
  greetingText?: string;
  tools: VoiceToolDefinition[];
  inputAudio: AudioFormat;
  outputAudio: AudioFormat;
  session: VoiceToolSessionSnapshot;
  consent: VoiceConsent | null;
}

export interface SessionRuntimeOptions {
  /** WebSocket-Factory. Default: createWsSocketFactory() (`ws`). */
  socketFactory?: RealtimeSocketFactory;
  /** xAI-API-Key. Default: process.env.XAI_API_KEY — nie loggen. */
  getApiKey?: ApiKeyGetter;
  /** HTTP-Client für /voice-tool. Default: createVoiceToolClient aus Env. */
  voiceToolClient?: VoiceToolClient;
  /** Base-URL für /voice-tool. Default: AGENT_RUNTIME_VOICE_TOOL_BASE_URL oder http://127.0.0.1:PORT. */
  voiceToolBaseUrl?: string;
  /** Timeout für /voice-tool in ms. Default: AGENT_RUNTIME_VOICE_TOOL_TIMEOUT_MS oder 5000. */
  voiceToolTimeoutMs?: number;
  /** Bearer-Token-Getter. Default: AGENT_RUNTIME_API_TOKEN. */
  getApiToken?: () => string | null | undefined;
  /** Passthrough für Provider-Events (Audio, Transkripte, …). */
  onEvent?: (event: VoiceProviderEvent) => void;
  /** Injizierbarer Provider (Tests). Default: neuer GrokProvider. */
  provider?: GrokProvider;
  /**
   * Tool-Gateway (Ausführung/Evidenz).
   * Default: createVoiceToolGateway() — Supabase aus Env, sonst fail-closed
   * not_configured. Memory nur in Tests explizit injizieren.
   */
  toolGateway?: VoiceToolGateway;
}

interface LiveSession {
  readonly tenantId: string;
  readonly botId: string;
  readonly sessionId: string;
  readonly offeredTools: ReadonlySet<string>;
  readonly session: VoiceToolSessionSnapshot;
  readonly consent: VoiceConsent | null;
  /** Autoritative Zähler — vor jedem /voice-tool-Aufruf reservieren. */
  turnCount: number;
  toolCount: number;
}

export class VoiceSessionRuntime {
  private readonly provider: GrokProvider;
  private readonly voiceTool: VoiceToolClient;
  private readonly toolGateway: VoiceToolGateway;
  private readonly onEvent: ((event: VoiceProviderEvent) => void) | undefined;
  private readonly sessions = new Map<string, LiveSession>();

  constructor(options: SessionRuntimeOptions = {}) {
    const socketFactory = options.socketFactory ?? createWsSocketFactory();
    this.provider =
      options.provider ??
      new GrokProvider({
        socketFactory,
        getApiKey: options.getApiKey,
        speakDisclosure: true,
      });
    this.voiceTool =
      options.voiceToolClient ??
      createVoiceToolClient({
        baseUrl: options.voiceToolBaseUrl ?? defaultVoiceToolBaseUrl(),
        getApiToken: options.getApiToken ?? (() => process.env.AGENT_RUNTIME_API_TOKEN),
        timeoutMs: options.voiceToolTimeoutMs ?? defaultVoiceToolTimeoutMs(),
      });
    this.toolGateway = options.toolGateway ?? createVoiceToolGateway();
    this.onEvent = options.onEvent;
  }

  /** Startet eine Voice-Session. Disclosure fehlt → reject. */
  async startSession(request: VoiceSessionStartRequest): Promise<VoiceProviderSession> {
    this.assertStartRequest(request);
    if (this.sessions.has(request.sessionId)) {
      throw new Error('voice-runtime: Session existiert bereits.');
    }

    const disclosureText = request.disclosureText.trim();
    const greeting =
      typeof request.greetingText === 'string' && request.greetingText.trim() !== ''
        ? request.greetingText.trim()
        : null;
    // Greeting ist optional und NIE Disclosure — nur in Instructions, damit
    // das Modell nach dem force_message-Disclosure begrüßen kann.
    const instructions = greeting
      ? `${request.instructions.trim()}\n\nBegrüßung nach dem Pflicht-Hinweis: ${greeting}`
      : request.instructions;

    const live: LiveSession = {
      tenantId: request.tenantId,
      botId: request.botId,
      sessionId: request.sessionId,
      offeredTools: new Set(request.tools.map((t) => t.name)),
      session: { ...request.session, rateLimit: { ...request.session.rateLimit } },
      consent: request.consent,
      turnCount: request.session.turnCount,
      toolCount: request.session.toolCount,
    };

    const session = await this.provider.createSession(
      {
        tenantId: request.tenantId,
        botId: request.botId,
        sessionId: request.sessionId,
        correlationId: request.correlationId,
        provider: 'grok',
        model: request.model,
        voice: request.voice,
        language: request.language,
        instructions,
        disclosureText,
        tools: request.tools,
        inputAudio: request.inputAudio,
        outputAudio: request.outputAudio,
      },
      (event) => this.handleProviderEvent(live, event),
    );

    this.sessions.set(request.sessionId, live);
    return session;
  }

  async sendAudio(sessionId: string, audio: ArrayBuffer): Promise<void> {
    await this.provider.sendAudio(sessionId, audio);
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.provider.closeSession(sessionId);
    this.sessions.delete(sessionId);
  }

  getSessionContext(sessionId: string): { tenantId: string; botId: string; sessionId: string } | undefined {
    const live = this.sessions.get(sessionId);
    return live
      ? { tenantId: live.tenantId, botId: live.botId, sessionId: live.sessionId }
      : undefined;
  }

  private assertStartRequest(request: VoiceSessionStartRequest): void {
    for (const key of ['tenantId', 'botId', 'sessionId', 'correlationId', 'model', 'instructions'] as const) {
      if (typeof request[key] !== 'string' || request[key].trim() === '') {
        throw new Error(`voice-runtime: ${key} fehlt (serverseitig aufzulösen).`);
      }
    }
    if (typeof request.disclosureText !== 'string' || request.disclosureText.trim() === '') {
      throw new Error(
        'voice-runtime: disclosureText fehlt — Session startet nicht ohne Pflicht-Hinweis (Art. 50 EU AI Act).',
      );
    }
    if (!Array.isArray(request.tools)) {
      throw new Error('voice-runtime: tools muss ein Array sein.');
    }
    for (const tool of request.tools) {
      if (!isContractToolName(tool.name)) {
        throw new Error(`voice-runtime: Tool "${String(tool.name)}" ist nicht freigegeben.`);
      }
    }
  }

  private handleProviderEvent(live: LiveSession, event: VoiceProviderEvent): void {
    if (event.type === 'tool.call') {
      // Fail-closed asynchron — der Provider-Handler darf nicht blockieren.
      void this.onToolCall(live, event.call).catch(() => {
        // submitToolResult-Fehler werden im onToolCall selbst abgefangen.
      });
      return;
    }
    // Turn-Grenze: finaler Nutzer-Transcript erhöht den Zähler vor späteren Tools.
    if (event.type === 'transcript.user' && event.final) {
      live.turnCount += 1;
    }
    if (event.type === 'session.closed' || event.type === 'error') {
      this.onEvent?.(event);
      if (event.type === 'session.closed') this.sessions.delete(live.sessionId);
      return;
    }
    this.onEvent?.(event);
  }

  private async onToolCall(live: LiveSession, call: ProviderToolCall): Promise<void> {
    const callId = typeof call.callId === 'string' ? call.callId.trim() : '';
    if (!callId) return;
    const result = await this.evaluateToolCall(live, call);
    try {
      await this.provider.submitToolResult(live.sessionId, result);
    } catch {
      // Session evtl. schon geschlossen — nichts nachreichen.
    }
  }

  private async evaluateToolCall(live: LiveSession, call: ProviderToolCall): Promise<VoiceToolResult> {
    const callId = typeof call.callId === 'string' && call.callId.trim() !== '' ? call.callId : '';
    if (!callId) {
      return deniedResult('missing_call_id', '');
    }

    // Unbekanntes / nicht angebotenes Tool: kein /voice-tool-Aufruf.
    if (!isContractToolName(call.name) || !live.offeredTools.has(call.name)) {
      return deniedResult('unknown_tool', callId);
    }

    let rawArgs: unknown = call.arguments ?? {};
    if (typeof rawArgs === 'string') {
      try {
        rawArgs = rawArgs.trim() === '' ? {} : JSON.parse(rawArgs);
      } catch {
        return deniedResult('invalid_arguments', callId);
      }
    }
    if (typeof rawArgs !== 'object' || rawArgs === null || Array.isArray(rawArgs)) {
      return deniedResult('invalid_arguments', callId);
    }

    const clean = sanitizeToolArgs(rawArgs as Record<string, unknown>);
    if (clean === null) {
      return deniedResult('invalid_arguments', callId);
    }

    // Slot vor dem Await reservieren — parallele tool.call dürfen denselben
    // Zähler nicht an /voice-tool senden (sonst umgehen sie maxTools).
    const toolCountForPolicy = live.toolCount;
    live.toolCount += 1;

    // tenantId/botId nie aus Args — immer Session-Kontext.
    const outcome = await this.voiceTool.evaluate({
      tenantId: live.tenantId,
      sessionId: live.sessionId,
      requestId: `vt_${callId}`,
      tool: call.name,
      args: clean,
      session: {
        killSwitch: live.session.killSwitch,
        turnCount: live.turnCount,
        toolCount: toolCountForPolicy,
        rateLimit: live.session.rateLimit,
      },
      consent: live.consent,
    });

    const decision = outcome.decision;
    if (!decision) {
      // Kein Decision-Payload → fail-closed. Nie eine Policy-Entscheidung erfinden.
      if (!outcome.ok) {
        return {
          callId,
          outcome: 'denied',
          verified: false,
          output: { reason: outcome.reason, agentId: VOICE_AGENT_ID },
        };
      }
      return {
        callId,
        outcome: 'denied',
        verified: false,
        output: { reason: 'missing_policy_decision', agentId: VOICE_AGENT_ID },
      };
    }

    if (decision.decidedBy !== 'policy-engine') {
      return {
        callId,
        outcome: 'denied',
        verified: false,
        output: { reason: 'invalid_decided_by', agentId: VOICE_AGENT_ID },
      };
    }
    if (decision.tenantId !== live.tenantId || decision.sessionId !== live.sessionId) {
      return {
        callId,
        outcome: 'denied',
        verified: false,
        output: { reason: 'tenant_session_mismatch', agentId: VOICE_AGENT_ID },
      };
    }

    return this.toolGateway.handle({
      tenantId: live.tenantId,
      botId: live.botId,
      sessionId: live.sessionId,
      callId,
      tool: call.name,
      args: clean,
      decision,
      confirmed: false,
    });
  }
}

function deniedResult(reason: string, callId: string): VoiceToolResult {
  return {
    callId: callId || 'unknown',
    outcome: 'denied',
    verified: false,
    output: { reason },
  };
}

function defaultVoiceToolBaseUrl(): string {
  const fromEnv = process.env.AGENT_RUNTIME_VOICE_TOOL_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const port = process.env.PORT?.trim() || '8787';
  return `http://127.0.0.1:${port}`;
}

function defaultVoiceToolTimeoutMs(): number {
  const raw = process.env.AGENT_RUNTIME_VOICE_TOOL_TIMEOUT_MS?.trim();
  if (!raw) return 5_000;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 5_000;
}

export { createWsSocketFactory } from './ws-socket-factory.js';
export {
  createVoiceToolClient,
  sanitizeToolArgs,
  type VoiceToolClient,
  type VoiceToolHttpRequest,
  type VoiceToolHttpOutcome,
} from './voice-tool-client.js';
export {
  createVoiceToolGateway,
  createMemoryVoiceStore,
  createSupabaseVoiceStore,
  createSupabaseVoiceStoreFromEnv,
  VOICE_GENESIS_HASH,
  type VoiceToolGateway,
} from './tool-gateway.js';

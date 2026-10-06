/**
 * Voice Session-Runtime (PR 3–4 + Session-Persistenz).
 *
 * Verdrahtet den Grok-Realtime-Adapter mit `ws` und leitet jeden
 * `tool.call` an POST /voice-tool (Policy) und anschließend an das
 * Tool-Gateway (Ausführung/Verifikation/Evidenz) weiter.
 *
 * Mit konfiguriertem VoiceStore:
 *  - Kontext aus voice_bot_configs / voice_number_bindings (status=active)
 *  - voice_sessions-Zeile VOR Provider-Start; deren uuid = sessionId
 *  - Caller-tenantId/policy/disclosure überschreiben den DB-Snapshot nie
 *
 * Grenzen:
 *  - tenantId/botId ausschließlich aus Session-Kontext / DB-Snapshot.
 *  - Disclosure ist Pflicht und wird verbatim gesprochen.
 *  - Kein voice_channels / bot_agents. Keine Secrets im Code/Log.
 *  - evaluate() in policy-engine.ts bleibt unberührt.
 */

import { randomUUID } from 'node:crypto';

import {
  GrokProvider,
  type ApiKeyGetter,
  type RealtimeSocketFactory,
} from '../providers/grok-provider.js';
import {
  CONTRACT_TOOL_NAMES,
  isContractToolName,
  type AudioFormat,
  type ProviderToolCall,
  type VoiceProviderEvent,
  type VoiceProviderSession,
  type VoiceToolDefinition,
  type VoiceToolResult,
} from '../voice-provider-types.js';
import { VOICE_AGENT_ID, type VoiceConsent, type VoiceToolName } from '../voice-types.js';
import { VOICE_TOOLS } from '../voice-tools.js';
import { createSupabaseVoiceStoreFromEnv } from './supabase-voice-store.js';
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
import type { VoiceStore } from './voice-store.js';
import { createWsSocketFactory } from './ws-socket-factory.js';

export interface VoiceSessionStartRequest {
  /**
   * Ohne Store: Pflicht (serverseitig aufgelöst).
   * Mit Store: wird vom DB-Snapshot überschrieben / ignoriert.
   */
  tenantId?: string;
  /** Mit Store: botId oder numberBindingId zur Auflösung. */
  botId?: string;
  numberBindingId?: string;
  /** Ohne Store: Pflicht. Mit Store: wird durch voice_sessions.id ersetzt. */
  sessionId?: string;
  correlationId?: string;
  model?: string;
  voice?: string;
  language?: string;
  instructions: string;
  /**
   * Ohne Store: Pflicht.
   * Mit Store: Snapshot aus voice_bot_configs.disclosure_text — Caller-Wert ignoriert.
   */
  disclosureText?: string;
  greetingText?: string;
  /** Tool-Schemas; mit Store auf Schnittmenge Contract ∩ offered_tools gefiltert. */
  tools?: VoiceToolDefinition[];
  inputAudio: AudioFormat;
  outputAudio: AudioFormat;
  session: VoiceToolSessionSnapshot;
  consent: VoiceConsent | null;
}

export interface SessionRuntimeOptions {
  socketFactory?: RealtimeSocketFactory;
  getApiKey?: ApiKeyGetter;
  voiceToolClient?: VoiceToolClient;
  voiceToolBaseUrl?: string;
  voiceToolTimeoutMs?: number;
  getApiToken?: () => string | null | undefined;
  onEvent?: (event: VoiceProviderEvent) => void;
  provider?: GrokProvider;
  toolGateway?: VoiceToolGateway;
  /**
   * Persistenz. Explizit setzen (Tests) oder weglassen → Supabase aus Env.
   * Ohne Store: Legacy-Start ohne voice_sessions (Tools fail-closed not_configured).
   */
  store?: VoiceStore | null;
  env?: NodeJS.Dict<string | undefined>;
}

interface LiveSession {
  readonly tenantId: string;
  readonly botId: string;
  readonly sessionId: string;
  readonly offeredTools: ReadonlySet<string>;
  readonly session: VoiceToolSessionSnapshot;
  readonly consent: VoiceConsent | null;
  readonly policyRef: string | null;
  readonly persist: boolean;
  turnCount: number;
  toolCount: number;
}

export class VoiceSessionRuntime {
  private readonly provider: GrokProvider;
  private readonly voiceTool: VoiceToolClient;
  private readonly toolGateway: VoiceToolGateway;
  private readonly store: VoiceStore | null;
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

    const env = options.env ?? process.env;
    this.store =
      options.store === undefined
        ? createSupabaseVoiceStoreFromEnv({ env })
        : options.store;

    this.toolGateway =
      options.toolGateway ??
      (this.store
        ? createVoiceToolGateway({ store: this.store })
        : createVoiceToolGateway({ env: {} }));
    this.onEvent = options.onEvent;
  }

  /** Startet eine Voice-Session. Disclosure/Config fehlt → reject. */
  async startSession(request: VoiceSessionStartRequest): Promise<VoiceProviderSession> {
    if (this.store) {
      return this.startSessionWithStore(this.store, request);
    }
    return this.startSessionLegacy(request);
  }

  async sendAudio(sessionId: string, audio: ArrayBuffer): Promise<void> {
    await this.provider.sendAudio(sessionId, audio);
  }

  async closeSession(sessionId: string): Promise<void> {
    const live = this.sessions.get(sessionId);
    try {
      await this.provider.closeSession(sessionId);
    } finally {
      // Delete first — nur der Pfad, der die Session entfernt, finalisiert
      // (sonst Race mit session.closed → doppelte Evidence/seq-Konflikt).
      const removed = this.sessions.delete(sessionId);
      if (removed && live?.persist && this.store) {
        await this.finalizePersistedSession(this.store, live, 'ended');
      }
    }
  }

  getSessionContext(sessionId: string): { tenantId: string; botId: string; sessionId: string } | undefined {
    const live = this.sessions.get(sessionId);
    return live
      ? { tenantId: live.tenantId, botId: live.botId, sessionId: live.sessionId }
      : undefined;
  }

  /** true wenn ein Persistenz-Store konfiguriert ist (HTTP-Start verlangt das). */
  hasStore(): boolean {
    return this.store !== null;
  }

  private async startSessionWithStore(
    store: VoiceStore,
    request: VoiceSessionStartRequest,
  ): Promise<VoiceProviderSession> {
    const botId = typeof request.botId === 'string' ? request.botId.trim() : '';
    const numberBindingId =
      typeof request.numberBindingId === 'string' ? request.numberBindingId.trim() : '';
    if (!botId && !numberBindingId) {
      throw new Error('voice-runtime: config_not_found');
    }
    if (typeof request.instructions !== 'string' || request.instructions.trim() === '') {
      throw new Error('voice-runtime: instructions fehlt (serverseitig aufzulösen).');
    }

    const resolved = await store.resolveSessionContext(
      numberBindingId ? { numberBindingId } : { botId },
    );
    if (!resolved || !resolved.disclosureText.trim()) {
      throw new Error('voice-runtime: config_not_found');
    }
    if (resolved.provider !== 'grok') {
      throw new Error('voice-runtime: unsupported_provider');
    }

    // DB-Snapshot gewinnt — Caller-tenantId/policy/disclosure/model werden ignoriert.
    const correlationId = asUuidOrNew(request.correlationId);
    const consentPurposes = request.consent?.purposes ?? [];

    let persisted;
    try {
      persisted = await store.insertSession({
        tenantId: resolved.tenantId,
        botId: resolved.botId,
        numberBindingId: resolved.numberBindingId,
        provider: resolved.provider,
        model: resolved.model,
        policyRef: resolved.policyRef,
        correlationId,
        status: 'idle',
        consentPurposes: [...consentPurposes],
        killSwitch: request.session.killSwitch,
      });
    } catch {
      throw new Error('voice-runtime: store_error');
    }

    const sessionId = persisted.id;
    const tools = intersectOfferedTools(resolved.offeredTools, request.tools ?? []);
    const disclosureText = resolved.disclosureText.trim();
    const greeting =
      typeof request.greetingText === 'string' && request.greetingText.trim() !== ''
        ? request.greetingText.trim()
        : null;
    const instructions = greeting
      ? `${request.instructions.trim()}\n\nBegrüßung nach dem Pflicht-Hinweis: ${greeting}`
      : request.instructions;

    const live: LiveSession = {
      tenantId: resolved.tenantId,
      botId: resolved.botId,
      sessionId,
      offeredTools: new Set(tools.map((t) => t.name)),
      session: { ...request.session, rateLimit: { ...request.session.rateLimit } },
      consent: request.consent,
      policyRef: resolved.policyRef,
      persist: true,
      turnCount: request.session.turnCount,
      toolCount: request.session.toolCount,
    };

    try {
      await store.appendEvidence({
        tenantId: live.tenantId,
        sessionId,
        kind: 'session.start',
        payload: {
          provider: resolved.provider,
          model: resolved.model,
          policy_ref: resolved.policyRef,
        },
      });
    } catch {
      await this.safeFailSession(store, live);
      throw new Error('voice-runtime: store_error');
    }

    let session: VoiceProviderSession;
    try {
      session = await this.provider.createSession(
        {
          tenantId: live.tenantId,
          botId: live.botId,
          sessionId,
          correlationId,
          provider: 'grok',
          model: resolved.model,
          voice: request.voice ?? resolved.voice ?? undefined,
          language: resolved.language || request.language || 'de-DE',
          instructions,
          disclosureText,
          tools,
          inputAudio: request.inputAudio,
          outputAudio: request.outputAudio,
        },
        (event) => this.handleProviderEvent(live, event),
      );
    } catch (err) {
      await this.safeFailSession(store, live);
      throw err;
    }

    const playedAt = new Date().toISOString();
    try {
      await store.updateSessionStatus(live.tenantId, sessionId, {
        status: 'listening',
        disclosurePlayedAt: playedAt,
      });
      await store.appendEvidence({
        tenantId: live.tenantId,
        sessionId,
        kind: 'disclosure.played',
        payload: { played_at: playedAt },
      });
    } catch {
      // Session läuft bereits — Status-Update fehlgeschlagen ist fail-soft;
      // Tool-Writes bleiben durch FK an voice_sessions gebunden.
    }

    this.sessions.set(sessionId, live);
    return session;
  }

  private async startSessionLegacy(request: VoiceSessionStartRequest): Promise<VoiceProviderSession> {
    this.assertLegacyStartRequest(request);
    const sessionId = request.sessionId!.trim();
    if (this.sessions.has(sessionId)) {
      throw new Error('voice-runtime: Session existiert bereits.');
    }

    const disclosureText = request.disclosureText!.trim();
    const greeting =
      typeof request.greetingText === 'string' && request.greetingText.trim() !== ''
        ? request.greetingText.trim()
        : null;
    const instructions = greeting
      ? `${request.instructions.trim()}\n\nBegrüßung nach dem Pflicht-Hinweis: ${greeting}`
      : request.instructions;

    const tools = request.tools ?? [];
    const live: LiveSession = {
      tenantId: request.tenantId!.trim(),
      botId: request.botId!.trim(),
      sessionId,
      offeredTools: new Set(tools.map((t) => t.name)),
      session: { ...request.session, rateLimit: { ...request.session.rateLimit } },
      consent: request.consent,
      policyRef: null,
      persist: false,
      turnCount: request.session.turnCount,
      toolCount: request.session.toolCount,
    };

    const session = await this.provider.createSession(
      {
        tenantId: live.tenantId,
        botId: live.botId,
        sessionId,
        correlationId: request.correlationId!.trim(),
        provider: 'grok',
        model: request.model!.trim(),
        voice: request.voice,
        language: request.language ?? 'de-DE',
        instructions,
        disclosureText,
        tools,
        inputAudio: request.inputAudio,
        outputAudio: request.outputAudio,
      },
      (event) => this.handleProviderEvent(live, event),
    );

    this.sessions.set(sessionId, live);
    return session;
  }

  private assertLegacyStartRequest(request: VoiceSessionStartRequest): void {
    for (const key of ['tenantId', 'botId', 'sessionId', 'correlationId', 'model', 'instructions'] as const) {
      const value = request[key];
      if (typeof value !== 'string' || value.trim() === '') {
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

  private async safeFailSession(store: VoiceStore, live: LiveSession): Promise<void> {
    try {
      await store.updateSessionStatus(live.tenantId, live.sessionId, {
        status: 'failed',
        endedAt: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
  }

  private async finalizePersistedSession(
    store: VoiceStore,
    live: LiveSession,
    status: 'ended' | 'failed',
  ): Promise<void> {
    try {
      await store.appendEvidence({
        tenantId: live.tenantId,
        sessionId: live.sessionId,
        kind: 'session.end',
        payload: { status },
      });
    } catch {
      // ignore
    }
    try {
      await store.updateSessionStatus(live.tenantId, live.sessionId, {
        status,
        endedAt: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
  }

  private handleProviderEvent(live: LiveSession, event: VoiceProviderEvent): void {
    if (event.type === 'tool.call') {
      void this.onToolCall(live, event.call).catch(() => {});
      return;
    }
    if (event.type === 'transcript.user' && event.final) {
      live.turnCount += 1;
    }
    if (event.type === 'session.closed' || event.type === 'error') {
      this.onEvent?.(event);
      if (event.type === 'session.closed') {
        const removed = this.sessions.delete(live.sessionId);
        if (removed && live.persist && this.store) {
          void this.finalizePersistedSession(
            this.store,
            live,
            event.reason === 'error' ? 'failed' : 'ended',
          );
        }
      }
      return;
    }
    this.onEvent?.(event);
  }

  private async onToolCall(live: LiveSession, call: ProviderToolCall): Promise<void> {
    const callId = typeof call.callId === 'string' ? call.callId.trim() : '';
    if (!callId) return;
    let result: VoiceToolResult;
    try {
      result = await this.evaluateToolCall(live, call);
    } catch {
      result = deniedResult('internal_error', callId);
    }
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

    const toolCountForPolicy = live.toolCount;
    live.toolCount += 1;

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
      policyRef: live.policyRef ?? undefined,
    });
  }
}

/** Schnittmenge Contract ∩ offered_tools; Schemas aus request oder Fallback. */
export function intersectOfferedTools(
  offeredTools: string[],
  catalog: VoiceToolDefinition[],
): VoiceToolDefinition[] {
  const offered = new Set(
    offeredTools.filter((name): name is VoiceToolName => isContractToolName(name)),
  );
  const byName = new Map(catalog.filter((t) => isContractToolName(t.name)).map((t) => [t.name, t]));
  const out: VoiceToolDefinition[] = [];
  for (const name of CONTRACT_TOOL_NAMES) {
    if (!offered.has(name)) continue;
    const fromCatalog = byName.get(name);
    if (fromCatalog) {
      out.push(fromCatalog);
      continue;
    }
    const spec = VOICE_TOOLS[name];
    out.push({
      name,
      description: spec.label,
      parameters: { type: 'object', properties: {} },
    });
  }
  return out;
}

function asUuidOrNew(value: string | undefined): string {
  if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())) {
    return value.trim();
  }
  return randomUUID();
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

/**
 * RealSyncDynamicsAI — OpenAI Telemetry-Connector.
 *
 * Zwei Use-Patterns:
 *
 * A) Manueller Per-Call-Wrap (volle Kontrolle):
 *    import OpenAI from 'openai';
 *    import { createTelemetryClient } from '@realsyncdynamics-ai/sdk/telemetry';
 *    import { logOpenAiChatCompletion } from '@realsyncdynamics-ai/connectors/openai';
 *
 *    const openai = new OpenAI();
 *    const telemetry = createTelemetryClient({ endpoint, tenantKey });
 *
 *    const start = Date.now();
 *    const response = await openai.chat.completions.create({...});
 *    await logOpenAiChatCompletion({
 *      telemetry,
 *      request: { model: 'gpt-4.1', messages: [...] },
 *      response,
 *      latencyMs: Date.now() - start,
 *      promptCategory: 'code_generation',
 *      dataClass: 'internal',
 *      userId: currentUser.email,
 *      team: 'engineering',
 *    });
 *
 * B) Auto-Wrap via Proxy (drop-in, Logging passiert automatisch):
 *    const wrapped = wrapOpenAiClient(openai, { telemetry, defaults: {...} });
 *    const response = await wrapped.chat.completions.create({...});
 *    // -> Telemetry-Event wird automatisch gesendet, Response unveraendert
 *
 * Privacy: weder Prompt-Text noch Response-Text werden gesendet. Nur
 * Metadaten (Model, Token-Counts, Latenz, Kategorie, Datenklasse).
 */

import type {
  AiTelemetryEvent,
  AiPromptCategory,
  AiDataClass,
  AiRiskLevel,
  TelemetryClient,
  TelemetryResult,
} from '../src/sdk/telemetry';

// ─── Per-Call-Helper ─────────────────────────────────────────────────────────

export interface OpenAiChatCompletionPayload {
  telemetry: TelemetryClient;
  request: { model: string; messages?: unknown[]; tools?: unknown[] };
  response?: {
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    choices?: Array<{ finish_reason?: string }>;
  };
  latencyMs?: number;
  promptCategory?: AiPromptCategory;
  dataClass?: AiDataClass;
  riskLevel?: AiRiskLevel;
  userId?: string;
  team?: string;
  /** Externe System-ID, falls dieses Logging zu einem AI-System (ai_systems) gehoert. */
  aiSystemId?: string;
  /** Zusatz-Kontext (kein Prompt-Text!) */
  metadata?: Record<string, unknown>;
}

/** Sendet ein prompt_sent + response_received Eventpaar fuer einen
 *  OpenAI Chat-Completions-Call. */
export async function logOpenAiChatCompletion(
  p: OpenAiChatCompletionPayload,
): Promise<TelemetryResult> {
  const event: AiTelemetryEvent = {
    event_type: 'response_received',
    vendor: 'openai',
    model: p.request.model,
    user_id: p.userId,
    team: p.team,
    ai_system_id: p.aiSystemId,
    prompt_category: p.promptCategory ?? 'unknown',
    data_class: p.dataClass ?? 'unknown',
    risk_level: p.riskLevel ?? defaultRiskFor(p.dataClass),
    prompt_tokens: p.response?.usage?.prompt_tokens,
    response_tokens: p.response?.usage?.completion_tokens,
    latency_ms: p.latencyMs,
    metadata: {
      message_count: Array.isArray(p.request.messages) ? p.request.messages.length : undefined,
      tool_count: Array.isArray(p.request.tools) ? p.request.tools.length : undefined,
      finish_reason: p.response?.choices?.[0]?.finish_reason,
      ...p.metadata,
    },
  };
  return p.telemetry.trackAiEvent(event);
}

/** Sendet einen file_upload-Event fuer eine OpenAI-Files-API-Operation. */
export async function logOpenAiFileUpload(p: {
  telemetry: TelemetryClient;
  filename: string;
  sizeBytes?: number;
  purpose?: string;
  userId?: string;
  team?: string;
  dataClass?: AiDataClass;
}): Promise<TelemetryResult> {
  return p.telemetry.trackAiEvent({
    event_type: 'file_upload',
    vendor: 'openai',
    user_id: p.userId,
    team: p.team,
    prompt_category: 'extraction',
    data_class: p.dataClass ?? 'unknown',
    risk_level: 'medium',
    metadata: {
      filename: p.filename,
      file_extension: p.filename.split('.').pop(),
      size_bytes: p.sizeBytes,
      purpose: p.purpose,
    },
  });
}

// ─── Auto-Wrap via Proxy ─────────────────────────────────────────────────────

export interface WrapOpenAiOptions {
  telemetry: TelemetryClient;
  /** Defaults fuer alle Events ueber diesen Wrapper. */
  defaults?: {
    promptCategory?: AiPromptCategory;
    dataClass?: AiDataClass;
    userId?: string;
    team?: string;
    aiSystemId?: string;
  };
}

/**
 * Wickelt einen openai-SDK-Client in einen Proxy, der jeden
 * chat.completions.create-Call automatisch telemetriert.
 *
 * Unterstuetzt nur den haeufigsten Pfad. Andere Endpoints (embeddings,
 * images, etc.) gehen unmodifiziert durch — koennen via logOpenAi*-
 * Helpers manuell ergaenzt werden.
 */
export function wrapOpenAiClient<T extends object>(client: T, opts: WrapOpenAiOptions): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (prop === 'chat' && original && typeof original === 'object') {
        return wrapChatNamespace(original, opts);
      }
      return original;
    },
  });
}

function wrapChatNamespace(chat: object, opts: WrapOpenAiOptions): object {
  return new Proxy(chat, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (prop === 'completions' && original && typeof original === 'object') {
        return wrapCompletionsNamespace(original, opts);
      }
      return original;
    },
  });
}

function wrapCompletionsNamespace(completions: object, opts: WrapOpenAiOptions): object {
  return new Proxy(completions, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (prop === 'create' && typeof original === 'function') {
        const fn = original.bind(target) as (...args: unknown[]) => Promise<unknown>;
        return async (...args: unknown[]) => {
          const start = Date.now();
          const request = (args[0] ?? {}) as OpenAiChatCompletionPayload['request'];
          const response = (await fn(...args)) as OpenAiChatCompletionPayload['response'];
          await logOpenAiChatCompletion({
            telemetry: opts.telemetry,
            request,
            response,
            latencyMs: Date.now() - start,
            promptCategory: opts.defaults?.promptCategory,
            dataClass: opts.defaults?.dataClass,
            userId: opts.defaults?.userId,
            team: opts.defaults?.team,
            aiSystemId: opts.defaults?.aiSystemId,
          }).catch(() => {
            // Telemetry-Fehler darf den Original-Call NICHT beeinflussen
          });
          return response;
        };
      }
      return original;
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function defaultRiskFor(dataClass?: AiDataClass): AiRiskLevel {
  if (dataClass === 'special_category' || dataClass === 'personal_data') return 'medium';
  if (dataClass === 'confidential') return 'low';
  return 'info';
}

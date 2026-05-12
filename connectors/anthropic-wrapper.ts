/**
 * RealSyncDynamicsAI — Anthropic Telemetry-Connector.
 *
 * Spiegel der OpenAI-Connector-API (siehe openai-wrapper.ts) fuer den
 * Anthropic-SDK. Zwei Use-Patterns: per-Call-Helper + Auto-Wrap-Proxy.
 *
 * Beispiel:
 *    import Anthropic from '@anthropic-ai/sdk';
 *    import { createTelemetryClient } from '@realsyncdynamics-ai/sdk/telemetry';
 *    import { logAnthropicMessage } from '@realsyncdynamics-ai/connectors/anthropic';
 *
 *    const claude = new Anthropic();
 *    const telemetry = createTelemetryClient({ endpoint, tenantKey });
 *    const start = Date.now();
 *    const response = await claude.messages.create({...});
 *    await logAnthropicMessage({
 *      telemetry, request: { model, messages }, response,
 *      latencyMs: Date.now() - start,
 *      promptCategory: 'analysis', dataClass: 'internal',
 *    });
 *
 * Privacy: weder Prompt noch Response-Text verlassen den Prozess.
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

export interface AnthropicMessagePayload {
  telemetry: TelemetryClient;
  request: { model: string; messages?: unknown[]; tools?: unknown[]; system?: string };
  response?: {
    usage?: { input_tokens?: number; output_tokens?: number };
    stop_reason?: string;
  };
  latencyMs?: number;
  promptCategory?: AiPromptCategory;
  dataClass?: AiDataClass;
  riskLevel?: AiRiskLevel;
  userId?: string;
  team?: string;
  aiSystemId?: string;
  metadata?: Record<string, unknown>;
}

export async function logAnthropicMessage(p: AnthropicMessagePayload): Promise<TelemetryResult> {
  const event: AiTelemetryEvent = {
    event_type: 'response_received',
    vendor: 'anthropic',
    model: p.request.model,
    user_id: p.userId,
    team: p.team,
    ai_system_id: p.aiSystemId,
    prompt_category: p.promptCategory ?? 'unknown',
    data_class: p.dataClass ?? 'unknown',
    risk_level: p.riskLevel ?? defaultRiskFor(p.dataClass),
    prompt_tokens: p.response?.usage?.input_tokens,
    response_tokens: p.response?.usage?.output_tokens,
    latency_ms: p.latencyMs,
    metadata: {
      message_count: Array.isArray(p.request.messages) ? p.request.messages.length : undefined,
      tool_count: Array.isArray(p.request.tools) ? p.request.tools.length : undefined,
      has_system_prompt: typeof p.request.system === 'string' && p.request.system.length > 0,
      stop_reason: p.response?.stop_reason,
      ...p.metadata,
    },
  };
  return p.telemetry.trackAiEvent(event);
}

// ─── Auto-Wrap via Proxy ─────────────────────────────────────────────────────

export interface WrapAnthropicOptions {
  telemetry: TelemetryClient;
  defaults?: {
    promptCategory?: AiPromptCategory;
    dataClass?: AiDataClass;
    userId?: string;
    team?: string;
    aiSystemId?: string;
  };
}

/**
 * Wickelt einen anthropic-SDK-Client in einen Proxy, der jeden
 * messages.create-Call automatisch telemetriert.
 */
export function wrapAnthropicClient<T extends object>(client: T, opts: WrapAnthropicOptions): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (prop === 'messages' && original && typeof original === 'object') {
        return wrapMessagesNamespace(original, opts);
      }
      return original;
    },
  });
}

function wrapMessagesNamespace(messages: object, opts: WrapAnthropicOptions): object {
  return new Proxy(messages, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (prop === 'create' && typeof original === 'function') {
        const fn = original.bind(target) as (...args: unknown[]) => Promise<unknown>;
        return async (...args: unknown[]) => {
          const start = Date.now();
          const request = (args[0] ?? {}) as AnthropicMessagePayload['request'];
          const response = (await fn(...args)) as AnthropicMessagePayload['response'];
          await logAnthropicMessage({
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

function defaultRiskFor(dataClass?: AiDataClass): AiRiskLevel {
  if (dataClass === 'special_category' || dataClass === 'personal_data') return 'medium';
  if (dataClass === 'confidential') return 'low';
  return 'info';
}

// Deno mirror of src/core/ai-gateway/edgeClient.ts.
//
// Sibling Edge Functions (governance-agent, classify-document,
// telegram-webhook) call this client to route inference through the
// ai-gateway Edge Function,
// rather than instantiating provider adapters directly. Keeps provider
// selection + EU-routing policy + cost-tracking in a single seam.

import type {
  AiGatewayRequest, AiGatewayResponse, AiStreamChunk, ModelProfile,
} from './types.ts';

export interface EdgeClientConfig {
  supabaseUrl: string;
  /** Projekt-Key für den `apikey`-Header (SUPABASE_ANON_KEY). Wird auch als
   *  Bearer gesendet, wenn weder authToken noch ein Nutzer-JWT gesetzt ist —
   *  das passiert nur noch die Plattform-JWT-Prüfung, NICHT die Gateway-
   *  Autorisierung (seit P0-Härtung: Nutzer-JWT oder internalKey nötig). */
  apiKey: string;
  /** Nutzer-access_token, wenn der Aufrufer im Nutzerkontext läuft
   *  (Authorization: Bearer <JWT> wird durchgereicht). */
  authToken?: string;
  /** Wert von AI_GATEWAY_INTERNAL_KEY → Header `x-internal-key` (Service-Pfad). */
  internalKey?: string;
  /** Kennung des internen Aufrufers → Header `x-internal-caller` (wird geloggt). */
  internalCaller?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Baut die Header für einen ai-gateway-Aufruf. Niemals den service_role-Key
 * als apiKey/authToken übergeben — der Gateway akzeptiert ihn nicht als
 * Service-Pfad (401), und er soll das Edge-Isolat nicht verlassen.
 */
export function gatewayHeaders(config: Pick<EdgeClientConfig, 'apiKey' | 'authToken' | 'internalKey' | 'internalCaller'>): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type':  'application/json',
    'apikey':         config.apiKey,
    'authorization': `Bearer ${config.authToken || config.apiKey}`,
  };
  if (config.internalKey) {
    headers['x-internal-key'] = config.internalKey;
    if (config.internalCaller) headers['x-internal-caller'] = config.internalCaller;
  }
  return headers;
}

export type EdgeOp = 'generate' | 'extract_json' | 'embed' | 'stream';

export interface EdgeRequestBody extends AiGatewayRequest {
  op: EdgeOp;
}

export interface EdgeSuccessEnvelope<T> {
  ok: true;
  provider: AiGatewayResponse<T>['provider'];
  model: string;
  profile: ModelProfile;
  output: T;
  raw_text?: string;
  usage?: AiGatewayResponse<T>['usage'];
  trace_id: string;
  latency_ms: number;
}

export interface EdgeErrorEnvelope {
  ok: false;
  error: { code: string; message: string };
}

export class AiGatewayEdgeError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AiGatewayEdgeError';
  }
}

export class AiGatewayEdgeClient {
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;

  constructor(private readonly config: EdgeClientConfig) {
    // Bind to globalThis to mirror the frontend fix: even in Deno,
    // a stored fetch reference may pick up the wrong `this`. Keep
    // both runtimes consistent.
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
    this.endpoint = `${config.supabaseUrl.replace(/\/$/, '')}/functions/v1/ai-gateway`;
  }

  generate(request: AiGatewayRequest): Promise<AiGatewayResponse<string>> {
    return this.invoke<string>('generate', request);
  }

  extractJson<T>(request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    return this.invoke<T>('extract_json', request);
  }

  embed(request: AiGatewayRequest): Promise<AiGatewayResponse<number[]>> {
    return this.invoke<number[]>('embed', request);
  }

  async *stream(request: AiGatewayRequest): AsyncIterable<AiStreamChunk> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 90_000);
    try {
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: gatewayHeaders(this.config),
        body: JSON.stringify({ op: 'stream', ...request } satisfies EdgeRequestBody),
      });
      if (!res.body) {
        throw new AiGatewayEdgeError(res.status, 'BAD_ENVELOPE', `gateway stream empty (HTTP ${res.status})`);
      }
      if (!res.ok) {
        let code = 'UPSTREAM';
        let message = `gateway HTTP ${res.status}`;
        try {
          const envelope = (await res.json()) as EdgeErrorEnvelope;
          if (envelope && envelope.ok === false) {
            code = envelope.error.code;
            message = envelope.error.message;
          }
        } catch { /* keep */ }
        throw new AiGatewayEdgeError(res.status, code, message);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let parsed: (AiStreamChunk & { ok?: boolean }) | EdgeErrorEnvelope;
          try {
            parsed = JSON.parse(trimmed) as typeof parsed;
          } catch {
            continue;
          }
          if ((parsed as EdgeErrorEnvelope).ok === false) {
            const err = parsed as EdgeErrorEnvelope;
            throw new AiGatewayEdgeError(502, err.error.code, err.error.message);
          }
          yield parsed as AiStreamChunk;
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private async invoke<T>(op: EdgeOp, request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 30_000);

    try {
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: gatewayHeaders(this.config),
        body: JSON.stringify({ op, ...request } satisfies EdgeRequestBody),
      });

      let envelope: EdgeSuccessEnvelope<T> | EdgeErrorEnvelope;
      try {
        envelope = (await res.json()) as EdgeSuccessEnvelope<T> | EdgeErrorEnvelope;
      } catch {
        throw new AiGatewayEdgeError(res.status, 'BAD_ENVELOPE', `gateway returned non-JSON (HTTP ${res.status})`);
      }

      if (envelope.ok === false) {
        throw new AiGatewayEdgeError(res.status, envelope.error.code, envelope.error.message);
      }

      return {
        provider:   envelope.provider,
        model:      envelope.model,
        profile:    envelope.profile,
        output:     envelope.output,
        raw_text:   envelope.raw_text,
        usage:      envelope.usage,
        trace_id:   envelope.trace_id,
        latency_ms: envelope.latency_ms,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

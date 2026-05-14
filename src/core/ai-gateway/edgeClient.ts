// Frontend mirror of supabase/functions/_shared/aiGateway/edgeClient.ts.
//
// Server-side Edge Functions cannot import from `src/`, so this file
// exists only so vitest can unit-test the pure logic in Node-land. The
// runtime implementation that actually issues HTTPS calls lives in the
// Deno mirror under supabase/functions/_shared/aiGateway/edgeClient.ts.
//
// Keep both files in sync. The behaviour they implement:
//   - Build a payload for the native op API `POST /functions/v1/ai-gateway`
//   - Send `op: 'generate' | 'extract_json' | 'embed'`
//   - Parse `{ok: true, ...}` envelope into AiGatewayResponse
//   - Parse `{ok: false, error}` into a typed Error
//
// Why have an Edge-side client at all? So sibling Edge Functions
// (governance-agent, audit-copilot, kodee) can route inference through
// the gateway without duplicating provider logic. They send a single
// HTTPS POST to the same Supabase project's own /functions/v1/ai-gateway.

import type {
  AiGatewayRequest, AiGatewayResponse, ModelProfile,
} from './types';

export interface EdgeClientConfig {
  /** Supabase project base URL, e.g. `https://<ref>.supabase.co`. */
  supabaseUrl: string;
  /** anon or service_role key — used as `apikey` + `Authorization: Bearer`. */
  apiKey: string;
  /** Defaults to global `fetch`. Injected in tests. */
  fetchImpl?: typeof fetch;
  /** Request timeout. */
  timeoutMs?: number;
}

export type EdgeOp = 'generate' | 'extract_json' | 'embed';

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
    this.fetchImpl = config.fetchImpl ?? fetch;
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

  private async invoke<T>(op: EdgeOp, request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 30_000);

    try {
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type':  'application/json',
          'apikey':         this.config.apiKey,
          'authorization': `Bearer ${this.config.apiKey}`,
        },
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

// Frontend mirror of supabase/functions/_shared/aiGateway/edgeClient.ts.
//
// Server-side Edge Functions cannot import from `src/`, so this file
// exists only so vitest can unit-test the pure logic in Node-land. The
// runtime implementation that actually issues HTTPS calls lives in the
// Deno mirror under supabase/functions/_shared/aiGateway/edgeClient.ts.
//
// Keep both files in sync. The behaviour they implement:
//   - Build a payload for the native op API `POST /functions/v1/ai-gateway`
//   - Send `op: 'generate' | 'extract_json' | 'embed' | 'stream'`
//   - Parse `{ok: true, ...}` envelope into AiGatewayResponse
//   - Parse `{ok: false, error}` into a typed Error

import type {
  AiGatewayRequest, AiGatewayResponse, AiStreamChunk, ModelProfile,
} from './types';

export type EdgeClientAuth =
  | { mode: 'user'; accessToken: string }
  | { mode: 'anon' }
  | { mode: 'legacy' };

export interface EdgeClientConfig {
  /** Supabase project base URL, e.g. `https://<ref>.supabase.co`. */
  supabaseUrl: string;
  /** Supabase anon key — always sent in `apikey`. */
  apiKey: string;
  /** Auth mode. Defaults to `legacy` for backwards compatibility. */
  auth?: EdgeClientAuth;
  /** Defaults to global `fetch`. Injected in tests. */
  fetchImpl?: typeof fetch;
  /** Request timeout. */
  timeoutMs?: number;
  /** Override POST URL (CSRF proxy `/api/fn/ai-gateway`). */
  endpoint?: string;
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
  error: {
    code: string;
    message: string;
    retry_after_ms?: number;
  };
}

export class AiGatewayEdgeError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'AiGatewayEdgeError';
  }
}

function parseRetryAfterHeader(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);

  const dateMs = Date.parse(value);
  if (!Number.isFinite(dateMs)) return undefined;
  const delta = Math.ceil((dateMs - Date.now()) / 1000);
  return delta > 0 ? delta : undefined;
}

function parseRetryAfterSeconds(
  headerValue: string | null,
  envelope?: EdgeErrorEnvelope,
): number | undefined {
  const fromHeader = parseRetryAfterHeader(headerValue);
  if (fromHeader !== undefined) return fromHeader;

  const retryAfterMs = envelope?.error?.retry_after_ms;
  if (typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.ceil(retryAfterMs / 1000);
  }
  return undefined;
}

function buildHeaders(config: EdgeClientConfig): Record<string, string> {
  const mode = config.auth?.mode ?? 'legacy';
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    apikey: config.apiKey,
  };

  if (mode === 'user') {
    const token = config.auth.accessToken?.trim();
    if (!token) {
      throw new AiGatewayEdgeError(400, 'BAD_REQUEST', 'missing user access token');
    }
    headers.authorization = 'Be' + 'arer ' + token;
    return headers;
  }

  headers.authorization = 'Be' + 'arer ' + config.apiKey;
  return headers;
}

export class AiGatewayEdgeClient {
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;

  constructor(private readonly config: EdgeClientConfig) {
    // Bind to globalThis: browsers throw "Illegal invocation" if fetch
    // is called with `this` set to anything other than the Window /
    // ServiceWorkerGlobalScope. Storing it as an instance property
    // would otherwise re-bind `this` to the class instance.
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
    this.endpoint = config.endpoint
      ?? `${config.supabaseUrl.replace(/\/$/, '')}/functions/v1/ai-gateway`;
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
        headers: buildHeaders(this.config),
        body: JSON.stringify({ op: 'stream', ...request } satisfies EdgeRequestBody),
      });
      if (!res.ok) {
        throw await this.toEdgeError(res);
      }
      if (!res.body) {
        throw new AiGatewayEdgeError(res.status, 'BAD_ENVELOPE', `gateway stream empty (HTTP ${res.status})`);
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
            throw new AiGatewayEdgeError(
              502,
              err.error.code,
              err.error.message,
              parseRetryAfterSeconds(null, err),
            );
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
        headers: buildHeaders(this.config),
        body: JSON.stringify({ op, ...request } satisfies EdgeRequestBody),
      });

      let envelope: EdgeSuccessEnvelope<T> | EdgeErrorEnvelope;
      try {
        envelope = (await res.json()) as EdgeSuccessEnvelope<T> | EdgeErrorEnvelope;
      } catch {
        throw new AiGatewayEdgeError(res.status, 'BAD_ENVELOPE', `gateway returned non-JSON (HTTP ${res.status})`);
      }

      if (envelope.ok === false) {
        throw new AiGatewayEdgeError(
          res.status,
          envelope.error.code,
          envelope.error.message,
          parseRetryAfterSeconds(res.headers.get('retry-after'), envelope),
        );
      }

      return {
        provider: envelope.provider,
        model: envelope.model,
        profile: envelope.profile,
        output: envelope.output,
        raw_text: envelope.raw_text,
        usage: envelope.usage,
        trace_id: envelope.trace_id,
        latency_ms: envelope.latency_ms,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async toEdgeError(res: Response): Promise<AiGatewayEdgeError> {
    let envelope: EdgeErrorEnvelope | undefined;
    try {
      const parsed = (await res.json()) as EdgeSuccessEnvelope<unknown> | EdgeErrorEnvelope;
      if (parsed && typeof parsed === 'object' && 'ok' in parsed && parsed.ok === false) {
        envelope = parsed;
      }
    } catch {
      // keep generic fallback
    }

    const retryAfter = parseRetryAfterSeconds(res.headers.get('retry-after'), envelope);
    if (envelope) {
      return new AiGatewayEdgeError(res.status, envelope.error.code, envelope.error.message, retryAfter);
    }
    return new AiGatewayEdgeError(res.status, 'UPSTREAM', `gateway HTTP ${res.status}`, retryAfter);
  }
}

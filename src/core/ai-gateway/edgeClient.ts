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
  AiGatewayRequest, AiGatewayResponse, AiStreamChunk, ModelProfile,
} from './types';

/**
 * Wie sich der Client beim Gateway ausweist (Vertrag RSD Backend, vorläufig).
 *
 * - `user`: `Authorization: Bearer <session.access_token>` plus
 *   `apikey: <anon>`. `tenant_id` ist Pflicht im Body. Fehlt die Sitzung,
 *   wirft der Client `UNAUTHORIZED` und sendet nichts — kein stiller
 *   Rückfall auf den Anon-Key.
 * - `anon`: ausdrücklich anonymer Aufruf (später z. B. Audit-Copilot mit
 *   `mode: 'audit_anon'`). Sendet nur den Anon-Key. Muss vom Aufrufer
 *   bewusst gewählt werden.
 *
 * Ohne `auth` gilt das bisherige Verhalten (Anon-Key als `apikey` und
 * Bearer). Das bleibt nur für Alt-Aufrufer bestehen, die noch nicht
 * umgestellt sind (siehe PR-Beschreibung) und ist veraltet.
 */
export type EdgeClientAuth =
  | { mode: 'user'; getAccessToken: () => Promise<string | null | undefined> }
  | { mode: 'anon' };

export interface EdgeClientConfig {
  /** Supabase project base URL, e.g. `https://<ref>.supabase.co`. */
  supabaseUrl: string;
  /**
   * Anon-Key — immer als `apikey`. Ohne `auth` (Altverhalten) zusätzlich als
   * `Authorization: Bearer`; Edge-seitig auch service_role.
   */
  apiKey: string;
  /** Ausweis gegenüber dem Gateway. Siehe `EdgeClientAuth`. */
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
  error: { code: string; message: string };
}

export class AiGatewayEdgeError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** Sekunden bis zum nächsten Versuch (aus `Retry-After`), falls gesendet. */
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'AiGatewayEdgeError';
  }
}

/**
 * `Retry-After` als Sekunden: ganze Zahl oder HTTP-Datum. Unlesbare Werte
 * ergeben `undefined` — wir erfinden keine Wartezeit.
 */
export function parseRetryAfter(value: string | null | undefined, now: number = Date.now()): number | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

/** Fehlercode, wenn der Server keinen JSON-Umschlag liefert. */
const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  429: 'RATE_LIMITED',
};

function retryAfterOf(res: Response): number | undefined {
  return parseRetryAfter(res.headers?.get?.('retry-after') ?? null);
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
      const headers = await this.buildHeaders(request);
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({ op: 'stream', ...request } satisfies EdgeRequestBody),
      });
      if (!res.ok) {
        let code = CODE_BY_STATUS[res.status] ?? 'UPSTREAM';
        let message = `gateway HTTP ${res.status}`;
        try {
          const envelope = (await res.json()) as EdgeErrorEnvelope;
          if (envelope && envelope.ok === false) {
            code = envelope.error.code;
            message = envelope.error.message;
          }
        } catch {
          /* keep */
        }
        throw new AiGatewayEdgeError(res.status, code, message, retryAfterOf(res));
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
            throw new AiGatewayEdgeError(502, err.error.code, err.error.message);
          }
          yield parsed as AiStreamChunk;
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Header je nach Ausweis. Im Nutzer-Modus wird vor dem Senden geprüft:
   * ohne Sitzung `UNAUTHORIZED`, ohne `tenant_id` `BAD_REQUEST` — in beiden
   * Fällen geht keine Anfrage raus.
   */
  private async buildHeaders(request: AiGatewayRequest): Promise<Record<string, string>> {
    const auth = this.config.auth;
    const base: Record<string, string> = {
      'content-type': 'application/json',
      'apikey':       this.config.apiKey,
    };
    if (!auth) {
      // Altverhalten (veraltet): Anon-Key auch als Bearer.
      return { ...base, authorization: `Bearer ${this.config.apiKey}` };
    }
    if (auth.mode === 'anon') {
      return base;
    }
    const token = await auth.getAccessToken();
    if (!token) {
      throw new AiGatewayEdgeError(401, 'UNAUTHORIZED', 'Keine aktive Sitzung — bitte erneut anmelden.');
    }
    if (typeof request.tenant_id !== 'string' || request.tenant_id.trim() === '') {
      throw new AiGatewayEdgeError(400, 'BAD_REQUEST', 'tenant_id fehlt — kein aktiver Workspace.');
    }
    return { ...base, authorization: `Bearer ${token}` };
  }

  private async invoke<T>(op: EdgeOp, request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 30_000);

    try {
      const headers = await this.buildHeaders(request);
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({ op, ...request } satisfies EdgeRequestBody),
      });

      let envelope: EdgeSuccessEnvelope<T> | EdgeErrorEnvelope;
      try {
        envelope = (await res.json()) as EdgeSuccessEnvelope<T> | EdgeErrorEnvelope;
      } catch {
        const code = CODE_BY_STATUS[res.status] ?? 'BAD_ENVELOPE';
        throw new AiGatewayEdgeError(res.status, code, `gateway returned non-JSON (HTTP ${res.status})`, retryAfterOf(res));
      }

      if (envelope.ok === false) {
        const code = envelope.error?.code ?? CODE_BY_STATUS[res.status] ?? 'UPSTREAM';
        const message = envelope.error?.message ?? `gateway HTTP ${res.status}`;
        throw new AiGatewayEdgeError(res.status, code, message, retryAfterOf(res));
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

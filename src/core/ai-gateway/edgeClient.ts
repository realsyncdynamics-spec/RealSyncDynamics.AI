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
 * Wie sich der Client beim Gateway ausweist. Verbindlicher Vertrag:
 * RSD Backend, Draft-PR #1591 (Abschnitt „Frontend-Vertrag“).
 *
 * - `user`: `Authorization: Bearer <session.access_token>` plus
 *   `apikey: <anon>`. `tenant_id` ist Pflicht im Body. Fehlt die Sitzung,
 *   wirft der Client `UNAUTHORIZED` und sendet nichts — kein stiller
 *   Rückfall auf den Anon-Key. Fehlt `tenant_id`, wirft er
 *   `TENANT_REQUIRED` und sendet ebenfalls nichts.
 * - `anon`: ausdrücklich anonymer Aufruf (öffentliches /audit ohne Login).
 *   Sendet `apikey` UND `Authorization: Bearer <Legacy-Anon-Key>`, weil
 *   `verify_jwt = true` als Plattform-Vorfilter bleibt. Ein reiner
 *   `sb_publishable_…`-Key besteht den Vorfilter nicht; der Client bricht
 *   dann mit `AI_GATEWAY_NOT_CONFIGURED` ab, statt eine sichere 401 zu
 *   provozieren. Muss vom Aufrufer bewusst gewählt werden.
 *
 * Ohne `auth`/`authToken` gilt das bisherige Verhalten (Anon-Key als
 * `apikey` und Bearer). Das ist veraltet und bleibt nur für Aufrufer, die
 * dieser PR bewusst nicht anfasst (siehe PR-Beschreibung #1590).
 */
export type EdgeClientAuth =
  | { mode: 'user'; getAccessToken: () => Promise<string | null | undefined> }
  | { mode: 'anon' };

/** Liefert das aktuelle Nutzer-JWT (z. B. aus `supabase.auth.getSession()`). */
export type SessionTokenProvider = () => Promise<string | null | undefined>;

export interface EdgeClientConfig {
  /** Supabase project base URL, e.g. `https://<ref>.supabase.co`. */
  supabaseUrl: string;
  /**
   * Anon-Key — immer als `apikey`. Im Anon-Modus und ohne `auth`
   * (Altverhalten) zusätzlich als `Authorization: Bearer`.
   */
  apiKey: string;
  /** Ausweis gegenüber dem Gateway. Siehe `EdgeClientAuth`. Hat Vorrang vor `authToken`. */
  auth?: EdgeClientAuth;
  /**
   * Kurzform für den Nutzer-Modus, analog zum Deno-Zwilling
   * (`_shared/aiGateway/edgeClient.ts`, #1591): festes Nutzer-JWT oder ein
   * Provider, der pro Anfrage das aktuelle Sitzungs-Token liefert.
   * Gleichbedeutend mit `auth: { mode: 'user', getAccessToken }`.
   */
  authToken?: string | SessionTokenProvider;
  /** Defaults to global `fetch`. Injected in tests. */
  fetchImpl?: typeof fetch;
  /** Request timeout. */
  timeoutMs?: number;
  /** Override POST URL (CSRF proxy `/api/fn/ai-gateway`). */
  endpoint?: string;
}

export type EdgeOp = 'generate' | 'extract_json' | 'embed' | 'stream';

/**
 * Anfrage plus Zusatzfelder. Der Body ist `{ op, ...request }`: jedes
 * weitere Feld am Request-Objekt landet unverändert im JSON (z. B. später
 * `turnstile_token` im anonymen Pfad, #1591). Der Client prüft oder
 * verändert Zusatzfelder nicht; Turnstile selbst ist hier nicht eingebaut.
 */
export interface EdgeBodyExtras {
  /** Cloudflare-Turnstile-Token für den späteren `audit_anon`-Pfad (nur durchgereicht). */
  turnstile_token?: string;
}

export type EdgeRequest = AiGatewayRequest & EdgeBodyExtras;

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
  /** `scope` und `retry_after_ms` sendet der Gateway bei 429 (#1591). */
  error: { code: string; message: string; scope?: string; retry_after_ms?: number };
}

/**
 * Fehlercodes laut Vertrag #1591. `TENANT_REQUIRED` und
 * `AI_GATEWAY_NOT_CONFIGURED` entstehen nur clientseitig (keine Anfrage
 * gesendet); `UPSTREAM`/`BAD_ENVELOPE` stehen für Antworten ohne lesbaren
 * Fehlerumschlag.
 */
export type AiGatewayErrorCode =
  | 'BAD_REQUEST'               // 400 – auch unzulässiges model_profile, input zu lang, system_prompt zu lang
  | 'UNAUTHORIZED'              // 401 – kein/ungültiger Bearer, Anon-Key im Nutzerpfad
  | 'FORBIDDEN'                 // 403 – kein Mitglied des tenant_id
  | 'ENTITLEMENT'               // 403 – Plan-Sperre (nur Builder, siteos.builder)
  | 'QUOTA_EXCEEDED'            // 403 – Kontingent ausgeschöpft
  | 'POLICY_BLOCKED'            // 403 – PDP enforce
  | 'APPROVAL_REQUIRED'         // 403 – PDP enforce
  | 'NOT_FOUND'                 // 404
  | 'RATE_LIMITED'              // 429 – Retry-After + error.scope/retry_after_ms
  | 'INTERNAL'                  // 500
  | 'NO_PROVIDER'               // 503
  | 'LM_STUDIO_NOT_CONFIGURED'  // 503
  | 'INFERENCE_ERROR'           // 5xx – Inferenzfehler
  | 'TURNSTILE_MISSING'         // 400 – späterer Anon-Pfad: turnstile_token fehlt
  | 'TURNSTILE_FAILED'          // 403 – späterer Anon-Pfad: Turnstile-Prüfung fehlgeschlagen
  | 'TURNSTILE_UNCONFIGURED'    // 503 – späterer Anon-Pfad: Turnstile serverseitig nicht eingerichtet
  | 'TENANT_REQUIRED'           // clientseitig: kein aktiver Workspace
  | 'AI_GATEWAY_NOT_CONFIGURED' // clientseitig: Zugangsdaten fehlen/ungeeignet
  | 'UPSTREAM'
  | 'BAD_ENVELOPE';

/** Grobe Einordnung für die Oberfläche. */
export type AiGatewayErrorCategory =
  | 'unauthorized' | 'forbidden' | 'tenant_required' | 'entitlement' | 'quota'
  | 'policy' | 'rate_limited' | 'bad_request' | 'not_found' | 'unavailable'
  | 'internal' | 'unknown';

/**
 * Ordnet Code (bevorzugt) bzw. HTTP-Status einer Kategorie zu. Unbekannte
 * Codes fallen auf den Status zurück, damit neue Servercodes nicht als
 * Erfolg oder falsche Kategorie erscheinen.
 */
export function classifyGatewayError(code: string | undefined, status?: number): AiGatewayErrorCategory {
  switch (code) {
    case 'UNAUTHORIZED': return 'unauthorized';
    case 'FORBIDDEN': return 'forbidden';
    case 'TENANT_REQUIRED': return 'tenant_required';
    case 'ENTITLEMENT': return 'entitlement';
    case 'QUOTA_EXCEEDED': return 'quota';
    case 'POLICY_BLOCKED':
    case 'APPROVAL_REQUIRED': return 'policy';
    case 'RATE_LIMITED': return 'rate_limited';
    case 'BAD_REQUEST':
    case 'TURNSTILE_MISSING': return 'bad_request';
    case 'TURNSTILE_FAILED': return 'forbidden';
    case 'NOT_FOUND': return 'not_found';
    case 'NO_PROVIDER':
    case 'LM_STUDIO_NOT_CONFIGURED':
    case 'TURNSTILE_UNCONFIGURED':
    case 'AI_GATEWAY_NOT_CONFIGURED': return 'unavailable';
    case 'INTERNAL':
    case 'INFERENCE_ERROR': return 'internal';
    default: break;
  }
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate_limited';
  if (status === 400) return 'bad_request';
  if (status === 404) return 'not_found';
  if (status === 503) return 'unavailable';
  if (status !== undefined && status >= 500) return 'internal';
  return 'unknown';
}

export interface AiGatewayEdgeErrorDetails {
  /** 429: Geltungsbereich des Limits (z. B. `user:<id>`, `tenant:<id>`). */
  scope?: string;
  /** 429: Wartezeit in Millisekunden aus dem Body, falls gesendet. */
  retryAfterMs?: number;
}

export class AiGatewayEdgeError extends Error {
  public readonly scope?: string;
  public readonly retryAfterMs?: number;

  constructor(
    public readonly status: number,
    public readonly code: AiGatewayErrorCode | (string & {}),
    message: string,
    /**
     * Sekunden bis zum nächsten Versuch. Bevorzugt aus `error.retry_after_ms`
     * (aufgerundet), sonst aus dem `Retry-After`-Header.
     */
    public readonly retryAfter?: number,
    details?: AiGatewayEdgeErrorDetails,
  ) {
    super(message);
    this.name = 'AiGatewayEdgeError';
    if (details?.scope !== undefined) this.scope = details.scope;
    if (details?.retryAfterMs !== undefined) this.retryAfterMs = details.retryAfterMs;
  }

  get category(): AiGatewayErrorCategory {
    return classifyGatewayError(this.code, this.status);
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
const CODE_BY_STATUS: Record<number, AiGatewayErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
  // 5xx ohne Umschlag bleibt BAD_ENVELOPE/UPSTREAM (meist Plattform-HTML);
  // `classifyGatewayError` ordnet das über den Status als `internal` ein.
};

/** Loser Fehlerumschlag: `error.scope`/`error.retry_after_ms` nur bei 429. */
interface WireError {
  code?: unknown;
  message?: unknown;
  scope?: unknown;
  retry_after_ms?: unknown;
}

/**
 * Baut den typisierten Fehler aus Status, Header und (optional) Umschlag.
 * `retry_after_ms` aus dem Body hat Vorrang vor dem `Retry-After`-Header.
 */
function errorFrom(res: Response, wire: WireError | undefined, fallbackCode: string, fallbackMessage: string): AiGatewayEdgeError {
  const code = typeof wire?.code === 'string' && wire.code ? wire.code : fallbackCode;
  const message = typeof wire?.message === 'string' && wire.message ? wire.message : fallbackMessage;
  const retryAfterMs = typeof wire?.retry_after_ms === 'number' && Number.isFinite(wire.retry_after_ms) && wire.retry_after_ms >= 0
    ? wire.retry_after_ms
    : undefined;
  const scope = typeof wire?.scope === 'string' && wire.scope ? wire.scope : undefined;
  const retryAfter = retryAfterMs !== undefined
    ? Math.ceil(retryAfterMs / 1000)
    : parseRetryAfter(res.headers?.get?.('retry-after') ?? null);
  return new AiGatewayEdgeError(res.status, code, message, retryAfter, { scope, retryAfterMs });
}

/** Legacy-Anon-Key ist ein JWT (`eyJ….….…`); `sb_publishable_…` nicht. */
function looksLikeJwt(key: string): boolean {
  return /^eyJ[\w-]*\.[\w-]+\.[\w-]+$/.test(key.trim());
}

export class AiGatewayEdgeClient {
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;
  private readonly auth: EdgeClientAuth | undefined;

  constructor(private readonly config: EdgeClientConfig) {
    // Bind to globalThis: browsers throw "Illegal invocation" if fetch
    // is called with `this` set to anything other than the Window /
    // ServiceWorkerGlobalScope. Storing it as an instance property
    // would otherwise re-bind `this` to the class instance.
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
    this.endpoint = config.endpoint
      ?? `${config.supabaseUrl.replace(/\/$/, '')}/functions/v1/ai-gateway`;
    const token = config.authToken;
    this.auth = config.auth
      ?? (token === undefined
        ? undefined
        : { mode: 'user', getAccessToken: typeof token === 'function' ? token : async () => token });
  }

  generate(request: EdgeRequest): Promise<AiGatewayResponse<string>> {
    return this.invoke<string>('generate', request);
  }

  extractJson<T>(request: EdgeRequest): Promise<AiGatewayResponse<T>> {
    return this.invoke<T>('extract_json', request);
  }

  embed(request: EdgeRequest): Promise<AiGatewayResponse<number[]>> {
    return this.invoke<number[]>('embed', request);
  }

  async *stream(request: EdgeRequest): AsyncIterable<AiStreamChunk> {
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
        let wire: WireError | undefined;
        try {
          const envelope = (await res.json()) as EdgeErrorEnvelope;
          if (envelope && envelope.ok === false) wire = envelope.error;
        } catch {
          /* kein JSON — Code aus dem Status */
        }
        throw errorFrom(res, wire, CODE_BY_STATUS[res.status] ?? 'UPSTREAM', `gateway HTTP ${res.status}`);
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
   * Header je nach Ausweis. Vor dem Senden wird geprüft — schlägt eine
   * Prüfung fehl, geht keine Anfrage raus:
   * - Nutzer-Modus: ohne Sitzung `UNAUTHORIZED` (kein Rückfall auf anon),
   *   ohne `tenant_id` `TENANT_REQUIRED`.
   * - Anon-Modus: ohne JWT-förmigen Legacy-Anon-Key `AI_GATEWAY_NOT_CONFIGURED`.
   */
  private async buildHeaders(request: EdgeRequest): Promise<Record<string, string>> {
    const auth = this.auth;
    const base: Record<string, string> = {
      'content-type': 'application/json',
      'apikey':       this.config.apiKey,
    };
    if (!auth) {
      // Altverhalten (veraltet): Anon-Key auch als Bearer.
      return { ...base, authorization: `Bearer ${this.config.apiKey}` };
    }
    if (auth.mode === 'anon') {
      if (!looksLikeJwt(this.config.apiKey)) {
        throw new AiGatewayEdgeError(503, 'AI_GATEWAY_NOT_CONFIGURED',
          'Anonymer Aufruf braucht den Legacy-Anon-Key (JWT); ein sb_publishable_-Key besteht verify_jwt nicht.');
      }
      return { ...base, authorization: `Bearer ${this.config.apiKey}` };
    }
    const token = await auth.getAccessToken();
    if (!token) {
      throw new AiGatewayEdgeError(401, 'UNAUTHORIZED', 'Keine aktive Sitzung — bitte erneut anmelden.');
    }
    if (typeof request.tenant_id !== 'string' || request.tenant_id.trim() === '') {
      throw new AiGatewayEdgeError(400, 'TENANT_REQUIRED', 'tenant_id fehlt — kein aktiver Workspace.');
    }
    return { ...base, authorization: `Bearer ${token}` };
  }

  private async invoke<T>(op: EdgeOp, request: EdgeRequest): Promise<AiGatewayResponse<T>> {
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
        throw errorFrom(res, undefined, CODE_BY_STATUS[res.status] ?? 'BAD_ENVELOPE', `gateway returned non-JSON (HTTP ${res.status})`);
      }

      if (envelope.ok === false) {
        throw errorFrom(res, envelope.error, CODE_BY_STATUS[res.status] ?? 'UPSTREAM', `gateway HTTP ${res.status}`);
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

// Request-Handler des ai-gateway. index.ts verdrahtet die echten
// Abhängigkeiten (Deno.env, requireAuthAndTenant, gateFeature, Provider-
// Gateway, PDP); Tests injizieren Fakes. Keine Deno-/jsr-Importe hier, damit
// der Handler vitest-importierbar bleibt (test/edge/ai-gateway-auth.test.ts).
//
// Sicherheitsrelevante Reihenfolge (P0-Härtung, siehe PR-Text):
//   1. Body parsen (400) — keine Provider-/DB-Arbeit
//   2. Principal bestimmen:
//        x-internal-key vorhanden → Service-Pfad (fail-closed, konstante Zeit)
//        sonst                    → requireAuthAndTenant (Nutzer-JWT + Mitglied)
//      Anon-Key / service_role-Bearer / kein Header → 401, fremder Tenant → 403
//   3. Builder: Entitlement siteos.builder (nur feature app_builder_code)
//   4. Politik: Profil-Allowlist, max_tokens-Clamp, system_prompt-Regeln
//   5. Rate-Limit pro Principal (ohne feature) + optional Feature-Bucket
//   6. PDP (PEP), dann Provider
//
// Sonderpfad `mode: 'audit_anon'` (öffentlicher Audit-Copilot, ohne Login):
//   fester Zweck/Prompt/Profil/Token-Limit, IP-Hash-Rate-Limit ohne Feature,
//   anon_chat_runs-Protokoll fail-closed, nur EU-lokaler Provider.
//
// Cloud-Kette (Anthropic/OpenAI): in KEINEM Pfad (Entscheidung 26.09.).
// index.ts baut den Gateway mit allowCloudFallback=false; `cloud-fallback`
// wird im Nutzer- und im Service-Pfad mit 400 abgelehnt.
//   Siehe _shared/aiGateway/anonAuditCopilot.ts.

import type { AiGatewayRequest, AiStreamChunk } from '../_shared/aiGateway/types.ts';
import {
  routeOf,
  modelsResponse,
  parseChatRequest,
  formatChatResponse,
  mapInferenceError,
  type OpenAIChatRequest,
} from '../_shared/aiGateway/openaiCompat.ts';
import { isTransportLevelFailure } from '../_shared/aiGateway/router.ts';
import {
  decideRateLimit,
  clientIp,
  FEATURE_LIMITS,
  type WindowState,
} from '../_shared/aiGateway/rateLimit.ts';
import {
  applyServicePolicy,
  applyUserPolicy,
  isRejection,
  principalBuckets,
  resolveServiceCaller,
  BUILDER_FEATURE,
  type InternalCaller,
  type RatePrincipal,
  type Rejection,
} from '../_shared/aiGateway/access.ts';
import {
  ANON_AUDIT_OP,
  ANON_FEATURE,
  ANON_LIMITS,
  anonRateKey,
  buildAnonAuditRequest,
  isAnonAuditBody,
  parseAnonAuditBody,
  type AnonAuditLog,
} from '../_shared/aiGateway/anonAuditCopilot.ts';
import { sha256Hex } from '../_shared/hash.ts';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

export const corsHeaders = buildCorsHeaders('GET, POST, OPTIONS');

const ALLOWED_OPS = new Set(['health', 'generate', 'extract_json', 'embed', 'stream']);

// ── Abhängigkeiten ──────────────────────────────────────────────────

/** Strukturelle Teilmenge des Auth-Ergebnisses aus _shared/auth.ts. */
export interface VerifiedAuth {
  user: { id: string };
  tenantId: string;
  // deno-lint-ignore no-explicit-any
  admin: any;
}

export type RequireAuthAndTenant = (
  req: Request,
  clientTenantId: string | null | undefined,
  allowedRoles?: string[],
) => Promise<VerifiedAuth | Response>;

export interface GatewayLike {
  health(): Promise<{ ok: boolean } & Record<string, unknown>>;
  generate(req: AiGatewayRequest): Promise<Record<string, unknown> & { output: unknown }>;
  extractJson(req: AiGatewayRequest): Promise<Record<string, unknown> & { output: unknown }>;
  embed(req: AiGatewayRequest): Promise<Record<string, unknown> & { output: unknown }>;
  generateStream(req: AiGatewayRequest): AsyncIterable<AiStreamChunk>;
}

export interface PdpVerdict {
  decision: string;
  reasons: Array<{ text_de: string }>;
}

export interface GatewayHandlerDeps {
  env: (name: string) => string | undefined;
  requireAuthAndTenant: RequireAuthAndTenant;
  /** Entitlement-Gate für den Builder. Response = abgelehnt, null = ok. */
  gateBuilder: (admin: unknown, tenantId: string) => Promise<Response | null>;
  /**
   * Baut den Gateway — in index.ts IMMER mit allowCloudFallback=false (alle
   * Pfade, auch Service): ohne Anthropic/OpenAI-Kette. Ein lokaler
   * Timeout/5xx endet als Fehler (503) statt still bei einem US-Anbieter.
   */
  buildGateway: () => Promise<GatewayLike | Response>;
  pdpCheck: (feature: string, modelProfile: string) => Promise<Response | PdpVerdict | null>;
  /** anon_chat_runs-Protokoll (reserve fail-closed). null → anon-Pfad antwortet 503 LOG_UNAVAILABLE. */
  anonAuditLog: () => Promise<AnonAuditLog | null>;
  now?: () => number;
  log?: (line: Record<string, unknown>) => void;
  newId?: () => string;
  /** Rate-Limit-Speicher; Default: modulweite Maps (pro Isolate). */
  minuteWindows?: Map<string, WindowState>;
  hourWindows?: Map<string, WindowState>;
}

type Principal =
  | { kind: 'user'; userId: string; tenantId: string; builderEntitled: boolean }
  | { kind: 'service'; caller: InternalCaller; tenantId: string | null };

// ── Handler-Fabrik ──────────────────────────────────────────────────

/**
 * Fehler-Mapping fail-closed: ohne Cloud-Kette ist ein Transportfehler des
 * lokalen Providers (Timeout, Abbruch, Verbindungsfehler, lokaler 5xx, kein
 * Modell geladen) kein „Upstream"-Problem, sondern „kein Provider verfügbar"
 * → 503 LOCAL_PROVIDER_UNREACHABLE. Sonst unverändert mapInferenceError.
 */
function mapGatewayError(error: unknown): { status: number; code: string; message: string } {
  if (isTransportLevelFailure(error)) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 503, code: 'LOCAL_PROVIDER_UNREACHABLE', message };
  }
  return mapInferenceError(error);
}

export function createAiGatewayHandler(deps: GatewayHandlerDeps): (req: Request) => Promise<Response> {
  const minuteWindows = deps.minuteWindows ?? new Map<string, WindowState>();
  const hourWindows = deps.hourWindows ?? new Map<string, WindowState>();
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? ((line: Record<string, unknown>) => console.log(JSON.stringify(line)));
  const newId = deps.newId ?? (() => crypto.randomUUID());

  function reject(r: Rejection): Response {
    return jsonError(r.status, r.code, r.message, corsHeaders);
  }

  // ── Principal ──────────────────────────────────────────────────────

  async function resolvePrincipal(
    req: Request,
    tenantClaim: unknown,
    feature: string,
  ): Promise<Principal | Response> {
    const service = await resolveServiceCaller(req.headers, deps.env);
    if (service.kind === 'reject') return reject(service.rejection);
    if (service.kind === 'service') {
      return {
        kind: 'service',
        caller: service.caller,
        tenantId: typeof tenantClaim === 'string' && tenantClaim ? tenantClaim : null,
      };
    }

    // Nutzerpfad: jedes Mitglied des Tenants (keine Rollenbeschränkung) —
    // die Features sind lesende Assistenz für normale Workspace-Nutzer.
    const auth = await deps.requireAuthAndTenant(
      req,
      typeof tenantClaim === 'string' ? tenantClaim : null,
    );
    if (auth instanceof Response) return auth;

    let builderEntitled = false;
    if (feature === BUILDER_FEATURE) {
      const gate = await deps.gateBuilder(auth.admin, auth.tenantId);
      if (gate) return gate;
      builderEntitled = true;
    }
    return { kind: 'user', userId: auth.user.id, tenantId: auth.tenantId, builderEntitled };
  }

  function applyPolicy(request: AiGatewayRequest, p: Principal): AiGatewayRequest | Rejection {
    if (p.kind === 'service') return applyServicePolicy(request);
    return applyUserPolicy(request, { tenantId: p.tenantId, userId: p.userId }, { builderEntitled: p.builderEntitled });
  }


  // ── Rate-Limit ─────────────────────────────────────────────────────

  async function enforceRateLimit(req: Request, p: Principal, feature: string): Promise<Response | null> {
    let principal: RatePrincipal;
    if (p.kind === 'user') {
      principal = { kind: 'user', userId: p.userId, tenantId: p.tenantId };
    } else if (p.caller !== 'unknown' || p.tenantId) {
      principal = { kind: 'service', caller: p.caller, tenantId: p.tenantId };
    } else {
      // Fallback ohne Identität (Service-Key, aber weder bekannte Kennung
      // noch Tenant): IP-Hash mit strengem Limit.
      const salt = deps.env('AI_GATEWAY_IP_HASH_SALT') ?? 'ai-gateway-default-salt';
      principal = { kind: 'ip', ipHash: await sha256Hex(clientIp(req.headers) + ':' + salt) };
    }
    const buckets = principalBuckets(principal);
    // Strengere Feature-Limits (z. B. remediation_plan 3/min) als ZUSÄTZLICHER
    // Bucket pro Principal — der Principal-Bucket deckelt die Summe.
    if (FEATURE_LIMITS[feature]) {
      buckets.push({ key: `${buckets[0].key}:f:${feature}`, limits: FEATURE_LIMITS[feature] });
    }
    const t = now();
    for (const b of buckets) {
      const decision = decideRateLimit({
        key: b.key,
        feature,
        now: t,
        minuteWindows,
        hourWindows,
        limits: b.limits,
      });
      if (!decision.ok) return rateLimited(decision.scope, decision.retryAfterMs);
    }
    return null;
  }

  function logAccess(p: Principal, route: string, request: AiGatewayRequest): void {
    log({
      scope: 'ai-gateway-auth',
      route,
      path: p.kind,
      ...(p.kind === 'service' ? { internal_caller: p.caller } : { user_id: p.userId }),
      tenant_id: p.tenantId,
      feature: request.feature,
      model_profile: request.model_profile,
      max_tokens: request.max_tokens ?? null,
    });
  }

  // ── Anonymer Audit-Copilot (mode: 'audit_anon') ───────────────────

  function rateLimited(scope: string, retryAfterMs: number): Response {
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded (${scope}). Retry after ${retryAfterSec}s.`,
          scope,
          retry_after_ms: retryAfterMs,
        },
      }),
      { status: 429, headers: { ...corsHeaders, 'content-type': 'application/json', 'retry-after': String(retryAfterSec) } },
    );
  }

  function logUnavailable(requestId: string, stage: string, e: unknown): Response {
    log({ scope: 'ai-gateway-anon', event: 'log_unavailable', stage, request_id: requestId, error: String((e as Error)?.message ?? e).slice(0, 200) });
    return jsonError(503, 'LOG_UNAVAILABLE', 'Anfrage abgelehnt: Protokollierung nicht verfügbar.', corsHeaders);
  }

  async function handleAnonAudit(req: Request, body: Record<string, unknown>): Promise<Response> {
    const parsed = parseAnonAuditBody(body);
    if (isRejection(parsed)) return reject(parsed);

    // Gleiche Hash-Form wie governance-agent (anon_chat_runs.ip_hash =
    // sha256(ip)), damit Zeilen beider Pfade pro IP zusammenpassen. Die IP
    // selbst wird nirgends gespeichert oder geloggt.
    const ipHash = await sha256Hex(clientIp(req.headers));
    const ua = req.headers.get('user-agent') ?? '';

    // 1. Rate-Limit VOR jedem DB-Write (Flut abgelehnter Anfragen schreibt nichts).
    const rl = decideRateLimit({
      key: anonRateKey(ipHash),
      feature: ANON_FEATURE,
      now: now(),
      minuteWindows,
      hourWindows,
      limits: ANON_LIMITS,
    });
    if (!rl.ok) {
      log({ scope: 'ai-gateway-anon', event: 'rate_limited', scope_window: rl.scope });
      return rateLimited(rl.scope, rl.retryAfterMs);
    }

    // 2. Protokoll reservieren — fail-closed: ohne Zeile kein Provider-Aufruf.
    const requestId = newId();
    const startedAt = now();
    let auditLog: AnonAuditLog | null = null;
    try {
      auditLog = await deps.anonAuditLog();
    } catch (e) {
      return logUnavailable(requestId, 'client', e);
    }
    if (!auditLog) return logUnavailable(requestId, 'not_configured', 'anon audit log not configured');
    const al: AnonAuditLog = auditLog;
    try {
      await al.reserve({
        request_id: requestId,
        op: ANON_AUDIT_OP,
        ip_hash: ipHash,
        user_agent_hash: ua ? await sha256Hex(ua) : undefined,
        correlation_id: parsed.auditId ?? undefined,
        payload_keys: Object.keys(body).sort(),
      });
    } catch (e) {
      return logUnavailable(requestId, 'reserve', e);
    }

    // Abschluss wie im governance-agent (completeAnonAudit): Fehler werden
    // geloggt, blockieren aber nicht — die reservierte Zeile existiert, ein
    // Rest-'pending' ist selbst ein Incident-Signal. Fail-closed ist der
    // Reserve-Insert VOR dem Provider-Aufruf.
    const finish = async (patch: Parameters<AnonAuditLog['complete']>[1]): Promise<void> => {
      try {
        await al.complete(requestId, patch);
      } catch (e) {
        log({ scope: 'ai-gateway-anon', event: 'log_complete_failed', request_id: requestId, error: String((e as Error)?.message ?? e).slice(0, 200) });
      }
    };

    // 3. Nur EU-lokaler Provider (keine Cloud-Kette).
    const gateway = await deps.buildGateway();
    if (gateway instanceof Response) {
      await finish({ outcome: 'error', error_code: 'PROVIDER_UNAVAILABLE', duration_ms: now() - startedAt });
      return gateway;
    }

    const request = buildAnonAuditRequest(parsed, requestId);
    const verdict = await deps.pdpCheck(request.feature, request.model_profile);
    if (verdict instanceof Response) {
      await finish({ outcome: 'error', error_code: 'POLICY_BLOCKED', duration_ms: now() - startedAt });
      return verdict;
    }

    let resp: Record<string, unknown> & { output: unknown };
    try {
      resp = await gateway.generate(request);
    } catch (error) {
      const mapped = mapGatewayError(error);
      await finish({ outcome: 'error', error_code: mapped.code, duration_ms: now() - startedAt });
      return jsonError(mapped.status, mapped.code, mapped.message, corsHeaders);
    }

    // 4. Protokoll abschließen.
    const usage = (resp.usage ?? {}) as { input_tokens?: number; output_tokens?: number };
    await finish({
      outcome: 'success',
      model: typeof resp.model === 'string' ? resp.model : undefined,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      duration_ms: now() - startedAt,
    });

    log({ scope: 'ai-gateway-auth', route: '/', path: 'anon', feature: ANON_FEATURE, request_id: requestId, audit_id: parsed.auditId });
    return jsonResponse({ ok: true, ...resp }, 200, corsHeaders);
  }

  // ── Native op-API ──────────────────────────────────────────────────

  async function handleOpBased(req: Request): Promise<Response> {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'BAD_REQUEST', 'invalid json', corsHeaders);
    }
    if (!body || typeof body !== 'object') return jsonError(400, 'BAD_REQUEST', 'invalid json', corsHeaders);

    // Öffentlicher Audit-Copilot: eigener, fest verdrahteter Pfad ohne Nutzer-JWT.
    if (isAnonAuditBody(body)) return await handleAnonAudit(req, body);

    const op = String(body.op ?? '');
    if (!ALLOWED_OPS.has(op)) return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`, corsHeaders);

    const feature = typeof body.feature === 'string' ? body.feature : '';
    // Auth VOR jeder weiteren Arbeit — auch vor 'health' (verrät Provider-Zustand).
    const principal = await resolvePrincipal(req, body.tenant_id, feature);
    if (principal instanceof Response) return principal;

    if (op === 'health') {
      const hg = await deps.buildGateway();
      if (hg instanceof Response) return hg;
      const health = await hg.health();
      return jsonResponse({ ...health, ok: health.ok }, 200, corsHeaders);
    }

    const raw = body as unknown as AiGatewayRequest;
    if (!raw.feature || !raw.task_type || !raw.model_profile || raw.input === undefined || raw.input === null || raw.input === '') {
      return jsonError(400, 'BAD_REQUEST', 'feature, task_type, model_profile and input are required', corsHeaders);
    }

    const request = applyPolicy(raw, principal);
    if (isRejection(request)) return reject(request);

    const limited = await enforceRateLimit(req, principal, request.feature);
    if (limited) return limited;

    logAccess(principal, '/', request);

    const verdict = await deps.pdpCheck(request.feature, request.model_profile);
    if (verdict instanceof Response) return verdict;
    const governance = verdict && verdict.decision === 'warn'
      ? { decision: verdict.decision, reasons: verdict.reasons.map((r) => r.text_de) }
      : undefined;
    const extra = governance ? { governance } : {};

    const gateway = await deps.buildGateway();
    if (gateway instanceof Response) return gateway;

    if (op === 'generate')     return jsonResponse({ ok: true, ...(await gateway.generate(request)), ...extra }, 200, corsHeaders);
    if (op === 'extract_json') return jsonResponse({ ok: true, ...(await gateway.extractJson(request)), ...extra }, 200, corsHeaders);
    if (op === 'embed')        return jsonResponse({ ok: true, ...(await gateway.embed(request)), ...extra }, 200, corsHeaders);
    if (op === 'stream')       return streamNdjson(gateway, request, governance);
    return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`, corsHeaders);
  }

  // ── OpenAI-kompatibel: POST /v1/chat/completions ───────────────────

  async function handleOpenAIChatCompletions(req: Request): Promise<Response> {
    let body: OpenAIChatRequest & { tenant_id?: unknown };
    try {
      body = (await req.json()) as OpenAIChatRequest & { tenant_id?: unknown };
    } catch {
      return jsonError(400, 'BAD_REQUEST', 'invalid json', corsHeaders);
    }
    if (!body || typeof body !== 'object') return jsonError(400, 'BAD_REQUEST', 'invalid json', corsHeaders);

    // tenant_id: Body-Feld (Pflicht im Nutzerpfad); Header x-tenant-id als
    // Alternative für OpenAI-SDKs, die keine Zusatzfelder senden.
    const tenantClaim = typeof body.tenant_id === 'string' ? body.tenant_id : req.headers.get('x-tenant-id');
    const principal = await resolvePrincipal(req, tenantClaim, 'openai_compat');
    if (principal instanceof Response) return principal;

    const parsed = parseChatRequest(body);
    if (!parsed.ok) return jsonError(parsed.status, parsed.code, parsed.message, corsHeaders);

    const request = applyPolicy(parsed.request, principal);
    if (isRejection(request)) return reject(request);

    const limited = await enforceRateLimit(req, principal, request.feature);
    if (limited) return limited;

    logAccess(principal, '/v1/chat/completions', request);

    const verdict = await deps.pdpCheck(request.feature, request.model_profile);
    if (verdict instanceof Response) return verdict;

    const gateway = await deps.buildGateway();
    if (gateway instanceof Response) return gateway;

    try {
      if (body.stream === true) return streamOpenAiCompat(gateway, request);
      const response = parsed.wantsJson ? await gateway.extractJson(request) : await gateway.generate(request);
      // deno-lint-ignore no-explicit-any
      return jsonResponse(formatChatResponse(response as any, request.model_profile), 200, corsHeaders);
    } catch (error) {
      const mapped = mapGatewayError(error);
      return jsonError(mapped.status, mapped.code, mapped.message, corsHeaders);
    }
  }

  // ── Router ─────────────────────────────────────────────────────────

  return async (req: Request): Promise<Response> => {
    const preflight = handleOptions(req, corsHeaders);
    if (preflight) return preflight;

    const route = routeOf(req.url);
    try {
      if (route === '/v1/models' && req.method === 'GET') {
        return jsonResponse(modelsResponse(), 200, corsHeaders);
      }
      if (route === '/v1/chat/completions' && req.method === 'POST') {
        return await handleOpenAIChatCompletions(req);
      }
      if ((route === '/' || route === '') && req.method === 'POST') {
        return await handleOpBased(req);
      }
      return jsonError(404, 'NOT_FOUND', `unknown route: ${req.method} ${route}`, corsHeaders);
    } catch (error) {
      const mapped = mapGatewayError(error);
      return jsonError(mapped.status, mapped.code, mapped.message, corsHeaders);
    }
  };
}

// ── Streaming-Helfer (unverändert aus index.ts übernommen) ──────────

function streamNdjson(
  gateway: GatewayLike,
  request: AiGatewayRequest,
  governance: { decision: string; reasons: string[] } | undefined,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        for await (const chunk of gateway.generateStream(request)) {
          send({ ok: true, ...chunk, ...(governance && chunk.event === 'done' ? { governance } : {}) });
        }
      } catch (error) {
        const mapped = mapGatewayError(error);
        send({ ok: false, error: { code: mapped.code, message: mapped.message } });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { ...corsHeaders, 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function streamOpenAiCompat(gateway: GatewayLike, request: AiGatewayRequest): Response {
  const encoder = new TextEncoder();
  const id = `chatcmpl-${request.trace_id ?? crypto.randomUUID()}`;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const chunk of gateway.generateStream(request)) {
          if (chunk.event === 'delta' && chunk.text) {
            send({ id, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: chunk.text }, finish_reason: null }] });
          }
          if (chunk.event === 'done') {
            send({ id, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (error) {
        const mapped = mapGatewayError(error);
        send({ error: { code: mapped.code, message: mapped.message } });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { ...corsHeaders, 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' },
  });
}

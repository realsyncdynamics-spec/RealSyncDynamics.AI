// ai-gateway — provider-neutral inference endpoint.
//
// Two compatible APIs on the same Supabase function:
//
//   A) Native op-based API (preferred for internal callers):
//      POST /functions/v1/ai-gateway
//      Body: { op, feature, task_type, model_profile, input, ... }
//
//   B) OpenAI-compatible shell (so any OpenAI SDK / client can talk to
//      the gateway without knowing the platform's vocabulary):
//      GET  /functions/v1/ai-gateway/v1/models
//      POST /functions/v1/ai-gateway/v1/chat/completions
//      Body: { model, messages, max_tokens, temperature, response_format }
//
// Both routes funnel through the same ServerAiGateway / LMStudioAdapter
// pipeline. The OpenAI shell is a thin translator built on the pure
// functions in `_shared/aiGateway/openaiCompat.ts` (which is unit-tested
// from the frontend side via its `src/core/ai-gateway/openaiCompat.ts`
// mirror).
// 2026-09-18: gezieltes Production-Redeploy (siteos + ai-gateway), nicht die Flotte.

import type { AiGatewayRequest } from '../_shared/aiGateway/types.ts';
import { createServerGatewayFromEnv } from '../_shared/aiGateway/serverFromEnv.ts';
import {
  routeOf,
  modelsResponse,
  parseChatRequest,
  formatChatResponse,
  mapInferenceError,
  type OpenAIChatRequest,
} from '../_shared/aiGateway/openaiCompat.ts';
import {
  decideRateLimit,
  clientIp,
  type WindowState,
} from '../_shared/aiGateway/rateLimit.ts';
import { sha256Hex } from '../_shared/hash.ts';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { decide } from '../_shared/pdp/decide.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  resolveTenantAccess,
  quotaWouldExceed,
  type TenantAccess,
} from '../_shared/tenantAccess.ts';
import { getCurrentTotal, recordUsage } from '../_shared/usage.ts';
import type { DecisionRequest, DecisionResult } from '../_shared/pdp/core.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';
import { EntitlementError, gateFeature } from '../_shared/entitlements.ts';

const corsHeaders = buildCorsHeaders('GET, POST, OPTIONS');

const ALLOWED_OPS = new Set(['health', 'generate', 'extract_json', 'embed', 'stream']);
const BUILDER_FEATURE = 'app_builder_code';

// Verbrauchsschluessel — dieselben, die _shared/ai.ts fuer den anderen
// AI-Pfad bucht. Kein neuer Namensraum.
const CALLS_KEY  = 'limit.ai_calls_monthly';
const TOKENS_KEY = 'limit.ai_tokens_monthly';

/**
 * Features, die ohne Anmeldung laufen duerfen.
 *
 * Das ist KEINE neue Entscheidung, sondern der festgeschriebene Ist-Zustand:
 * der Audit-Co-Pilot auf der oeffentlichen Seite /audit und der
 * Assistenten-Chip rufen den Gateway heute bewusst ohne Mandant auf. Der
 * Vertragstest test/features/governance/AgentWidget/auditCopilotAnonTools.test.ts
 * fordert dafuer sogar ausdruecklich "kein tenant-Leak im Body".
 *
 * Fuer diese drei bleibt es beim IP-Rate-Limit: kein Mandant, also auch kein
 * Kontingent und keine Verbrauchsbuchung — es gibt niemanden, dem sie
 * zuzuordnen waere.
 *
 * Die Liste gilt NUR fuer Aufrufe aus dem Browser. Edge Functions, die den
 * Gateway serverseitig aufrufen, sind der eigene Fall `internerAufruf()`
 * weiter unten und brauchen hier keinen Eintrag.
 *
 * Wer hier etwas ergaenzt, oeffnet eine Flaeche, die auf Betreiberkosten
 * laeuft. Das ist eine Produktentscheidung, keine technische.
 */
const ANON_FEATURES = new Set([
  'audit_copilot.fix_snippet',
  'audit_copilot.remediation_plan',
  'assistant_chip_quick_chat',
]);

// Per-instance rate-limit windows. Cleared on cold-start which is fine:
// a bad actor has no cheap way to trigger a cold-start.
const MINUTE_WINDOWS = new Map<string, WindowState>();
const HOUR_WINDOWS   = new Map<string, WindowState>();

// Salt mixes into the IP hash so the stored keys aren't trivially
// derivable from the raw IP. Optional — falls back to a constant when
// not configured, which is still acceptable because the hash is only
// used as a Map key, never persisted or logged.
const IP_HASH_SALT = Deno.env.get('AI_GATEWAY_IP_HASH_SALT') ?? 'ai-gateway-default-salt';

// ─── PDP-Anbindung: der Gateway als erster Policy Enforcement Point ─────────
//
// Modi (Plan P0-4, Rollout-Regel R5 — Enforcement nie still einschalten):
//   off     → Gateway verhaelt sich exakt wie vor dieser Aenderung
//   shadow  → Entscheidung wird berechnet und geloggt, aber NIE durchgesetzt
//   enforce → block / require_approval fuehren zu 403 mit deutscher Begruendung
// Default ist shadow: Produktionsverhalten aendert sich erst durch bewusstes
// Umschalten der Env-Variable, nicht durch diesen Deploy.
//
// Grenze (ehrlich, Plan §2.3): Der Gateway hat heute keinen Tenant-Kontext —
// es greifen ausschliesslich GLOBALE ai_policies (tenant_id IS NULL). Und der
// Ziel-Vendor steht erst nach dem internen Routing fest, deshalb bewertet
// dieser PEP model_profile/feature, nicht den finalen Vendor. Beides wird
// mit dem Subjektmodell (P1-1) und dem Klassifikations-PIP (P1-2) reicher.
type EnforcementMode = 'off' | 'shadow' | 'enforce';

function enforcementMode(): EnforcementMode {
  const raw = (Deno.env.get('AI_GATEWAY_ENFORCEMENT') ?? 'shadow').toLowerCase();
  return raw === 'off' || raw === 'enforce' ? raw : 'shadow';
}

// deno-lint-ignore no-explicit-any
let pdpAdmin: any | null = null;
// deno-lint-ignore no-explicit-any
async function getPdpAdmin(): Promise<any | null> {
  if (pdpAdmin) return pdpAdmin;
  const url = Deno.env.get('SUPABASE_URL');
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !srk) return null;
  const { createClient } = await import('jsr:@supabase/supabase-js@2');
  pdpAdmin = createClient(url, srk, { auth: { persistSession: false } });
  return pdpAdmin;
}

/**
 * Prueft die Anfrage gegen den PDP. Rueckgabe:
 *   Response  → Aktion ist durchgesetzt blockiert (nur im enforce-Modus)
 *   Ergebnis  → warn/allow: Aufrufer haengt es als `governance` an die Antwort
 *   null      → PDP aus, nicht konfiguriert oder nicht erreichbar
 *
 * Ausfallverhalten: Ein PDP-Fehler laesst den Gateway durch (fail open) und
 * wird laut geloggt. Globale Block-Policies mit fail-closed-Anspruch brauchen
 * die lokale Snapshot-Auswertung im PEP — Teil der P1-Haertung, bewusst
 * nicht still hier hineingebaut (offene Entscheidung E2 im Plan).
 */
async function pdpCheck(feature: string, modelProfile: string): Promise<Response | DecisionResult | null> {
  const mode = enforcementMode();
  if (mode === 'off') return null;
  try {
    const admin = await getPdpAdmin();
    if (!admin) return null;
    const request: DecisionRequest = {
      contract: 'v1',
      tenant_id: null, // Gateway ist (noch) tenant-los: nur globale Policies
      principal: { type: 'service' },
      action: { verb: 'invoke', channel: 'ai_gateway', event_type: 'prompt_sent' },
      target: { model: modelProfile },
      context: { feature },
    };
    const result = await decide(admin, request);

    if (result.matched_policy_ids.length > 0) {
      console.log(JSON.stringify({
        scope: 'ai-gateway-pep', mode, feature, model_profile: modelProfile,
        decision: result.decision, policies: result.matched_policy_ids,
        snapshot: result.snapshot_version,
      }));
    }

    if (mode === 'enforce' && result.decision === 'block') {
      return jsonError(403, 'POLICY_BLOCKED',
        result.reasons[0]?.text_de ?? 'Diese Aktion ist durch eine Unternehmensrichtlinie blockiert.');
    }
    if (mode === 'enforce' && result.decision === 'require_approval') {
      // Die durchgehende Freigabekette (wartender PEP) ist P1-4; bis dahin
      // ist freigabepflichtig = nicht ausfuehrbar, mit klarer Erklaerung.
      return jsonError(403, 'APPROVAL_REQUIRED',
        result.reasons[0]?.text_de ?? 'Diese Aktion erfordert eine Freigabe gemäß Unternehmensrichtlinie.');
    }
    // Shadow-Modus veraendert die Antwort NIE — auch kein warn-Anhang.
    return mode === 'enforce' ? result : null;
  } catch (e) {
    console.error('[ai-gateway-pep] pdp unavailable — fail open', e);
    return null;
  }
}

async function enforceRateLimit(req: Request, feature: string): Promise<Response | null> {
  const ip = clientIp(req.headers);
  const ipHash = await sha256Hex(ip + ':' + IP_HASH_SALT);
  const decision = decideRateLimit({
    key: `${ipHash}:${feature}`,
    feature,
    now: Date.now(),
    minuteWindows: MINUTE_WINDOWS,
    hourWindows:   HOUR_WINDOWS,
  });
  if (decision.ok) return null;
  const retryAfterSec = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded (${decision.scope}). Retry after ${retryAfterSec}s.`,
        scope: decision.scope,
        retry_after_ms: decision.retryAfterMs,
      },
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'content-type': 'application/json',
        'retry-after': String(retryAfterSec),
      },
    },
  );
}

async function requireBuilderIfNeeded(
  req: Request,
  feature: string,
  tenantClaim: unknown,
): Promise<Response | null> {
  if (feature !== BUILDER_FEATURE) return null;
  const auth = await requireAuthAndTenant(
    req,
    typeof tenantClaim === 'string' ? tenantClaim : null,
  );
  if (auth instanceof Response) return auth;
  try {
    await gateFeature(auth.admin, auth.tenantId, 'siteos.builder');
  } catch (e) {
    if (e instanceof EntitlementError) {
      return jsonError(
        e.code === 'INTERNAL' ? 500 : 403,
        e.code === 'FORBIDDEN' ? 'ENTITLEMENT' : e.code,
        e.message,
      );
    }
    throw e;
  }
  return null;
}

// ─── Zugriff und Verbrauch ─────────────────────────────────────────────────
//
// Bis hierher lief der Gateway ohne Eingangspruefung: kein Nutzer, kein
// Tenant, kein Verbrauch. `verify_jwt = true` steht zwar in der config, aber
// der Anon-Key ist ein gueltiges JWT und liegt im Frontend-Bundle — wer ihn
// hat, konnte die Provider-Credits des Betreibers verbrauchen. Gebremst hat
// nur das IP-Rate-Limit.
//
// Der Tenant kommt aus dem Header `X-Tenant-Id`, nicht aus dem Body: die
// OpenAI-kompatible Schale hat ein fremdes Body-Format, in dem kein Platz
// dafuer waere. Ein Weg fuer beide Routen ist besser als zwei.

/** Einmal pro Aufruf gebaut; Admin-Rechte nur fuer Mitgliedschaft und Usage. */
function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function resolveAccess(req: Request): Promise<TenantAccess> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  return await resolveTenantAccess(
    {
      authHeader: req.headers.get('authorization'),
      tenantId: req.headers.get('x-tenant-id'),
    },
    {
      async getUserId(jwt) {
        const userClient = createClient(SUPABASE_URL, ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data, error } = await userClient.auth.getUser();
        if (error || !data?.user) return null;
        return data.user.id;
      },
      async isMember(userId, tenantId) {
        const { data, error } = await adminClient()
          .from('memberships').select('user_id')
          .eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
        if (error) throw new Error(error.message);
        return Boolean(data);
      },
    },
  );
}

/**
 * Reicht das Monatskontingent fuer einen weiteren Aufruf?
 *
 * Geprueft wird VOR dem Provider-Aufruf, gebucht DANACH — sonst zaehlte ein
 * Aufruf mit, der am Provider noch scheitert. Dieselbe Trennung wie in
 * automation-trigger.
 *
 * Faellt die Pruefung selbst aus, laeuft der Aufruf weiter: ein Ausfall der
 * Verbrauchszaehlung darf keine Kundenfunktion abschalten. Das ist bewusst
 * die andere Richtung als bei der Zugriffspruefung.
 */
/**
 * Ruft hier eine andere Edge Function dieses Projekts?
 *
 * Erkennungsmerkmal ist der Service-Role-Key als Bearer. Er verlaesst den
 * Server nie, waehrend der Anon-Key im Frontend-Bundle liegt — nur deshalb
 * laesst sich ein interner Aufruf ueberhaupt von einem fremden
 * unterscheiden. Dasselbe Merkmal nutzen welcome-email und
 * rebuild-website; der Vertragstest dazu haelt fest, warum das
 * Plattform-JWT dafuer nicht reicht.
 *
 * Der Vergleich laeuft ueber die volle Laenge, nicht mit `startsWith`.
 */
function internerAufruf(req: Request): boolean {
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!srk) return false;
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  return header.slice(7).trim() === srk;
}

/** Ein Tenant wird nur als UUID akzeptiert — wie in _shared/tenantAccess.ts. */
const TENANT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ermittelt den Mandanten, sofern dieser Aufruf einen braucht.
 *
 * Drei Faelle, in dieser Reihenfolge:
 *
 *   1. Interner Aufruf (Service-Role-Bearer) — vertrauenswuerdig. Nennt er
 *      einen Mandanten, wird auf diesen gebucht; nennt er keinen, laeuft er
 *      wie bisher ohne Buchung weiter. Eine Mitgliedschaftspruefung gibt es
 *      hier nicht: es gibt keinen Nutzer, dessen Mitgliedschaft zu pruefen
 *      waere, und der Aufrufer ist bereits der Server selbst.
 *   2. Anonymes Feature aus dem Browser — weiter ohne Mandant.
 *   3. Alles andere — Sitzung und Mandant sind Pflicht.
 *
 * `null` heisst: weiter ohne Mandant. Eine `Response` heisst abgelehnt.
 * Sonst steht der geprüfte Zugriff fest.
 */
async function mandantFuer(
  req: Request,
  feature: string,
): Promise<Extract<TenantAccess, { ok: true }> | Response | null> {
  if (internerAufruf(req)) {
    const genannt = (req.headers.get('x-tenant-id') ?? '').trim();
    if (!genannt) return null;
    if (!TENANT_UUID_RE.test(genannt)) {
      return jsonError(400, 'INVALID_TENANT', 'tenant id must be a valid UUID');
    }
    return { ok: true, userId: 'service_role', tenantId: genannt };
  }
  if (ANON_FEATURES.has(feature)) return null;
  const access = await resolveAccess(req);
  if (!access.ok) return jsonError(access.status, access.code, access.message);
  return access;
}

async function quotaBlocked(tenantId: string): Promise<Response | null> {
  try {
    const admin = adminClient();
    const [current, entResp] = await Promise.all([
      getCurrentTotal(admin, tenantId, CALLS_KEY),
      admin.rpc('tenant_entitlements', { p_tenant_id: tenantId }),
    ]);
    // deno-lint-ignore no-explicit-any
    const limits = Object.fromEntries(((entResp.data ?? []) as any[]).map((r) => [r.key, r.value as number]));
    if (quotaWouldExceed({ current, limit: limits[CALLS_KEY] })) {
      return jsonError(402, 'QUOTA_EXCEEDED',
        `monthly AI call quota reached (${current}/${limits[CALLS_KEY]})`);
    }
    return null;
  } catch (e) {
    console.error('ai-gateway quota check failed', (e as Error).message);
    return null;
  }
}

/**
 * Bucht den Verbrauch nach einem erfolgreichen Provider-Aufruf.
 *
 * Nur Aufrufe und Token. `limit.ai_cost_monthly_cents` wird NICHT gebucht:
 * die Kosten pro Token stehen in der Tabelle `ai_tools`
 * (cost_input_per_million_usd), also pro Tool — der Gateway hat keine
 * Tool-Zeile und damit keinen Preis. Einen zu erfinden waere eine erfundene
 * Zahl in einer Abrechnung.
 *
 * Schlaegt das Buchen fehl, bleibt die Antwort trotzdem gueltig: der Aufruf
 * ist beim Provider bereits bezahlt, ihn dem Kunden vorzuenthalten macht ihn
 * nicht billiger.
 */
async function bucheVerbrauch(
  tenantId: string,
  userId: string,
  feature: string,
  usage: { total_tokens?: number; input_tokens?: number; output_tokens?: number } | undefined,
): Promise<void> {
  const tokens = usage?.total_tokens
    ?? ((usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0));
  const meta = { feature, user_id: userId, source: 'ai-gateway' };
  try {
    const admin = adminClient();
    await Promise.all([
      recordUsage(admin, tenantId, CALLS_KEY, 1, meta),
      ...(tokens > 0 ? [recordUsage(admin, tenantId, TOKENS_KEY, tokens, meta)] : []),
    ]);
  } catch (e) {
    console.error('ai-gateway recordUsage failed', (e as Error).message);
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;

  const route = routeOf(req.url);

  try {
    // Die Zugriffspruefung sitzt in den Handlern, nicht hier: welcher
    // Mandant noetig ist, haengt vom angefragten Feature ab, und das steht
    // erst nach dem Parsen des Body fest.

    // OpenAI-compatible shell
    if (route === '/v1/models' && req.method === 'GET') {
      return jsonResponse(modelsResponse());
    }
    if (route === '/v1/chat/completions' && req.method === 'POST') {
      return await handleOpenAIChatCompletions(req);
    }

    // Native op-based API
    if ((route === '/' || route === '') && req.method === 'POST') {
      return await handleOpBased(req);
    }

    return jsonError(404, 'NOT_FOUND', `unknown route: ${req.method} ${route}`);
  } catch (error) {
    const mapped = mapInferenceError(error);
    return jsonError(mapped.status, mapped.code, mapped.message);
  }
});

// ── Native op-based handler ───────────────────────────────────────

async function handleOpBased(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const op = String(body.op ?? '');
  if (!ALLOWED_OPS.has(op)) return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`);

  const gateway = await buildGateway();
  if (gateway instanceof Response) return gateway;

  if (op === 'health') {
    const health = await gateway.health();
    return jsonResponse({ ok: health.ok, ...health });
  }

  const request = body as unknown as AiGatewayRequest;
  if (!request.feature || !request.task_type || !request.model_profile || !request.input) {
    return jsonError(400, 'BAD_REQUEST', 'feature, task_type, model_profile and input are required');
  }

  const builderGate = await requireBuilderIfNeeded(req, request.feature, request.tenant_id);
  if (builderGate) return builderGate;

  const limited = await enforceRateLimit(req, request.feature);
  if (limited) return limited;

  // PEP: Entscheidung VOR dem Provider-Call (Plan P0-4). Eine Response ist
  // ein durchgesetzter Block; ein warn-Ergebnis wird der Antwort angehaengt.
  const verdict = await pdpCheck(request.feature, request.model_profile);
  if (verdict instanceof Response) return verdict;
  const governance = verdict && verdict.decision === 'warn'
    ? { decision: verdict.decision, reasons: verdict.reasons.map((r) => r.text_de) }
    : undefined;

  // Mandant, sofern dieses Feature einen braucht. Danach Kontingent VOR
  // dem Provider-Aufruf.
  //
  // Das gilt auch fuer `stream`: der Op kam nach dem ersten Entwurf dieses
  // PRs dazu. Ohne diese Zeile waere er der einzige Weg am Gateway vorbei
  // geblieben — derselbe Provider, dieselben Kosten, nur ohne Pruefung.
  const mandant = await mandantFuer(req, request.feature);
  if (mandant instanceof Response) return mandant;
  if (mandant) {
    const blocked = await quotaBlocked(mandant.tenantId);
    if (blocked) return blocked;
  }

  // Streaming bucht seinen Verbrauch erst, wenn der `done`-Chunk die echten
  // Zahlen des Providers bringt — geschaetzt wird nichts.
  if (op === 'stream') {
    return streamNdjson(gateway, request, governance, mandant ?? undefined);
  }

  const antwort = op === 'generate'     ? await gateway.generate(request)
                : op === 'extract_json' ? await gateway.extractJson(request)
                : op === 'embed'        ? await gateway.embed(request)
                : null;
  if (antwort === null) return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`);

  // Verbrauch NACH dem erfolgreichen Aufruf. Anonyme Aufrufe haben keinen
  // Mandanten, dem er zuzuordnen waere.
  if (mandant) {
    await bucheVerbrauch(mandant.tenantId, mandant.userId, request.feature, antwort.usage);
  }

  return jsonResponse({ ok: true, ...antwort, ...(governance ? { governance } : {}) });

  return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`);
}

// ── OpenAI-compat: POST /v1/chat/completions ──────────────────────

async function handleOpenAIChatCompletions(req: Request): Promise<Response> {
  let body: OpenAIChatRequest;
  try {
    body = (await req.json()) as OpenAIChatRequest;
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const parsed = parseChatRequest(body);
  if (!parsed.ok) return jsonError(parsed.status, parsed.code, parsed.message);

  const limited = await enforceRateLimit(req, parsed.request.feature);
  if (limited) return limited;

  // PEP auch auf der OpenAI-kompatiblen Schale — gleiche Entscheidung,
  // gleicher Block. warn kann hier nicht angehaengt werden (fremdes
  // Antwortformat) und wird nur geloggt.
  const verdict = await pdpCheck(parsed.request.feature, parsed.request.model_profile);
  if (verdict instanceof Response) return verdict;

  const gateway = await buildGateway();
  if (gateway instanceof Response) return gateway;

  const mandant = await mandantFuer(req, parsed.request.feature);
  if (mandant instanceof Response) return mandant;
  if (mandant) {
    const blocked = await quotaBlocked(mandant.tenantId);
    if (blocked) return blocked;
  }

  try {
    if (body.stream === true) {
      return streamOpenAiCompat(gateway, parsed.request, mandant ?? undefined);
    }
    const response = parsed.wantsJson
      ? await gateway.extractJson(parsed.request)
      : await gateway.generate(parsed.request);
    if (mandant) {
      await bucheVerbrauch(mandant.tenantId, mandant.userId, parsed.request.feature, response.usage);
    }
    return jsonResponse(formatChatResponse(response, parsed.request.model_profile));
  } catch (error) {
    const mapped = mapInferenceError(error);
    return jsonError(mapped.status, mapped.code, mapped.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────

async function buildGateway() {
  const built = await createServerGatewayFromEnv({
    allowCloudFallback: true,
    requireLmStudio: true,
  });
  if (!built.ok) return jsonError(built.status, built.code, built.message);
  return built.gateway;
}

function streamNdjson(
  gateway: { generateStream: (req: AiGatewayRequest) => AsyncIterable<{ event: string; text?: string; provider?: string; model?: string; profile?: string; usage?: unknown; trace_id?: string; latency_ms?: number }> },
  request: AiGatewayRequest,
  governance: { decision: string; reasons: string[] } | undefined,
  /** Geprueft in `mandantFuer`. Fehlt er, ist der Aufruf anonym und wird
   *  nicht gebucht — wie bei den nicht-streamenden Ops. */
  mandant?: { tenantId: string; userId: string },
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        for await (const chunk of gateway.generateStream(request)) {
          send({ ok: true, ...chunk, ...(governance && chunk.event === 'done' ? { governance } : {}) });
          // Erst der `done`-Chunk traegt die Zahlen des Providers. Vorher zu
          // buchen hiesse schaetzen, und ein abgebrochener Stream haette
          // etwas berechnet, das nie fertig wurde.
          if (chunk.event === 'done' && mandant) {
            await bucheVerbrauch(
              mandant.tenantId,
              mandant.userId,
              request.feature,
              chunk.usage as { total_tokens?: number; input_tokens?: number; output_tokens?: number } | undefined,
            );
          }
        }
      } catch (error) {
        const mapped = mapInferenceError(error);
        send({ ok: false, error: { code: mapped.code, message: mapped.message } });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function streamOpenAiCompat(
  gateway: { generateStream: (req: AiGatewayRequest) => AsyncIterable<{ event: string; text?: string; model?: string; trace_id?: string; usage?: unknown }> },
  request: AiGatewayRequest,
  /** Wie bei streamNdjson: ohne Mandant anonym und ungebucht. */
  mandant?: { tenantId: string; userId: string },
): Response {
  const encoder = new TextEncoder();
  const id = `chatcmpl-${request.trace_id ?? crypto.randomUUID()}`;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const chunk of gateway.generateStream(request)) {
          if (chunk.event === 'delta' && chunk.text) {
            send({
              id,
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { content: chunk.text }, finish_reason: null }],
            });
          }
          if (chunk.event === 'done') {
            send({
              id,
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
            });
            if (mandant) {
              await bucheVerbrauch(
                mandant.tenantId,
                mandant.userId,
                request.feature,
                chunk.usage as { total_tokens?: number; input_tokens?: number; output_tokens?: number } | undefined,
              );
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (error) {
        const mapped = mapInferenceError(error);
        send({ error: { code: mapped.code, message: mapped.message } });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
}


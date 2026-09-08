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

import { ServerAiGateway } from '../_shared/aiGateway/router.ts';
import type { AiGatewayRequest } from '../_shared/aiGateway/types.ts';
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
import type { DecisionRequest, DecisionResult } from '../_shared/pdp/core.ts';

const corsHeaders = buildCorsHeaders('GET, POST, OPTIONS');

const ALLOWED_OPS = new Set(['health', 'generate', 'extract_json', 'embed']);

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
async function pdpCheck(feature: string, modelProfile: string, caller: Caller | null): Promise<Response | DecisionResult | null> {
  const mode = enforcementMode();
  if (mode === 'off') return null;
  try {
    const admin = await getPdpAdmin();
    if (!admin) return null;
    const request: DecisionRequest = {
      contract: 'v1',
      // Seit dem 2026-09-08 traegt der Aufruf einen Mandanten, sofern der
      // Aufrufer angemeldet ist — damit greifen mandantenspezifische
      // `ai_policies` und nicht mehr nur globale. Bei anonymen Aufrufen
      // (Free Scan) bleibt es bei `null` und damit bei globalen Policies.
      tenant_id: caller?.tenantId ?? null,
      principal: caller ? { type: 'user', id: caller.userId } : { type: 'service' },
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

/**
 * Wer ruft. `null` heisst anonym — und anonym ist ein gueltiger Zustand,
 * kein Fehler: Der Free Scan auf `/audit` ruft den Gateway ohne Konto.
 */
interface Caller {
  userId: string;
  /** Mandant des Nutzers. `null`, wenn er (noch) keinem angehoert. */
  tenantId: string | null;
}

/**
 * Ermittelt den Aufrufer aus dem Bearer-Token.
 *
 * Bis zum 2026-09-08 gab es diese Funktion nicht, und der Gateway sah
 * niemanden: Jeder Aufruf aus der SPA sendete den oeffentlichen Anon-Key als
 * Bearer-Token. `verify_jwt` war damit erfuellt (der Anon-Key ist ein
 * gueltiges Projekt-JWT), aber es gab kein Subjekt — also keine Zurechnung,
 * keine durchsetzbaren Kontingente und kein Guthabenmodell.
 *
 * Bewusst **weich**: Jeder Fehlschlag endet in `null`, nie in einem 401.
 * Der Gateway bedient weiterhin anonyme Aufrufer; diese Funktion fuegt
 * Identitaet hinzu, wo es sie gibt, und nimmt niemandem den Zugang.
 *
 * Kosten: zwei Aufrufe (Token pruefen, Mitgliedschaft lesen) je Anfrage mit
 * Token. Bewusst ohne Zwischenspeicher — ein Cache auf Identitaet ist eine
 * eigene Entscheidung mit eigenen Fehlerbildern, und der PDP-Aufruf daneben
 * kostet ohnehin eine Runde.
 */
async function resolveCaller(req: Request): Promise<Caller | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon || !token) return null;

  // Der Anon-Key selbst ist kein Nutzer. Ohne diese Abkuerzung liefe fuer
  // jeden anonymen Aufruf ein sinnloser getUser() ins Leere.
  if (token === anon) return null;

  try {
    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data?.user) return null;

    // Mandant ueber den nutzergebundenen Client, nicht ueber service_role:
    // RLS auf `memberships` beantwortet damit genau die Frage „welchem
    // Mandanten gehoert DIESER Nutzer an" — ohne erweiterte Rechte.
    const { data: rows } = await userClient
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', data.user.id)
      .limit(1);

    const tenantId = rows?.[0]?.tenant_id;
    return { userId: data.user.id, tenantId: typeof tenantId === 'string' ? tenantId : null };
  } catch (e) {
    console.error('[ai-gateway] caller unresolved — weiter als anonym', e);
    return null;
  }
}

async function enforceRateLimit(req: Request, feature: string, caller: Caller | null): Promise<Response | null> {
  // Bekannter Nutzer wird nach Nutzer begrenzt, sonst nach IP.
  //
  // Warum nach NUTZER und nicht nach Mandant: Die Werte (10/Minute,
  // 100/Stunde) sind fuer einen einzelnen Aufrufer bemessen. Auf den
  // Mandanten geschluesselt teilten sich fuenf Kollegen einen Eimer — das
  // waere strenger als der Zustand vorher, in dem sie an fuenf Adressen
  // fuenf Eimer hatten. Eine Mandantengrenze ist eine Kontingentfrage und
  // gehoert zur Token-Oekonomie, nicht in den Missbrauchsschutz.
  //
  // Gegenueber der IP ist der Nutzer in beide Richtungen genauer: 50
  // Arbeitsplaetze hinter einer NAT-Adresse teilen sich keinen Eimer mehr,
  // und derselbe Mensch bekommt durch einen Adresswechsel keinen zweiten.
  const scopeKey = caller
    ? `user:${caller.userId}`
    : await sha256Hex(clientIp(req.headers) + ':' + IP_HASH_SALT);
  const decision = decideRateLimit({
    key: `${scopeKey}:${feature}`,
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

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;

  const route = routeOf(req.url);

  try {
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

  const caller = await resolveCaller(req);

  const limited = await enforceRateLimit(req, request.feature, caller);
  if (limited) return limited;

  // PEP: Entscheidung VOR dem Provider-Call (Plan P0-4). Eine Response ist
  // ein durchgesetzter Block; ein warn-Ergebnis wird der Antwort angehaengt.
  const verdict = await pdpCheck(request.feature, request.model_profile, caller);
  if (verdict instanceof Response) return verdict;
  const governance = verdict && verdict.decision === 'warn'
    ? { decision: verdict.decision, reasons: verdict.reasons.map((r) => r.text_de) }
    : undefined;

  if (op === 'generate')     return jsonResponse({ ok: true, ...(await gateway.generate(request)), ...(governance ? { governance } : {}) });
  if (op === 'extract_json') return jsonResponse({ ok: true, ...(await gateway.extractJson(request)), ...(governance ? { governance } : {}) });
  if (op === 'embed')        return jsonResponse({ ok: true, ...(await gateway.embed(request)), ...(governance ? { governance } : {}) });

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

  const caller = await resolveCaller(req);

  const limited = await enforceRateLimit(req, parsed.request.feature, caller);
  if (limited) return limited;

  // PEP auch auf der OpenAI-kompatiblen Schale — gleiche Entscheidung,
  // gleicher Block. warn kann hier nicht angehaengt werden (fremdes
  // Antwortformat) und wird nur geloggt.
  const verdict = await pdpCheck(parsed.request.feature, parsed.request.model_profile, caller);
  if (verdict instanceof Response) return verdict;

  const gateway = await buildGateway();
  if (gateway instanceof Response) return gateway;

  try {
    const response = parsed.wantsJson
      ? await gateway.extractJson(parsed.request)
      : await gateway.generate(parsed.request);
    return jsonResponse(formatChatResponse(response, parsed.request.model_profile));
  } catch (error) {
    const mapped = mapInferenceError(error);
    return jsonError(mapped.status, mapped.code, mapped.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────

// Cloud fallback models — kept here (not in config.ts) because config.ts
// is browser-shared and must not hint at a default cloud model.
const ANTHROPIC_FALLBACK_MODEL =
  Deno.env.get('AI_GATEWAY_ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001';
const OPENAI_FALLBACK_MODEL =
  Deno.env.get('AI_GATEWAY_OPENAI_MODEL') ?? 'gpt-4.1-mini';
const OPENAI_EMBEDDING_MODEL =
  Deno.env.get('AI_GATEWAY_OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';

async function buildGateway(): Promise<ServerAiGateway | Response> {
  const baseUrl = Deno.env.get('LM_STUDIO_BASE_URL');
  if (!baseUrl) {
    return jsonError(503, 'LM_STUDIO_NOT_CONFIGURED', 'LM_STUDIO_BASE_URL not set');
  }
  // Cloud fallback chain: LM Studio → Anthropic → OpenAI. Each step is
  // wired ONLY when its API key is available (env or Vault). Operators
  // with strict EU-locality requirements may set ANTHROPIC_API_KEY but
  // omit OPENAI_API_KEY — the chain shortens accordingly. Without any
  // key, the gateway behaves as in pre-#344 (LM Studio only, errors
  // propagate).
  //
  // Vault-key name lookup: try BOTH uppercase (env-var-style, used by
  // ai-act-classify) AND lowercase (convention in _shared/providers.ts).
  // Existing deployments may store the secret under either name.
  const [anthropicKey, openaiKey] = await Promise.all([
    (async () =>
      Deno.env.get('ANTHROPIC_API_KEY')
      ?? (await readVaultSecret('ANTHROPIC_API_KEY'))
      ?? (await readVaultSecret('anthropic_api_key')))(),
    (async () =>
      Deno.env.get('OPENAI_API_KEY')
      ?? (await readVaultSecret('OPENAI_API_KEY'))
      ?? (await readVaultSecret('openai_api_key')))(),
  ]);
  return new ServerAiGateway({
    lmStudioBaseUrl: baseUrl,
    lmStudioApiKey:  Deno.env.get('LM_STUDIO_API_KEY') ?? 'lm-studio',
    anthropicConfig: anthropicKey
      ? { apiKey: anthropicKey, model: ANTHROPIC_FALLBACK_MODEL }
      : undefined,
    openaiConfig: openaiKey
      ? {
          apiKey:         openaiKey,
          model:          OPENAI_FALLBACK_MODEL,
          embeddingModel: OPENAI_EMBEDDING_MODEL,
        }
      : undefined,
  });
}

// Best-effort Vault read. Returns null on any failure so the gateway
// can still serve LM-Studio-only requests. Mirrors the pattern in
// supabase/functions/_shared/providers.ts.
async function readVaultSecret(name: string): Promise<string | null> {
  const url = Deno.env.get('SUPABASE_URL');
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !srk) return null;
  try {
    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    const admin = createClient(url, srk, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc('get_app_secret', { secret_name: name });
    if (error) return null;
    return typeof data === 'string' && data.length > 0 ? data : null;
  } catch {
    return null;
  }
}


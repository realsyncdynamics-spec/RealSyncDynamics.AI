// ai-gateway — provider-neutral inference endpoint.
//
// Two compatible APIs on the same Supabase function:
//
//   A) Native op-based API (preferred for internal callers):
//      POST /functions/v1/ai-gateway
//      Body: { op, tenant_id, feature, task_type, model_profile, input, ... }
//
//   B) OpenAI-compatible shell (so any OpenAI SDK / client can talk to
//      the gateway without knowing the platform's vocabulary):
//      GET  /functions/v1/ai-gateway/v1/models
//      POST /functions/v1/ai-gateway/v1/chat/completions
//      Body: { model, messages, max_tokens, temperature, response_format, tenant_id }
//
// Zugriff (P0-Härtung, fix/ai-gateway-auth-hardening):
//   - Nutzerpfad: `Authorization: Bearer <user access_token>` + tenant_id,
//     geprüft über requireAuthAndTenant (jedes Mitglied). Anon-Key,
//     service_role-Bearer oder fehlender Header → 401, fremder Tenant → 403.
//   - Service-Pfad: `x-internal-key` gegen Edge-Secret AI_GATEWAY_INTERNAL_KEY
//     (fail-closed, konstante Zeit) + `x-internal-caller`. Mandant NUR über
//     `x-internal-tenant-assertion` (HMAC mit AI_GATEWAY_TENANT_SIGNING_KEY,
//     MP-0); tenant_id im Body ohne Bestätigung → 403.
//   - Anon-Audit-Copilot: Body `{ mode: 'audit_anon', input: { question } }`,
//     fester Zweck/Prompt, IP-Hash-Limit, anon_chat_runs fail-closed.
//   - Cloud-Kette (Anthropic/OpenAI): in KEINEM Pfad, auch nicht im
//     Service-Pfad. allowCloudFallback=false fest; ohne erreichbaren lokalen/
//     EU-Provider fail-closed 503. EU-Anbieter kommen mit „Gateway v2".
//   Die gesamte Request-Logik liegt in handler.ts (vitest-getestet); diese
//   Datei verdrahtet nur die Deno-/jsr-Abhängigkeiten.
//
// Both routes funnel through the same ServerAiGateway / LMStudioAdapter
// pipeline. The OpenAI shell is a thin translator built on the pure
// functions in `_shared/aiGateway/openaiCompat.ts`.
// 2026-09-18: gezieltes Production-Redeploy (siteos + ai-gateway), nicht die Flotte.

import { createServerGatewayFromEnv, resolveLocalProvider } from '../_shared/aiGateway/serverFromEnv.ts';
import { guardedDecide, parseEnforcementMode, parsePdpTimeoutMs } from '../_shared/aiGateway/pdpGuard.ts';
import type { WindowState } from '../_shared/aiGateway/rateLimit.ts';
import { jsonError } from '../_shared/gateway.ts';
import { decide } from '../_shared/pdp/decide.ts';
import type { DecisionRequest, DecisionResult } from '../_shared/pdp/core.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';
import { EntitlementError, gateFeature } from '../_shared/entitlements.ts';
import { completeAnonAudit, reserveAnonAudit } from '../_shared/anonAudit.ts';
import type { AnonAuditLog } from '../_shared/aiGateway/anonAuditCopilot.ts';
import {
  recordAiCallEvidence,
  type AiEvidenceEventInsert,
} from '../_shared/aiGateway/callEvidence.ts';
import { recordUsage } from '../_shared/usage.ts';
import {
  createAiGatewayHandler,
  type GatewayLike,
  type PdpContext,
  type ProviderTarget,
  type UsageBooking,
} from './handler.ts';

// Per-instance rate-limit windows (pro Edge-Isolate, verfallen beim
// Cold-Start). Schlüssel seit der P0-Härtung: Nutzer/Tenant/interner
// Aufrufer — nicht mehr IP+feature. Persistentes Limit: Follow-up.
const MINUTE_WINDOWS = new Map<string, WindowState>();
const HOUR_WINDOWS   = new Map<string, WindowState>();

// ─── PDP-Anbindung: der Gateway als Policy Enforcement Point (MP-0) ─────────
//
// Modi (Plan P0-4, Rollout-Regel R5 — Enforcement nie still einschalten):
//   off     → keine Prüfung (bewusste Betreiber-Einstellung)
//   shadow  → Entscheidung wird berechnet und geloggt, Policy-Treffer werden
//             NICHT durchgesetzt (Default)
//   enforce → block / require_approval fuehren zu 403 mit deutscher Begruendung
//
// MP-0 (fail-closed): In shadow UND enforce lehnt ein PDP-Fehler, ein Timeout
// (AI_GATEWAY_PDP_TIMEOUT_MS, Default 2000) oder eine unklare Entscheidung den
// Aufruf ab (503), statt ihn durchzulassen. Geprüft wird mandantenspezifisch
// (tenant_id des verifizierten Principals) mit Provider als `target.vendor`,
// Modellprofil als `target.model` und Region/Residenz im Payload.
// Siehe _shared/aiGateway/pdpGuard.ts.

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

async function pdpCheck(ctx: PdpContext): Promise<Response | DecisionResult | null> {
  const mode = parseEnforcementMode(Deno.env.get('AI_GATEWAY_ENFORCEMENT'));
  const guarded = await guardedDecide<DecisionResult>({
    mode,
    timeoutMs: parsePdpTimeoutMs(Deno.env.get('AI_GATEWAY_PDP_TIMEOUT_MS')),
    scope: 'ai-gateway-pep',
    decide: async () => {
      const admin = await getPdpAdmin();
      if (!admin) throw new Error('pdp admin client not configured');
      const request: DecisionRequest = {
        contract: 'v1',
        tenant_id: ctx.tenantId,
        principal: ctx.path === 'user' && ctx.userId
          ? { type: 'user', id: ctx.userId }
          : { type: 'service' },
        action: { verb: 'invoke', channel: 'ai_gateway', event_type: 'prompt_sent' },
        target: { model: ctx.modelProfile, ...(ctx.provider ? { vendor: ctx.provider } : {}) },
        payload: { provider_region: ctx.providerRegion, residency: ctx.residency, path: ctx.path },
        context: { feature: ctx.feature },
      };
      return await decide(admin, request);
    },
  });
  if (guarded.kind === 'off') return null;
  if (guarded.kind === 'deny') {
    if (guarded.result) {
      console.log(JSON.stringify({
        scope: 'ai-gateway-pep', mode, decision: guarded.result.decision, enforced: true,
        tenant_id: ctx.tenantId, feature: ctx.feature, provider: ctx.provider,
        policies: guarded.result.matched_policy_ids,
      }));
    }
    return jsonError(guarded.status, guarded.code, guarded.message);
  }
  const result = guarded.result;
  if (result.matched_policy_ids.length > 0) {
    console.log(JSON.stringify({
      scope: 'ai-gateway-pep', mode, tenant_id: ctx.tenantId, feature: ctx.feature,
      model_profile: ctx.modelProfile, provider: ctx.provider, provider_region: ctx.providerRegion,
      decision: result.decision, policies: result.matched_policy_ids, snapshot: result.snapshot_version,
    }));
  }
  // Shadow-Modus veraendert die Antwort NIE — auch kein warn-Anhang.
  return mode === 'enforce' ? result : null;
}

// Routing-Ziel vor dem Provider-Aufruf: der Gateway baut ausschliesslich den
// lokalen Slot (allowCloudFallback=false), also antwortet lm_studio oder
// ollama. Die Region ist nur belegt, wenn der Betreiber sie setzt
// (AI_GATEWAY_LOCAL_REGION=eu) — sonst `unverified`, kein EU-Default.
function providerTarget(): ProviderTarget {
  return {
    provider: resolveLocalProvider(),
    localRegion: Deno.env.get('AI_GATEWAY_LOCAL_REGION') ?? null,
  };
}

// deno-lint-ignore no-explicit-any
async function gateBuilder(admin: any, tenantId: string): Promise<Response | null> {
  try {
    await gateFeature(admin, tenantId, 'siteos.builder');
    return null;
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
}

async function buildGateway(): Promise<GatewayLike | Response> {
  const built = await createServerGatewayFromEnv({
    // Fest false für ALLE Pfade: kein automatischer Wechsel zu Anthropic/
    // OpenAI. Cloud-Keys werden gar nicht erst gelesen.
    allowCloudFallback: false,
    requireLmStudio: true,
  });
  if (!built.ok) return jsonError(built.status, built.code, built.message);
  return built.gateway as unknown as GatewayLike;
}

// anon_chat_runs-Protokoll für den öffentlichen Audit-Copilot. Ohne
// service_role-Client → null → der anon-Pfad antwortet 503 LOG_UNAVAILABLE.
async function anonAuditLog(): Promise<AnonAuditLog | null> {
  const admin = await getPdpAdmin();
  if (!admin) return null;
  return {
    reserve: (row) => reserveAnonAudit(admin, row),
    complete: (requestId, patch) => completeAnonAudit(admin, requestId, patch),
  };
}

// Verbrauch je Mandant (#1646): dieselben Schlüssel wie _shared/ai.ts.
// Nur Buchung, keine Kontingentsperre — die bleibt ein eigener Schritt.
async function recordGatewayUsage(b: UsageBooking): Promise<void> {
  const admin = await getPdpAdmin();
  if (!admin) throw new Error('usage admin client not configured');
  const meta = {
    source: 'ai-gateway',
    route: b.route,
    feature: b.feature,
    path: b.path,
    ...(b.userId ? { user_id: b.userId } : {}),
    ...(b.internalCaller ? { internal_caller: b.internalCaller } : {}),
  };
  await recordUsage(admin, b.tenantId, 'limit.ai_calls_monthly', 1, meta);
  if (b.tokens > 0) await recordUsage(admin, b.tenantId, 'limit.ai_tokens_monthly', b.tokens, meta);
}

// Evidence pro KI-Call (WP9 / M3, MP-0 fail-closed): append-only Einträge in
// ai_evidence_events (DB-Hash-Kette). Ohne Admin-Client wirft die Funktion —
// der Handler bricht dann VOR dem Provider-Aufruf mit 503 ab.
async function recordGatewayEvidence(entry: AiEvidenceEventInsert): Promise<void> {
  const admin = await getPdpAdmin();
  if (!admin) throw new Error('evidence admin client not configured');
  await recordAiCallEvidence(admin, entry);
}

Deno.serve(createAiGatewayHandler({
  env: (name) => Deno.env.get(name),
  requireAuthAndTenant,
  gateBuilder,
  buildGateway,
  pdpCheck,
  providerTarget,
  anonAuditLog,
  recordUsage: recordGatewayUsage,
  recordEvidence: recordGatewayEvidence,
  minuteWindows: MINUTE_WINDOWS,
  hourWindows: HOUR_WINDOWS,
}));

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
//     (fail-closed, konstante Zeit) + `x-internal-caller`.
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

import { createServerGatewayFromEnv } from '../_shared/aiGateway/serverFromEnv.ts';
import type { WindowState } from '../_shared/aiGateway/rateLimit.ts';
import { jsonError } from '../_shared/gateway.ts';
import { decide } from '../_shared/pdp/decide.ts';
import type { DecisionRequest, DecisionResult } from '../_shared/pdp/core.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';
import { EntitlementError, gateFeature } from '../_shared/entitlements.ts';
import { completeAnonAudit, reserveAnonAudit } from '../_shared/anonAudit.ts';
import type { AnonAuditLog } from '../_shared/aiGateway/anonAuditCopilot.ts';
import { createAiGatewayHandler, type GatewayLike } from './handler.ts';

// Per-instance rate-limit windows (pro Edge-Isolate, verfallen beim
// Cold-Start). Schlüssel seit der P0-Härtung: Nutzer/Tenant/interner
// Aufrufer — nicht mehr IP+feature. Persistentes Limit: Follow-up.
const MINUTE_WINDOWS = new Map<string, WindowState>();
const HOUR_WINDOWS   = new Map<string, WindowState>();

// ─── PDP-Anbindung: der Gateway als erster Policy Enforcement Point ─────────
//
// Modi (Plan P0-4, Rollout-Regel R5 — Enforcement nie still einschalten):
//   off     → Gateway verhaelt sich exakt wie vor dieser Aenderung
//   shadow  → Entscheidung wird berechnet und geloggt, aber NIE durchgesetzt
//   enforce → block / require_approval fuehren zu 403 mit deutscher Begruendung
// Default ist shadow: Produktionsverhalten aendert sich erst durch bewusstes
// Umschalten der Env-Variable, nicht durch diesen Deploy.
//
// Grenze (ehrlich, Plan §2.3): Der PEP wertet weiterhin nur GLOBALE
// ai_policies (tenant_id IS NULL) aus. Und der Ziel-Vendor steht erst nach
// dem internen Routing fest, deshalb bewertet dieser PEP model_profile/
// feature, nicht den finalen Vendor.
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
 * wird laut geloggt.
 */
async function pdpCheck(feature: string, modelProfile: string): Promise<Response | DecisionResult | null> {
  const mode = enforcementMode();
  if (mode === 'off') return null;
  try {
    const admin = await getPdpAdmin();
    if (!admin) return null;
    const request: DecisionRequest = {
      contract: 'v1',
      tenant_id: null, // PEP wertet (noch) nur globale Policies aus
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

Deno.serve(createAiGatewayHandler({
  env: (name) => Deno.env.get(name),
  requireAuthAndTenant,
  gateBuilder,
  buildGateway,
  pdpCheck,
  anonAuditLog,
  minuteWindows: MINUTE_WINDOWS,
  hourWindows: HOUR_WINDOWS,
}));

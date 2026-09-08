// governance-router — OpenAI-kompatibler Governance Open Router.
//
// Cursor / SDKs setzen „Override OpenAI Base URL“ auf
//   {SUPABASE_URL}/functions/v1/governance-router/v1
// und den Bearer auf einen `rsd_gov_`-Key aus /app/keys (Quelle api|sdk|agent_runtime).
//
// Auth wie governance-ingest / governance-decide: verify_jwt = false, SHA-256
// gegen governance_ingest_keys. tenant_id kommt AUSSCHLIESSLICH aus dem Key,
// nie aus dem Body (Cross-Tenant-Guard).
//
// Vor dem Provider:
//   1. Expansion-Stufe aus tenant_entitlements (kein neues Key-Vokabular)
//   2. Residenz resolve_ai_residency — EU-lokal sperrt Cloud
//   3. Kontingent (studio → llm_queries, sonst ai_calls)
//   4. PDP mit tenant_id, AI_GATEWAY_ENFORCEMENT off|shadow|enforce,
//      Default shadow, Fail-open bei PDP-Fehler (wie ai-gateway)
//
// Nach Erfolg: ai_tool_runs (tool_key governance_router, KEIN Prompt) und
// recordUsage auf dem Stufen-Kontingent.
//
// EU-KI-VO Art. 50 (Kennzeichnung in _governance.disclosure), Art. 12
// (Prüfpfad ohne Prompt). DSGVO Art. 5/32: Zweckbindung, kein
// Nachrichteninhalt in Metadaten.
//
// Bewusst kein pdp_shadow_log: die CHECK-Liste der Quellen ist geschlossen
// und steht doppelt zur SQL-Funktion. Ein neuer Kanal wäre eine Migration,
// kein Beifang dieses Routers.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { sha256Hex } from '../_shared/hash.ts';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { decide } from '../_shared/pdp/decide.ts';
import type { DecisionRequest, DecisionResult } from '../_shared/pdp/core.ts';
import {
  EntitlementError,
  hasFeature,
  loadEntitlementsForTenant,
  requireQuota,
} from '../_shared/entitlements.ts';
import { getCurrentTotal, recordUsage } from '../_shared/usage.ts';
import { createServerGatewayFromEnv } from '../_shared/aiGateway/serverFromEnv.ts';
import {
  routeOfSlug,
  parseChatRequest,
  formatChatResponse,
  formatChatSse,
  mapInferenceError,
  type OpenAIChatRequest,
} from '../_shared/aiGateway/openaiCompat.ts';
import {
  expansionStageFromEntitlements,
  allowCloudFallback,
  quotaKeyForStage,
  isProfileAllowed,
  modelsResponseForStage,
  governanceMeta,
  EXPANSION_STAGE_LABELS,
  nextExpansionHint,
  type AiResidency,
  type ExpansionStage,
} from '../_shared/aiGateway/governanceRouterCatalog.ts';

const corsHeaders = buildCorsHeaders('GET, POST, OPTIONS');
const MAX_BODY = 262_144;
const ROUTER_SOURCES = new Set(['api', 'sdk', 'agent_runtime']);
const TOOL_KEY = 'governance_router';

type EnforcementMode = 'off' | 'shadow' | 'enforce';

function enforcementMode(): EnforcementMode {
  const raw = (Deno.env.get('AI_GATEWAY_ENFORCEMENT') ?? 'shadow').toLowerCase();
  return raw === 'off' || raw === 'enforce' ? raw : 'shadow';
}

function err(status: number, code: string, message: string, details?: unknown): Response {
  return jsonError(status, code, message, corsHeaders, details);
}

interface KeyRow {
  id: string;
  tenant_id: string;
  allowed_sources: string[] | null;
  revoked_at: string | null;
}

async function authenticate(req: Request, admin: SupabaseClient): Promise<KeyRow | Response> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return err(401, 'UNAUTHORIZED', 'missing bearer token');
  }
  const token = auth.slice('Bearer '.length).trim();
  if (!token.startsWith('rsd_gov_')) {
    return err(401, 'UNAUTHORIZED', 'invalid token prefix');
  }
  const tokenHash = await sha256Hex(token);
  const { data: keyRow, error: keyErr } = await admin
    .from('governance_ingest_keys')
    .select('id, tenant_id, allowed_sources, revoked_at')
    .eq('key_hash', tokenHash)
    .maybeSingle();
  if (keyErr) return err(500, 'INTERNAL', keyErr.message);
  if (!keyRow) return err(401, 'UNAUTHORIZED', 'unknown token');
  if (keyRow.revoked_at) return err(401, 'UNAUTHORIZED', 'token revoked');

  const allowed = (keyRow.allowed_sources ?? []) as string[];
  if (allowed.length > 0 && !allowed.some((s) => ROUTER_SOURCES.has(s))) {
    return err(403, 'FORBIDDEN', 'key source does not include api, sdk or agent_runtime');
  }

  void admin
    .from('governance_ingest_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id);

  return keyRow as KeyRow;
}

async function resolveResidency(admin: SupabaseClient, tenantId: string): Promise<AiResidency> {
  const { data, error } = await admin.rpc('resolve_ai_residency', {
    p_tenant_id: tenantId,
    p_user_id: null,
  });
  // Fail-open analog zu _shared/ai.ts: ohne RPC-Ergebnis gilt cloud.
  // Ein EU-lokal-Mandant kann in diesem Ausfall Cloud sehen. Bewusst, kein Fail-closed.
  if (error) {
    console.error('[governance-router] resolve_ai_residency failed, defaulting to cloud', error.message);
    return 'cloud';
  }
  return data === 'eu_local' ? 'eu_local' : 'cloud';
}

async function pdpCheck(
  admin: SupabaseClient,
  tenantId: string,
  feature: string,
  modelProfile: string,
  stage: ExpansionStage,
  residency: AiResidency,
): Promise<{ block: Response | null; result: DecisionResult | null; mode: EnforcementMode }> {
  const mode = enforcementMode();
  if (mode === 'off') return { block: null, result: null, mode };
  try {
    const request: DecisionRequest = {
      contract: 'v1',
      tenant_id: tenantId,
      principal: { type: 'service' },
      // Kanal ai_gateway: bestehende globale Policies greifen weiter.
      // Ein eigener Shadow-Log-Kanal wäre eine CHECK-Migration, kein Beifang.
      action: { verb: 'invoke', channel: 'ai_gateway', event_type: 'prompt_sent' },
      target: { model: modelProfile },
      context: { feature },
      payload: { expansion_stage: stage, residency },
    };
    const result = await decide(admin, request);

    if (mode === 'enforce' && result.decision === 'block') {
      return {
        block: err(403, 'POLICY_BLOCKED',
          result.reasons[0]?.text_de ?? 'Diese Aktion ist durch eine Unternehmensrichtlinie blockiert.'),
        result,
        mode,
      };
    }
    if (mode === 'enforce' && result.decision === 'require_approval') {
      return {
        block: err(403, 'APPROVAL_REQUIRED',
          result.reasons[0]?.text_de ?? 'Diese Aktion erfordert eine Freigabe gemäß Unternehmensrichtlinie.'),
        result,
        mode,
      };
    }
    return { block: null, result, mode };
  } catch (e) {
    console.error('[governance-router-pep] pdp unavailable — fail open', e);
    return { block: null, result: null, mode };
  }
}

async function loadStage(
  admin: SupabaseClient,
  tenantId: string,
): Promise<{ stage: ExpansionStage; residency: AiResidency; allowCloud: boolean }> {
  const [ent, residency] = await Promise.all([
    loadEntitlementsForTenant(admin, tenantId),
    resolveResidency(admin, tenantId),
  ]);
  const stage = expansionStageFromEntitlements({
    hasAutomations: hasFeature(ent, 'ai.tool.automations'),
    aiCallsMonthly: ent.byKey['limit.ai_calls_monthly']?.value ?? null,
  });
  const allowCloud = allowCloudFallback(stage, residency);
  return { stage, residency, allowCloud };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;

  const route = routeOfSlug(req.url, 'governance-router');
  const url = Deno.env.get('SUPABASE_URL');
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !srk) return err(500, 'INTERNAL', 'runtime not configured');
  const admin = createClient(url, srk, { auth: { persistSession: false } });

  const keyOrErr = await authenticate(req, admin);
  if (keyOrErr instanceof Response) return keyOrErr;
  const tenantId = keyOrErr.tenant_id;

  try {
    if (route === '/v1/models' && req.method === 'GET') {
      const ctx = await loadStage(admin, tenantId);
      return jsonResponse(modelsResponseForStage(ctx.stage, ctx.allowCloud), 200, corsHeaders);
    }

    if (route === '/v1/governance/status' && req.method === 'GET') {
      const ctx = await loadStage(admin, tenantId);
      return jsonResponse({
        expansion_stage: ctx.stage,
        label: EXPANSION_STAGE_LABELS[ctx.stage],
        residency: ctx.residency,
        pdp_mode: enforcementMode(),
        allow_cloud_fallback: ctx.allowCloud,
        quota_key: quotaKeyForStage(ctx.stage),
        next: nextExpansionHint(ctx.stage),
        models: modelsResponseForStage(ctx.stage, ctx.allowCloud).data.map((m) => m.id),
      }, 200, corsHeaders);
    }

    if (route === '/v1/chat/completions' && req.method === 'POST') {
      return await handleChat(req, admin, tenantId);
    }

    return err(404, 'NOT_FOUND', `unknown route: ${req.method} ${route}`);
  } catch (error) {
    const mapped = mapInferenceError(error);
    return err(mapped.status, mapped.code, mapped.message);
  }
});

async function handleChat(
  req: Request,
  admin: SupabaseClient,
  tenantId: string,
): Promise<Response> {
  const raw = await req.text();
  if (raw.length > MAX_BODY) return err(413, 'BODY_TOO_LARGE', 'max 256 KB');

  let body: OpenAIChatRequest;
  try {
    body = JSON.parse(raw) as OpenAIChatRequest;
  } catch {
    return err(400, 'BAD_REQUEST', 'invalid json');
  }

  const parsed = parseChatRequest(body);
  if (!parsed.ok) return err(parsed.status, parsed.code, parsed.message);

  const ctx = await loadStage(admin, tenantId);
  if (ctx.stage === 'observe') {
    return err(403, 'PLAN_REQUIRED',
      'Der Governance-Router liegt ab Starter (Automationen). Free Audit beobachtet, vermittelt aber keine Modelle.');
  }

  if (!isProfileAllowed(parsed.request.model_profile, ctx.stage, ctx.allowCloud)) {
    const code = ctx.residency === 'eu_local' ? 'RESIDENCY_BLOCKED' : 'STAGE_BLOCKED';
    return err(403, code,
      ctx.residency === 'eu_local'
        ? 'EU-lokale Residenz sperrt Cloud-Modelle. Profil unter /settings/ai-residency ändern oder ein EU-lokales Modell wählen.'
        : 'Dieses Modell ist auf der aktuellen Expansionsstufe nicht freigeschaltet.');
  }

  const quotaKey = quotaKeyForStage(ctx.stage);
  if (quotaKey) {
    try {
      const ent = await loadEntitlementsForTenant(admin, tenantId);
      const current = await getCurrentTotal(admin, tenantId, quotaKey);
      requireQuota(ent, quotaKey, current);
    } catch (e) {
      if (e instanceof EntitlementError) {
        const status = e.code === 'QUOTA_EXCEEDED' ? 402 : 403;
        return err(status, e.code, e.message);
      }
      throw e;
    }
  }

  parsed.request.feature = TOOL_KEY;
  parsed.request.tenant_id = tenantId;

  const pep = await pdpCheck(
    admin,
    tenantId,
    TOOL_KEY,
    parsed.request.model_profile,
    ctx.stage,
    ctx.residency,
  );
  if (pep.block) return pep.block;

  const built = await createServerGatewayFromEnv({
    allowCloudFallback: ctx.allowCloud,
    requireLmStudio: !ctx.allowCloud,
  });
  if (!built.ok) return err(built.status, built.code, built.message);

  const meta = governanceMeta({
    residency: ctx.residency,
    stage: ctx.stage,
    allowCloud: ctx.allowCloud,
    pdpMode: pep.mode,
    pdpDecision: pep.result?.decision ?? null,
  });

  const started = Date.now();
  try {
    const response = parsed.wantsJson
      ? await built.gateway.extractJson(parsed.request)
      : await built.gateway.generate(parsed.request);

    await writeRun(admin, tenantId, {
      status: 'success',
      profile: parsed.request.model_profile,
      provider: response.provider,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      durationMs: response.latency_ms ?? (Date.now() - started),
      residency: ctx.residency,
      stage: ctx.stage,
      pdp: pep.result?.decision ?? pep.mode,
      traceId: response.trace_id,
    });
    if (quotaKey) {
      try {
        await recordUsage(admin, tenantId, quotaKey, 1, { feature: TOOL_KEY, stage: ctx.stage });
      } catch (e) {
        console.error('[governance-router] recordUsage failed', e);
      }
    }

    const completion = formatChatResponse(
      response,
      parsed.request.model_profile,
      Date.now(),
      { requestedModel: parsed.requestedModel, governance: meta },
    );

    if (body.stream === true) {
      return new Response(formatChatSse(completion), {
        status: 200,
        headers: {
          ...corsHeaders,
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
        },
      });
    }
    return jsonResponse(completion, 200, corsHeaders);
  } catch (error) {
    const mapped = mapInferenceError(error);
    await writeRun(admin, tenantId, {
      status: 'error',
      profile: parsed.request.model_profile,
      provider: null,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - started,
      residency: ctx.residency,
      stage: ctx.stage,
      pdp: pep.result?.decision ?? pep.mode,
      traceId: null,
      errorCode: mapped.code,
    });
    return err(mapped.status, mapped.code, mapped.message);
  }
}

async function writeRun(
  admin: SupabaseClient,
  tenantId: string,
  row: {
    status: 'success' | 'error';
    profile: string;
    provider: string | null;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    residency: AiResidency;
    stage: ExpansionStage;
    pdp: string;
    traceId: string | null;
    errorCode?: string;
  },
): Promise<void> {
  // Kein Prompt, kein Input, keine Messages — nur Betriebsmerkmale.
  const { error } = await admin.from('ai_tool_runs').insert({
    tenant_id: tenantId,
    tool_id: null,
    tool_key: TOOL_KEY,
    user_id: null,
    input_tokens: row.inputTokens,
    output_tokens: row.outputTokens,
    cached_tokens: 0,
    cost_usd: 0,
    duration_ms: row.durationMs,
    status: row.status,
    error_code: row.errorCode ?? null,
    metadata: {
      feature: TOOL_KEY,
      profile: row.profile,
      provider: row.provider,
      residency: row.residency,
      stage: row.stage,
      pdp: row.pdp,
      trace_id: row.traceId,
      error_code: row.errorCode ?? null,
    },
  });
  if (error) console.error('[governance-router] ai_tool_runs insert failed', error.message);
}

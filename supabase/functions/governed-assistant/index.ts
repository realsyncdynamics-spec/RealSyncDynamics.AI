/**
 * Governed assistant entry point for authenticated AI OS users.
 *
 * Fail-closed controls before ANY model request:
 * user JWT; tenant membership; current tenant residency policy; explicit
 * operator verification of EU runtime; fixed provider route; audit reservation.
 * Delegates inference to ai-gateway (no cloud fallback). No tenant data reads,
 * tool execution or provider selection from the client. Deployed only after
 * security review, residency verification and separate release approval.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonError, jsonResponse } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';
import { containsLikelyPersonalData, routeGovernedAssistant } from './policy.ts';

const MAX_PROMPT_LENGTH = 8_000;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const TASK_SYSTEM_PROMPTS: Record<string, string> = {
  general: 'Du bist RealSync AI. Hilf präzise und transparent. Keine behaupteten Aktionen oder nachgewiesene Rechtsberatung. Fordere keine persönlichen Daten an.',
  web: 'Du unterstützt bei Websites und Design. Erstelle nur Vorschläge, keine externen Änderungen oder Veröffentlichungen.',
  governance: 'Du erläuterst Governance, Datenschutz und Kontrollen. Keine garantierte Konformität oder individuellen Rechtsgutachten.',
  compliance: 'Du erläuterst DSGVO und EU AI Act auf Basis der Nutzereingabe, ohne rechtliche Freigabe zu behaupten.',
  automation: 'Du planst Workflows und Automationen. Führe keine Tools oder Änderungen aus; verwende nur Vorschläge.',
};

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'Only POST is supported', corsHeaders);
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'Invalid JSON', corsHeaders);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonError(400, 'BAD_REQUEST', 'Invalid payload', corsHeaders);
  }
  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId) || !message || message.length > MAX_PROMPT_LENGTH) {
    return jsonError(400, 'BAD_REQUEST', 'Tenant and message (1–8000 characters) required', corsHeaders);
  }
  const authorization = req.headers.get('authorization') ?? '';
  const jwt = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]?.trim();
  if (!jwt || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    return jsonError(401, 'UNAUTHORIZED', 'Authenticated user session required', corsHeaders);
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: user, error: authError } = await userClient.auth.getUser(jwt);
  if (authError || !user.user) return jsonError(401, 'UNAUTHORIZED', 'Invalid user token', corsHeaders);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const [{ data: membership, error: membershipError }, { data: tenant, error: policyError }] = await Promise.all([
    admin.from('memberships').select('role').eq('tenant_id', tenantId).eq('user_id', user.user.id).maybeSingle(),
    admin.from('tenants').select('ai_data_residency_policy').eq('id', tenantId).maybeSingle(),
  ]);
  if (membershipError || !membership || policyError || !tenant) {
    return jsonError(403, 'FORBIDDEN', 'No verified tenant access or policy', corsHeaders);
  }
  // Defense in depth: obvious personal identifiers are refused even if the
  // caller has declared the content public/internal. Not a full classifier.
  if (containsLikelyPersonalData(message)) {
    return jsonError(403, 'POTENTIAL_PERSONAL_DATA', 'Mögliche personenbezogene Daten erkannt. Inhalt vor KI-Verarbeitung bereinigen und Rechtsgrundlage prüfen.', corsHeaders);
  }
  const route = routeGovernedAssistant({
    runtimeVerified: Deno.env.get('GOVERNED_ASSISTANT_EU_RUNTIME_VERIFIED') === 'true',
    tenantPolicy: String(tenant.ai_data_residency_policy ?? ''),
    purpose: body.purpose,
    dataClass: body.data_class,
    selection: body.selection,
  });
  if (!route.allowed) return jsonError(403, route.code, route.reason, corsHeaders);

  // Audit before inference: if metadata cannot be durably recorded, do not send.
  const traceId = crypto.randomUUID();
  const reserved = await audit(admin, {
    tenant_id: tenantId,
    actor_user_id: user.user.id,
    actor_email: user.user.email ?? null,
    action: 'assistant.route.authorized',
    target_type: 'ai_request',
    target_id: traceId,
    payload: {
      route: route.zone,
      model_profile: route.profile,
      purpose: body.purpose,
      declared_data_class: body.data_class,
      selection: body.selection,
      // Deliberately NO prompt, transcript, personal data or tool parameters.
    },
  });
  if (!reserved.ok) return jsonError(503, 'AUDIT_UNAVAILABLE', 'Auditable execution is currently unavailable', corsHeaders);

  // ai-gateway is configured without Anthropic/OpenAI fallback. The selected
  // local profile is server-fixed; raw client model IDs never reach it.
  let gatewayResponse: Response;
  try {
    gatewayResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai-gateway`, {
      method: 'POST',
      headers: {
        authorization,
        apikey: SUPABASE_ANON_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        op: 'generate',
        tenant_id: tenantId,
        feature: 'governed_assistant',
        task_type: 'chat',
        model_profile: route.profile,
        input: message,
        system_prompt: TASK_SYSTEM_PROMPTS[String(body.purpose)],
        max_tokens: 900,
        trace_id: traceId,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return jsonError(503, 'LOCAL_PROVIDER_UNAVAILABLE', 'EU runtime not reachable', corsHeaders);
  }
  if (!gatewayResponse.ok) {
    return jsonError(gatewayResponse.status, 'GATEWAY_REJECTED', 'The governed AI gateway rejected this request', corsHeaders);
  }
  let result: { ok?: boolean; output?: unknown; provider?: unknown; model?: unknown };
  try {
    result = await gatewayResponse.json() as typeof result;
  } catch {
    return jsonError(502, 'BAD_GATEWAY_RESPONSE', 'Invalid response from EU runtime', corsHeaders);
  }
  // This verifies the provider response for display; the actual residency
  // guarantee must come from deployment/network verification BEFORE this call.
  if (!result || result.ok !== true || (result.provider !== 'lm_studio' && result.provider !== 'ollama') || typeof result.output !== 'string') {
    return jsonError(502, 'UNEXPECTED_PROVIDER', 'Local provider response could not be verified', corsHeaders);
  }
  return jsonResponse({
    ok: true,
    output: result.output,
    route: 'eu_private',
    provider: result.provider,
    profile: route.profile,
    model: typeof result.model === 'string' ? result.model : null,
    trace_id: traceId,
  }, 200, corsHeaders);
});

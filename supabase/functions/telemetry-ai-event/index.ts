// telemetry-ai-event — Runtime-Event-Ingest fuer das AI-Governance-OS.
//
// POST /functions/v1/telemetry-ai-event
// Headers:
//   x-rsd-tenant-key: <tenant-API-key>     (Pflicht)
//   content-type:    application/json
//
// Body: AiTelemetryEventPayload (siehe src/sdk/telemetry.ts fuer Schema)
//
// Persistiert das Event in ai_runtime_events. Wenn risk_level >= 'high' ODER
// policy_status in ('warned','blocked','requires_approval'), wird zusaetzlich
// ein ai_evidence_events-Eintrag erzeugt — dadurch landet jedes auditrelevante
// Runtime-Event automatisch im Evidence-Vault.
//
// Auth: in dieser PR via einfachem x-rsd-tenant-key-Header (Tenant-Lookup).
// Folge-PR: HMAC-Signing + Replay-Protection.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  evaluatePolicies,
  type PolicyRule,
  type RuntimeEventInput,
} from '../_shared/policy-engine.ts';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const corsHeaders = buildCorsHeaders('POST, OPTIONS');
corsHeaders['Access-Control-Allow-Headers'] = 'content-type, x-rsd-tenant-key';

// ─── Schema-Validation ───────────────────────────────────────────────────────

const ALLOWED_EVENT_TYPES = new Set([
  'prompt_sent', 'response_received', 'agent_action',
  'file_upload', 'tool_call', 'session_start', 'session_end',
]);

const ALLOWED_PROMPT_CATEGORIES = new Set([
  'code_generation', 'content_generation', 'classification',
  'summarization', 'translation', 'extraction', 'agent_action',
  'analysis', 'qa', 'unknown',
]);

const ALLOWED_DATA_CLASSES = new Set([
  'public', 'internal', 'confidential', 'personal_data', 'special_category', 'unknown',
]);

const ALLOWED_RISK_LEVELS = new Set([
  'info', 'low', 'medium', 'high', 'critical',
]);

const ALLOWED_POLICY_STATUSES = new Set([
  'allowed', 'warned', 'blocked', 'requires_approval', 'logged',
]);

interface TelemetryPayload {
  ai_system_id?: string;
  vendor?: string;
  model?: string;
  user_id?: string;
  team?: string;
  event_type: string;
  prompt_category?: string;
  data_class?: string;
  risk_level?: string;
  policy_status?: string;
  policy_id?: string;
  prompt_tokens?: number;
  response_tokens?: number;
  latency_ms?: number;
  metadata?: Record<string, unknown>;
  occurred_at?: string;
}

interface ValidationResult {
  ok: boolean;
  errors?: string[];
}

function validate(payload: unknown): ValidationResult {
  const errors: string[] = [];
  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['payload must be an object'] };
  }
  const p = payload as Record<string, unknown>;

  if (typeof p.event_type !== 'string' || !ALLOWED_EVENT_TYPES.has(p.event_type)) {
    errors.push(`event_type must be one of ${[...ALLOWED_EVENT_TYPES].join(', ')}`);
  }
  if (p.prompt_category !== undefined && (
    typeof p.prompt_category !== 'string' || !ALLOWED_PROMPT_CATEGORIES.has(p.prompt_category)
  )) {
    errors.push('prompt_category invalid');
  }
  if (p.data_class !== undefined && (
    typeof p.data_class !== 'string' || !ALLOWED_DATA_CLASSES.has(p.data_class)
  )) {
    errors.push('data_class invalid');
  }
  if (p.risk_level !== undefined && (
    typeof p.risk_level !== 'string' || !ALLOWED_RISK_LEVELS.has(p.risk_level)
  )) {
    errors.push('risk_level invalid');
  }
  if (p.policy_status !== undefined && (
    typeof p.policy_status !== 'string' || !ALLOWED_POLICY_STATUSES.has(p.policy_status)
  )) {
    errors.push('policy_status invalid');
  }
  if (p.metadata !== undefined && (typeof p.metadata !== 'object' || Array.isArray(p.metadata))) {
    errors.push('metadata must be a plain object');
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return jsonError(405, 'BAD_METHOD', 'POST only', corsHeaders);
  }

  const tenantKey = req.headers.get('x-rsd-tenant-key');
  if (!tenantKey) {
    return jsonError(401, 'UNAUTHORIZED', 'missing x-rsd-tenant-key', corsHeaders);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, 'BAD_JSON', 'request body must be valid JSON', corsHeaders);
  }

  const validation = validate(payload);
  if (!validation.ok) {
    return jsonError(400, 'VALIDATION', validation.errors!.join(' · '), corsHeaders);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Tenant-Lookup ueber API-Key. In dieser PR existiert die tenant_api_keys-
  // Tabelle noch nicht — fallback ist tenant_id direkt im Header. Folge-PR
  // ergaenzt die Lookup-Tabelle + HMAC-Signing.
  const tenantId = tenantKey.match(/^[0-9a-f-]{36}$/i) ? tenantKey : null;
  if (!tenantId) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid tenant key (expected uuid in this PR)', corsHeaders);
  }

  const p = payload as TelemetryPayload;

  // ─── Policy-Evaluation ─────────────────────────────────────────────────
  // Laedt enabled Policies fuer diesen Tenant (oder global, tenant_id IS NULL)
  // und ueberschreibt das policy_status-Feld mit dem Engine-Verdict.
  // Bei Fehler beim Policy-Laden: gracefully fallback auf event-incoming oder
  // 'logged' — Telemetry darf nicht failen, weil Policies temp. nicht erreichbar.
  let enginePolicyStatus: string = p.policy_status ?? 'logged';
  let enginePolicyId: string | undefined;
  try {
    const { data: policiesData } = await admin
      .from('ai_policies')
      .select('id, name, rule_type, action, enabled, condition')
      .eq('enabled', true)
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

    if (policiesData && policiesData.length > 0) {
      const policies = policiesData as unknown as PolicyRule[];
      const eventForEngine: RuntimeEventInput = {
        vendor: p.vendor,
        model: p.model,
        event_type: p.event_type as RuntimeEventInput['event_type'],
        prompt_category: p.prompt_category as RuntimeEventInput['prompt_category'],
        data_class: p.data_class as RuntimeEventInput['data_class'],
        risk_level: p.risk_level as RuntimeEventInput['risk_level'],
        ai_system_id: p.ai_system_id,
      };
      const verdict = evaluatePolicies(eventForEngine, policies);
      enginePolicyStatus = verdict.status;
      enginePolicyId = verdict.matched_policy_id;
    }
  } catch (e) {
    console.error('[telemetry-ai-event] policy-engine error', e);
    // weiter mit eingehendem policy_status oder 'logged' default
  }

  const { data: insertedEvent, error: insertErr } = await admin
    .from('ai_runtime_events')
    .insert({
      tenant_id: tenantId,
      ai_system_id: p.ai_system_id ?? null,
      vendor: p.vendor ?? null,
      model: p.model ?? null,
      user_id: p.user_id ?? null,
      team: p.team ?? null,
      event_type: p.event_type,
      prompt_category: p.prompt_category ?? 'unknown',
      data_class: p.data_class ?? 'unknown',
      risk_level: p.risk_level ?? 'info',
      policy_status: enginePolicyStatus,
      policy_id: enginePolicyId ?? p.policy_id ?? null,
      prompt_tokens: p.prompt_tokens ?? null,
      response_tokens: p.response_tokens ?? null,
      latency_ms: p.latency_ms ?? null,
      metadata: p.metadata ?? {},
      occurred_at: p.occurred_at ?? new Date().toISOString(),
    })
    .select('id, risk_level, policy_status, ai_system_id, policy_id, event_type')
    .single();

  if (insertErr || !insertedEvent) {
    return jsonError(500, 'INSERT_FAILED', insertErr?.message ?? 'unknown insert error', corsHeaders);
  }

  // Auto-Evidence: hohe Risiken oder Policy-Verletzungen landen im Vault.
  const shouldCreateEvidence =
    insertedEvent.risk_level === 'high' ||
    insertedEvent.risk_level === 'critical' ||
    ['warned', 'blocked', 'requires_approval'].includes(insertedEvent.policy_status);

  if (shouldCreateEvidence) {
    await admin.from('ai_evidence_events').insert({
      tenant_id: tenantId,
      ai_system_id: insertedEvent.ai_system_id,
      policy_id: insertedEvent.policy_id,
      event_type: `runtime:${insertedEvent.event_type}`,
      event_summary: buildEvidenceSummary(insertedEvent.risk_level, insertedEvent.policy_status, p),
      risk_level: insertedEvent.risk_level,
      evidence: {
        runtime_event_id: insertedEvent.id,
        vendor: p.vendor,
        model: p.model,
        prompt_category: p.prompt_category,
        data_class: p.data_class,
        ...p.metadata,
      },
    });
  }

  return jsonResponse({
    ok: true,
    event_id: insertedEvent.id,
    policy_status: enginePolicyStatus,
    policy_id: enginePolicyId ?? null,
  }, 200, corsHeaders);
});

function buildEvidenceSummary(
  risk: string,
  policy: string,
  p: TelemetryPayload,
): string {
  const subject = `${p.vendor ?? 'unknown vendor'} / ${p.model ?? 'unknown model'}`;
  if (policy === 'blocked') return `${subject} — Policy blockiert (${p.event_type})`;
  if (policy === 'requires_approval') return `${subject} — Approval erforderlich (${p.event_type})`;
  if (policy === 'warned') return `${subject} — Policy-Warnung (${p.event_type})`;
  if (risk === 'critical') return `${subject} — Critical Runtime Event (${p.event_type})`;
  if (risk === 'high') return `${subject} — High-Risk Runtime Event (${p.event_type})`;
  return `${subject} — Runtime Event (${p.event_type})`;
}


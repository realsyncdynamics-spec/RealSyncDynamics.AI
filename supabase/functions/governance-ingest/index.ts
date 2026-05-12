// Governance Telemetry Ingestion API + Policy Engine + Webhooks.
//
// POST /functions/v1/governance-ingest
// Authorization: Bearer rsd_gov_<token>
// Content-Type: application/json
//
// Body shapes:
//   Single:  { event: EventInput, evidence?: EvidenceInput[] }
//   Batch:   { events: Array<{ event: EventInput, evidence?: EvidenceInput[] }> }
//
// Flow:
//   1. API-key lookup (sha256 of `rsd_gov_…` against governance_ingest_keys)
//   2. Validate every event + evidence input
//   3. Cross-tenant guard on asset_id / policy_id
//   4. Policy evaluation (v1: minimal condition matcher in _shared/policyEngine.ts)
//      — caller's `policy_id` + `policy_action` hints get OVERRIDDEN by the engine
//        when a policy matches the event. Engine choice = source of truth.
//      — strictest action wins: block > require_approval > warn > log > allow
//   5. Insert events
//   6. Insert caller-supplied evidence + auto `policy_snapshot` evidence for every
//      event that the engine matched
//   7. Stamp `last_used_at` on the API key
//   8. Fire enabled tenant webhooks whose `min_risk_level` is matched by the
//      event (HMAC-SHA256 signed payload, 3s timeout, last_status persisted).
//      Best-effort: never blocks the API response on webhook failure.
//
// Verify_jwt is false on this function — auth is API-key based.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sha256Hex } from '../_shared/hash.ts';
import {
  evaluatePolicies,
  type AssetForEval,
  type PolicyDecision,
  type PolicyRow,
} from '../_shared/policyEngine.ts';
import {
  detectFormat,
  formatPayload,
  type WebhookEnvelope,
} from '../_shared/webhookFormat.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_SOURCES = [
  'website_scanner', 'browser_extension', 'sdk', 'api',
  'github', 'ci_cd', 'manual', 'agent_runtime',
] as const;
type EventSource = typeof ALLOWED_SOURCES[number];

const ALLOWED_RISK = ['info', 'low', 'medium', 'high', 'critical'] as const;
type RiskLevel = typeof ALLOWED_RISK[number];

const ALLOWED_ACTION = ['allow', 'log', 'warn', 'block', 'require_approval'] as const;
type PolicyAction = typeof ALLOWED_ACTION[number];

const ALLOWED_EVIDENCE_TYPE = [
  'screenshot', 'har', 'json', 'log', 'pdf',
  'hash', 'policy_snapshot', 'approval', 'pull_request',
] as const;
type EvidenceType = typeof ALLOWED_EVIDENCE_TYPE[number];

interface EventInput {
  asset_id?: string;
  policy_id?: string;
  event_type: string;
  event_source: EventSource;
  title: string;
  summary?: string;
  risk_level?: RiskLevel;
  actor_email?: string;
  vendor?: string;
  model_name?: string;
  data_types?: string[];
  policy_action?: PolicyAction;
  payload?: Record<string, unknown>;
}

interface EvidenceInput {
  evidence_type: EvidenceType;
  title: string;
  storage_path?: string;
  content_hash?: string;
  previous_hash?: string;
  metadata?: Record<string, unknown>;
}

interface IngestItem {
  event: EventInput;
  evidence?: EvidenceInput[];
}

const MAX_BATCH = 50;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');
  }
  const token = auth.slice('Bearer '.length).trim();
  if (!token.startsWith('rsd_gov_')) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid token prefix');
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  const tokenHash = await sha256Hex(token);
  const { data: keyRow, error: keyErr } = await admin
    .from('governance_ingest_keys')
    .select('id, tenant_id, allowed_sources, revoked_at')
    .eq('key_hash', tokenHash)
    .maybeSingle();
  if (keyErr) return jsonError(500, 'INTERNAL', keyErr.message);
  if (!keyRow) return jsonError(401, 'UNAUTHORIZED', 'unknown token');
  if (keyRow.revoked_at) return jsonError(401, 'UNAUTHORIZED', 'token revoked');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const items = normalizeItems(body);
  if (!items) return jsonError(400, 'BAD_REQUEST', 'expected { event } or { events: [...] }');
  if (items.length === 0) return jsonError(400, 'BAD_REQUEST', 'empty batch');
  if (items.length > MAX_BATCH) {
    return jsonError(400, 'BATCH_TOO_LARGE', `max ${MAX_BATCH} events per request`);
  }

  const allowedSources = (keyRow.allowed_sources ?? []) as string[];
  for (let i = 0; i < items.length; i++) {
    const v = validateEvent(items[i].event, allowedSources);
    if (v) return jsonError(400, 'BAD_REQUEST', `events[${i}]: ${v}`);
    if (items[i].evidence) {
      for (let j = 0; j < items[i].evidence!.length; j++) {
        const ev = validateEvidence(items[i].evidence![j]);
        if (ev) return jsonError(400, 'BAD_REQUEST', `events[${i}].evidence[${j}]: ${ev}`);
      }
    }
  }

  // Cross-tenant guard + fetch full asset rows for policy evaluation
  const assetIds = uniq(items.map((i) => i.event.asset_id).filter((x): x is string => !!x));
  const policyIds = uniq(items.map((i) => i.event.policy_id).filter((x): x is string => !!x));
  const assetsById = new Map<string, AssetForEval>();

  if (assetIds.length > 0) {
    const { data: assets, error } = await admin
      .from('governance_assets')
      .select('id, tenant_id, asset_type, ai_act_class, data_types, vendor')
      .in('id', assetIds);
    if (error) return jsonError(500, 'INTERNAL', error.message);
    const wrong = (assets ?? []).find((a) => a.tenant_id !== keyRow.tenant_id);
    if (wrong) return jsonError(403, 'CROSS_TENANT', `asset ${wrong.id} belongs to another tenant`);
    for (const a of assets ?? []) {
      assetsById.set(a.id, {
        id: a.id,
        asset_type: a.asset_type,
        ai_act_class: a.ai_act_class,
        data_types: a.data_types ?? [],
        vendor: a.vendor,
      });
    }
    const missing = assetIds.find((id) => !assetsById.has(id));
    if (missing) return jsonError(404, 'NOT_FOUND', `asset ${missing} not found`);
  }

  if (policyIds.length > 0) {
    const { data: policies, error } = await admin
      .from('governance_policies')
      .select('id, tenant_id')
      .in('id', policyIds);
    if (error) return jsonError(500, 'INTERNAL', error.message);
    const wrong = (policies ?? []).find((p) => p.tenant_id !== keyRow.tenant_id);
    if (wrong) return jsonError(403, 'CROSS_TENANT', `policy ${wrong.id} belongs to another tenant`);
    const found = new Set((policies ?? []).map((p) => p.id));
    const missing = policyIds.find((id) => !found.has(id));
    if (missing) return jsonError(404, 'NOT_FOUND', `policy ${missing} not found`);
  }

  // Policy engine: fetch all enabled tenant policies and evaluate per event
  const { data: tenantPolicies, error: polErr } = await admin
    .from('governance_policies')
    .select('id, tenant_id, policy_type, severity, action, condition, enabled')
    .eq('tenant_id', keyRow.tenant_id)
    .eq('enabled', true);
  if (polErr) return jsonError(500, 'INTERNAL', polErr.message);

  const policiesForEval = (tenantPolicies ?? []) as PolicyRow[];
  const decisions: Array<PolicyDecision | null> = items.map((i) => {
    const asset = i.event.asset_id ? assetsById.get(i.event.asset_id) ?? null : null;
    return evaluatePolicies(
      {
        event_type: i.event.event_type,
        event_source: i.event.event_source,
        vendor: i.event.vendor ?? null,
        model_name: i.event.model_name ?? null,
        data_types: i.event.data_types ?? [],
        risk_level: i.event.risk_level ?? 'info',
        payload: i.event.payload ?? {},
      },
      asset,
      policiesForEval,
    );
  });

  // Stamp policy_id + policy_action from the engine's decision when one matches;
  // otherwise leave caller-supplied hint values intact.
  const eventRows = items.map((i, idx) => {
    const decision = decisions[idx];
    return {
      tenant_id: keyRow.tenant_id,
      asset_id: i.event.asset_id ?? null,
      policy_id: decision?.policy_id ?? i.event.policy_id ?? null,
      event_type: i.event.event_type,
      event_source: i.event.event_source,
      title: i.event.title,
      summary: i.event.summary ?? null,
      risk_level: i.event.risk_level ?? 'info',
      actor_email: i.event.actor_email ?? null,
      vendor: i.event.vendor ?? null,
      model_name: i.event.model_name ?? null,
      data_types: i.event.data_types ?? [],
      policy_action: decision?.action ?? i.event.policy_action ?? null,
      payload: i.event.payload ?? {},
    };
  });

  const { data: insertedEvents, error: insertErr } = await admin
    .from('governance_events')
    .insert(eventRows)
    .select('id');
  if (insertErr) return jsonError(500, 'INSERT_FAILED', insertErr.message);

  // Caller-supplied evidence + auto policy_snapshot for every engine-matched event
  const evidenceRows: Array<Record<string, unknown>> = [];
  insertedEvents!.forEach((ev, idx) => {
    const caller = items[idx].evidence ?? [];
    for (const e of caller) {
      evidenceRows.push({
        tenant_id: keyRow.tenant_id,
        event_id: ev.id,
        asset_id: items[idx].event.asset_id ?? null,
        evidence_type: e.evidence_type,
        title: e.title,
        storage_path: e.storage_path ?? null,
        content_hash: e.content_hash ?? null,
        previous_hash: e.previous_hash ?? null,
        metadata: e.metadata ?? {},
      });
    }
    const decision = decisions[idx];
    if (decision) {
      evidenceRows.push({
        tenant_id: keyRow.tenant_id,
        event_id: ev.id,
        asset_id: items[idx].event.asset_id ?? null,
        evidence_type: 'policy_snapshot',
        title: `Policy decision: ${decision.action}`,
        storage_path: null,
        content_hash: null,
        previous_hash: null,
        metadata: {
          policy_id: decision.policy_id,
          action: decision.action,
          engine_version: 1,
        },
      });
    }
  });

  let insertedEvidence: Array<{ id: string }> = [];
  if (evidenceRows.length > 0) {
    const { data: ev, error: evErr } = await admin
      .from('governance_evidence')
      .insert(evidenceRows)
      .select('id');
    if (evErr) return jsonError(500, 'EVIDENCE_INSERT_FAILED', evErr.message);
    insertedEvidence = ev ?? [];
  }

  await admin
    .from('governance_ingest_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id);

  const policyDecisions = insertedEvents!.map((ev, idx) => {
    const d = decisions[idx];
    return d ? { event_id: ev.id, policy_id: d.policy_id, action: d.action } : null;
  }).filter((x): x is { event_id: string; policy_id: string; action: PolicyAction } => x !== null);

  // Best-effort outbound webhooks. We await so the cross-tenant
  // guarantees hold, but each delivery is independently bounded
  // by a 3 s timeout and any failure is recorded on the row.
  let webhook_deliveries = 0;
  try {
    webhook_deliveries = await fireWebhooks(admin, keyRow.tenant_id, items, insertedEvents!, decisions);
  } catch {
    /* swallow — webhook errors must not fail ingest */
  }

  return json({
    ok: true,
    event_ids: insertedEvents!.map((e) => e.id),
    evidence_ids: insertedEvidence.map((e) => e.id),
    policy_decisions: policyDecisions,
    webhook_deliveries,
  });
});

const RISK_RANK: Record<string, number> = {
  info: 0, low: 1, medium: 2, high: 3, critical: 4,
};

interface WebhookRow {
  id: string;
  target_url: string;
  secret_hash: string;
  min_risk_level: string;
}

// deno-lint-ignore no-explicit-any
async function fireWebhooks(
  admin: any,
  tenantId: string,
  items: IngestItem[],
  insertedEvents: Array<{ id: string }>,
  decisions: Array<PolicyDecision | null>,
): Promise<number> {
  const { data: hooks, error } = await admin
    .from('governance_webhooks')
    .select('id, target_url, secret_hash, min_risk_level')
    .eq('tenant_id', tenantId)
    .eq('enabled', true)
    .is('revoked_at', null);
  if (error || !hooks || hooks.length === 0) return 0;

  const deliveries: Array<Promise<unknown>> = [];
  for (const hook of hooks as WebhookRow[]) {
    const minRank = RISK_RANK[hook.min_risk_level] ?? 3;
    for (let i = 0; i < items.length; i++) {
      const event = items[i].event;
      const eventRank = RISK_RANK[event.risk_level ?? 'info'] ?? 0;
      if (eventRank < minRank) continue;
      const decision = decisions[i];
      const envelope: WebhookEnvelope = {
        event_id: insertedEvents[i].id,
        tenant_id: tenantId,
        event: {
          event_type: event.event_type,
          event_source: event.event_source,
          title: event.title,
          summary: event.summary,
          risk_level: event.risk_level,
          vendor: event.vendor,
          model_name: event.model_name,
          data_types: event.data_types,
          policy_action: event.policy_action,
          payload: event.payload,
        },
        decision: decision ?? null,
      };
      deliveries.push(deliverOne(admin, hook, envelope));
    }
  }
  if (deliveries.length === 0) return 0;
  await Promise.allSettled(deliveries);
  return deliveries.length;
}

// deno-lint-ignore no-explicit-any
async function deliverOne(admin: any, hook: WebhookRow, envelope: WebhookEnvelope): Promise<void> {
  const format = detectFormat(hook.target_url);
  const bodyText = formatPayload(envelope, format);
  const signature = await hmacSha256Hex(hook.secret_hash, bodyText);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  let status: number | null = null;
  let errorMsg: string | null = null;
  try {
    const res = await fetch(hook.target_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RSD-Signature': `sha256=${signature}`,
        'X-RSD-Event-Id': envelope.event_id,
        'X-RSD-Format': format,
        'User-Agent': 'RealSyncDynamics-Governance/1.0',
      },
      body: bodyText,
      signal: controller.signal,
    });
    status = res.status;
    if (!res.ok) {
      errorMsg = (await res.text().catch(() => '')).slice(0, 500) || `HTTP ${res.status}`;
    }
  } catch (e) {
    errorMsg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
  } finally {
    clearTimeout(timeout);
  }

  await admin.from('governance_webhooks').update({
    last_called_at: new Date().toISOString(),
    last_status: status,
    last_error: errorMsg,
  }).eq('id', hook.id);
}

async function hmacSha256Hex(keyHex: string, message: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(keyHex);
  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/* ── Helpers ─────────────────────────────────────────────────── */

function normalizeItems(body: Record<string, unknown>): IngestItem[] | null {
  if (Array.isArray(body.events)) return body.events as IngestItem[];
  if (body.event && typeof body.event === 'object') {
    return [{ event: body.event as EventInput, evidence: body.evidence as EvidenceInput[] | undefined }];
  }
  return null;
}

function validateEvent(e: EventInput, allowedSources: string[]): string | null {
  if (!e || typeof e !== 'object') return 'event must be an object';
  if (typeof e.event_type !== 'string' || !e.event_type) return 'event_type required';
  if (typeof e.title !== 'string' || !e.title)           return 'title required';
  if (!ALLOWED_SOURCES.includes(e.event_source as EventSource)) {
    return `event_source must be one of ${ALLOWED_SOURCES.join('|')}`;
  }
  if (allowedSources.length > 0 && !allowedSources.includes(e.event_source)) {
    return `event_source ${e.event_source} not permitted for this key`;
  }
  if (e.risk_level && !ALLOWED_RISK.includes(e.risk_level as RiskLevel)) {
    return `risk_level must be one of ${ALLOWED_RISK.join('|')}`;
  }
  if (e.policy_action && !ALLOWED_ACTION.includes(e.policy_action as PolicyAction)) {
    return `policy_action must be one of ${ALLOWED_ACTION.join('|')}`;
  }
  if (e.data_types && !Array.isArray(e.data_types))    return 'data_types must be string[]';
  if (e.payload && typeof e.payload !== 'object')      return 'payload must be an object';
  return null;
}

function validateEvidence(e: EvidenceInput): string | null {
  if (!e || typeof e !== 'object') return 'evidence must be an object';
  if (typeof e.title !== 'string' || !e.title) return 'title required';
  if (!ALLOWED_EVIDENCE_TYPE.includes(e.evidence_type as EvidenceType)) {
    return `evidence_type must be one of ${ALLOWED_EVIDENCE_TYPE.join('|')}`;
  }
  if (e.metadata && typeof e.metadata !== 'object') return 'metadata must be an object';
  return null;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}

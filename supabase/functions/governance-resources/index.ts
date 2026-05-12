// Governance Resources — Asset / Policy CRUD.
//
// POST /functions/v1/governance-resources
// Authorization: Bearer <user JWT>
// Body shapes:
//   { op: 'create_asset',     tenant_id, asset_type, name, ... }
//   { op: 'archive_asset',    asset_id }
//   { op: 'create_policy',    tenant_id, name, policy_type, severity, action, condition, ... }
//   { op: 'toggle_policy',    policy_id, enabled }
//   { op: 'upsert_mapping',   asset_id, control_id, status, notes?, evidence_id? }
//   { op: 'delete_mapping',   mapping_id }
//
// Owner / admin gated against `public.memberships`. Reads are
// handled directly by the frontend via Supabase + tenant-RLS
// (PR #139). Updates / deletes beyond the two state-only ops here
// are deferred until pilot signal shows what fields need
// editing in-place.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { audit } from '../_shared/auditLog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ASSET_TYPES = ['website', 'ai_system', 'vendor', 'model', 'agent', 'api', 'dataset', 'repository', 'workflow'];
const AI_ACT_CLASSES = ['minimal', 'limited', 'high', 'prohibited', 'unknown'];
const POLICY_TYPES = ['data_transfer', 'model_usage', 'human_review', 'logging_required', 'vendor_restriction', 'retention', 'security', 'ai_act', 'gdpr'];
const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'];
const ACTIONS = ['allow', 'log', 'warn', 'block', 'require_approval'];
const CONTROL_STATUSES = ['not_started', 'in_progress', 'implemented', 'gap', 'not_applicable'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  try {
    switch (body.op) {
      case 'create_asset':    return await createAsset(admin, userId, userEmail, body);
      case 'archive_asset':   return await archiveAsset(admin, userId, userEmail, body);
      case 'create_policy':   return await createPolicy(admin, userId, userEmail, body);
      case 'toggle_policy':   return await togglePolicy(admin, userId, userEmail, body);
      case 'upsert_mapping':  return await upsertMapping(admin, userId, userEmail, body);
      case 'delete_mapping':  return await deleteMapping(admin, userId, userEmail, body);
      default: return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

// deno-lint-ignore no-explicit-any
async function createAsset(admin: any, userId: string, userEmail: string | null, b: Record<string, unknown>) {
  const tenant_id = b.tenant_id as string;
  const asset_type = b.asset_type as string;
  const name = (b.name as string ?? '').trim();
  if (!tenant_id || !name || !asset_type) return jsonError(400, 'BAD_REQUEST', 'tenant_id, name, asset_type required');
  if (!ASSET_TYPES.includes(asset_type)) return jsonError(400, 'BAD_REQUEST', `asset_type must be one of ${ASSET_TYPES.join('|')}`);
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be owner or admin');

  const ai_act_class = (b.ai_act_class as string) ?? 'unknown';
  if (!AI_ACT_CLASSES.includes(ai_act_class)) return jsonError(400, 'BAD_REQUEST', `ai_act_class must be one of ${AI_ACT_CLASSES.join('|')}`);

  const data_types = Array.isArray(b.data_types) ? (b.data_types as string[]).map(String) : [];
  const risk_score = clampInt(b.risk_score, 0, 0, 100);

  const { data, error } = await admin.from('governance_assets').insert({
    tenant_id,
    asset_type,
    name: name.slice(0, 200),
    description: (b.description as string ?? null)?.toString().slice(0, 2000) ?? null,
    owner_email: (b.owner_email as string ?? null)?.toString().slice(0, 254) ?? null,
    vendor: (b.vendor as string ?? null)?.toString().slice(0, 200) ?? null,
    system_url: (b.system_url as string ?? null)?.toString().slice(0, 500) ?? null,
    data_types,
    risk_score,
    ai_act_class,
    status: 'active',
    metadata: (b.metadata && typeof b.metadata === 'object') ? b.metadata : {},
  }).select('*').single();
  if (error) throw error;
  await audit(admin, { tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'asset.create', target_type: 'governance_asset', target_id: data.id, payload: { name: data.name, asset_type, ai_act_class } });
  return json({ ok: true, asset: data });
}

// deno-lint-ignore no-explicit-any
async function archiveAsset(admin: any, userId: string, userEmail: string | null, b: Record<string, unknown>) {
  const asset_id = b.asset_id as string;
  if (!asset_id) return jsonError(400, 'BAD_REQUEST', 'asset_id required');

  const { data: row } = await admin.from('governance_assets')
    .select('tenant_id, status').eq('id', asset_id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'asset not found');
  if (row.status === 'archived') return json({ ok: true, already_archived: true });
  if (!(await isOwnerOrAdmin(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be owner or admin');

  const { error } = await admin.from('governance_assets').update({ status: 'archived' }).eq('id', asset_id);
  if (error) throw error;
  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'asset.archive', target_type: 'governance_asset', target_id: asset_id, payload: {} });
  return json({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function createPolicy(admin: any, userId: string, userEmail: string | null, b: Record<string, unknown>) {
  const tenant_id = b.tenant_id as string;
  const name = (b.name as string ?? '').trim();
  const policy_type = b.policy_type as string;
  const severity = (b.severity as string) ?? 'medium';
  const action = (b.action as string) ?? 'warn';
  const condition = (b.condition && typeof b.condition === 'object') ? b.condition : {};

  if (!tenant_id || !name || !policy_type) return jsonError(400, 'BAD_REQUEST', 'tenant_id, name, policy_type required');
  if (!POLICY_TYPES.includes(policy_type)) return jsonError(400, 'BAD_REQUEST', `policy_type must be one of ${POLICY_TYPES.join('|')}`);
  if (!SEVERITIES.includes(severity))      return jsonError(400, 'BAD_REQUEST', `severity must be one of ${SEVERITIES.join('|')}`);
  if (!ACTIONS.includes(action))           return jsonError(400, 'BAD_REQUEST', `action must be one of ${ACTIONS.join('|')}`);
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be owner or admin');

  const { data, error } = await admin.from('governance_policies').insert({
    tenant_id,
    name: name.slice(0, 200),
    description: (b.description as string ?? null)?.toString().slice(0, 2000) ?? null,
    policy_type,
    severity,
    action,
    condition,
    enabled: b.enabled === false ? false : true,
  }).select('*').single();
  if (error) throw error;
  await audit(admin, { tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'policy.create', target_type: 'governance_policy', target_id: data.id, payload: { name: data.name, policy_type, severity, action } });
  return json({ ok: true, policy: data });
}

// deno-lint-ignore no-explicit-any
async function togglePolicy(admin: any, userId: string, userEmail: string | null, b: Record<string, unknown>) {
  const policy_id = b.policy_id as string;
  const enabled = b.enabled !== false;
  if (!policy_id) return jsonError(400, 'BAD_REQUEST', 'policy_id required');

  const { data: row } = await admin.from('governance_policies')
    .select('tenant_id, enabled').eq('id', policy_id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'policy not found');
  if (!(await isOwnerOrAdmin(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be owner or admin');

  const { error } = await admin.from('governance_policies').update({ enabled }).eq('id', policy_id);
  if (error) throw error;
  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: enabled ? 'policy.enable' : 'policy.disable', target_type: 'governance_policy', target_id: policy_id, payload: { enabled } });
  return json({ ok: true, enabled });
}

// deno-lint-ignore no-explicit-any
async function upsertMapping(admin: any, userId: string, userEmail: string | null, b: Record<string, unknown>) {
  const asset_id = b.asset_id as string;
  const control_id = b.control_id as string;
  const status = (b.status as string) ?? 'not_started';
  const notes = (b.notes as string ?? null)?.toString().slice(0, 2000) ?? null;
  const evidence_id = (b.evidence_id as string) ?? null;

  if (!asset_id || !control_id) return jsonError(400, 'BAD_REQUEST', 'asset_id and control_id required');
  if (!CONTROL_STATUSES.includes(status)) {
    return jsonError(400, 'BAD_REQUEST', `status must be one of ${CONTROL_STATUSES.join('|')}`);
  }

  const { data: asset } = await admin.from('governance_assets')
    .select('tenant_id').eq('id', asset_id).maybeSingle();
  if (!asset) return jsonError(404, 'NOT_FOUND', 'asset not found');
  if (!(await isOwnerOrAdmin(admin, userId, asset.tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  const { data: ctrl } = await admin.from('framework_controls')
    .select('id').eq('id', control_id).maybeSingle();
  if (!ctrl) return jsonError(404, 'NOT_FOUND', 'control not found');

  if (evidence_id) {
    const { data: ev } = await admin.from('governance_evidence')
      .select('tenant_id').eq('id', evidence_id).maybeSingle();
    if (!ev) return jsonError(404, 'NOT_FOUND', 'evidence not found');
    if (ev.tenant_id !== asset.tenant_id) return jsonError(403, 'CROSS_TENANT', 'evidence belongs to another tenant');
  }

  const { data, error } = await admin.from('asset_control_mappings')
    .upsert({ asset_id, control_id, status, notes, evidence_id }, { onConflict: 'asset_id,control_id' })
    .select('*').single();
  if (error) throw error;
  await audit(admin, { tenant_id: asset.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'mapping.upsert', target_type: 'asset_control_mapping', target_id: data.id, payload: { asset_id, control_id, status } });
  return json({ ok: true, mapping: data });
}

// deno-lint-ignore no-explicit-any
async function deleteMapping(admin: any, userId: string, userEmail: string | null, b: Record<string, unknown>) {
  const mapping_id = b.mapping_id as string;
  if (!mapping_id) return jsonError(400, 'BAD_REQUEST', 'mapping_id required');

  const { data: row } = await admin.from('asset_control_mappings')
    .select('asset_id').eq('id', mapping_id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'mapping not found');

  const { data: asset } = await admin.from('governance_assets')
    .select('tenant_id').eq('id', row.asset_id).maybeSingle();
  if (!asset) return jsonError(404, 'NOT_FOUND', 'asset not found');
  if (!(await isOwnerOrAdmin(admin, userId, asset.tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  const { error } = await admin.from('asset_control_mappings').delete().eq('id', mapping_id);
  if (error) throw error;
  await audit(admin, { tenant_id: asset.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'mapping.delete', target_type: 'asset_control_mapping', target_id: mapping_id, payload: {} });
  return json({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function isOwnerOrAdmin(admin: any, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships')
    .select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return data?.role === 'owner' || data?.role === 'admin';
}

function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
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

// Governance DPIAs — CRUD for Data Protection Impact Assessments.
//
// POST /functions/v1/governance-dpias
// Authorization: Bearer <user JWT>
// op: list (tenant_id) | create (tenant_id, asset_id?, title, ...) | update (id, ...) | approve (id, approved_by)
//
// Owner/admin gated via memberships.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { audit } from '../_shared/auditLog.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

interface SupabaseAdminClient {
  from(table: string): {
    select(columns: string): {
      eq(col: string, val: unknown): {
        eq(col2: string, val2: unknown): {
          maybeSingle(): Promise<{ data: unknown; error: unknown }>;
        };
        order(col: string, opts: { ascending: boolean }): {
          limit(n: number): Promise<{ data: unknown; error: unknown }>;
        };
        maybeSingle(): Promise<{ data: unknown; error: unknown }>;
        select?(columns?: string): {
          single(): Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
    insert(row: Record<string, unknown>): {
      select(columns: string): {
        single(): Promise<{ data: unknown; error: unknown }>;
      };
    };
    update(row: Record<string, unknown>): {
      eq(col: string, val: unknown): {
        select?(columns: string): {
          single(): Promise<{ data: unknown; error: unknown }>;
        };
      } & Promise<{ error: unknown }>;
    };
  };
}

const STATUS = ['draft','in_review','approved','rejected'];

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id; const userEmail = userResp.user.email ?? null;
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  try {
    switch (body.op) {
      case 'list':    return await handleList(admin, userId, body);
      case 'create':  return await handleCreate(admin, userId, userEmail, body);
      case 'update':  return await handleUpdate(admin, userId, userEmail, body);
      case 'approve': return await handleApprove(admin, userId, userEmail, body);
      default:        return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) { return jsonError(500, 'INTERNAL', (e as Error).message); }
});

async function handleList(admin: SupabaseAdminClient, userId: string, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  const { data, error } = await admin.from('dpias')
    .select('*, asset:governance_assets(id,name,asset_type,ai_act_class)')
    .eq('tenant_id', tenant_id).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return jsonResponse({ ok: true, dpias: data ?? [] });
}

async function handleCreate(admin: SupabaseAdminClient, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  const title = (body.title as string ?? '').trim();
  if (!tenant_id || !title) return jsonError(400, 'BAD_REQUEST', 'tenant_id and title required');
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be owner or admin');

  // Cross-tenant guard: if an asset_id is supplied, it MUST belong to
  // the same tenant as the DPIA. Without this check an owner/admin of
  // tenant A could attach an asset from tenant B and leak metadata
  // via the asset:governance_assets(...) join in handleList.
  const asset_id = body.asset_id as string | undefined;
  if (asset_id) {
    const { data: asset } = await admin.from('governance_assets')
      .select('tenant_id').eq('id', asset_id).maybeSingle();
    if (!asset) return jsonError(404, 'NOT_FOUND', 'asset not found');
    if (asset.tenant_id !== tenant_id) {
      return jsonError(403, 'CROSS_TENANT', 'asset belongs to another tenant');
    }
  }

  const { data, error } = await admin.from('dpias').insert({
    tenant_id, asset_id: asset_id ?? null, title: title.slice(0, 200),
    status: 'draft',
    risk_description: (body.risk_description as string ?? null)?.toString().slice(0, 5000) ?? null,
    mitigation_measures: (body.mitigation_measures as string ?? null)?.toString().slice(0, 5000) ?? null,
    dpo_consulted: !!body.dpo_consulted,
    dpo_email: (body.dpo_email as string ?? null)?.toString().slice(0, 254) ?? null,
    review_due_at: body.review_due_at ?? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  }).select('*').single();
  if (error) throw error;
  await audit(admin, { tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'dpia.create', target_type: 'dpia', target_id: data.id, payload: { title, asset_id: body.asset_id } });
  return jsonResponse({ ok: true, dpia: data });
}

async function handleUpdate(admin: SupabaseAdminClient, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const { data: row } = await admin.from('dpias').select('tenant_id').eq('id', id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'dpia not found');
  if (!(await isOwnerOrAdmin(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be owner or admin');

  const patch: Record<string, unknown> = {};
  for (const k of ['title','status','necessity_assessment','proportionality_assessment','risk_description','mitigation_measures','dpo_consulted','dpo_email','review_due_at']) {
    if (k in body) patch[k] = body[k];
  }
  if (patch.status && !STATUS.includes(patch.status as string)) return jsonError(400, 'BAD_REQUEST', `status must be one of ${STATUS.join('|')}`);

  const { data, error } = await admin.from('dpias').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'dpia.update', target_type: 'dpia', target_id: id, payload: patch });
  return jsonResponse({ ok: true, dpia: data });
}

async function handleApprove(admin: SupabaseAdminClient, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const { data: row } = await admin.from('dpias').select('tenant_id, status').eq('id', id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'dpia not found');
  if (!(await isOwnerOrAdmin(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  const now = new Date().toISOString();
  const { error } = await admin.from('dpias').update({ status: 'approved', approved_by: userEmail ?? userId, approved_at: now }).eq('id', id);
  if (error) throw error;
  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'dpia.approve', target_type: 'dpia', target_id: id, payload: { approved_at: now } });
  return jsonResponse({ ok: true, approved_at: now });
}

async function isOwnerOrAdmin(admin: SupabaseAdminClient, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships').select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return data?.role === 'owner' || data?.role === 'admin';
}


// Governance Approvals — approve / reject pending events.
//
// POST /functions/v1/governance-approvals
// Authorization: Bearer <user JWT>
// Body shapes:
//   { op: 'list',    tenant_id, status? }
//   { op: 'approve', approval_id, reason? }
//   { op: 'reject',  approval_id, reason }
//
// Owner / admin gated against memberships. Each resolved approval
// drops an evidence row of type 'approval' on the parent event so
// the audit trail captures who decided, when, and why.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const ALLOWED_STATUS = ['pending', 'approved', 'rejected', 'expired'];

interface SupabaseAdminClient {
  from(table: string): {
    select(columns: string): {
      eq(col: string, val: unknown): {
        eq(col2: string, val2: unknown): {
          order(col: string, options?: Record<string, unknown>): {
            limit(n: number): Promise<{ data: unknown; error: unknown }>;
          };
          maybeSingle(): Promise<{ data: unknown; error: unknown }>;
        };
        maybeSingle(): Promise<{ data: unknown; error: unknown }>;
      };
    };
    update(row: Record<string, unknown>): {
      eq(col: string, val: unknown): Promise<{ error: unknown }>;
    };
    insert(row: Record<string, unknown>): Promise<{ error: unknown }>;
  };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
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
      case 'list':    return await handleList(admin, userId, body);
      case 'approve': return await handleResolve(admin, userId, userEmail, body, 'approved');
      case 'reject':  return await handleResolve(admin, userId, userEmail, body, 'rejected');
      default:        return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

async function handleList(admin: SupabaseAdminClient, userId: string, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  const status = (body.status as string) ?? 'pending';
  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!ALLOWED_STATUS.includes(status)) {
    return jsonError(400, 'BAD_REQUEST', `status must be one of ${ALLOWED_STATUS.join('|')}`);
  }
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  const { data, error } = await admin.from('governance_approvals')
    .select(`
      id, tenant_id, event_id, policy_id, asset_id, status, requested_action,
      resolved_by, resolved_at, resolution_reason, expires_at, created_at,
      event:governance_events!inner(id,title,summary,risk_level,event_type,event_source,vendor,model_name,data_types,created_at),
      policy:governance_policies(id,name,severity,policy_type),
      asset:governance_assets(id,name,asset_type,ai_act_class)
    `)
    .eq('tenant_id', tenant_id)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return jsonResponse({ ok: true, approvals: data ?? [] });
}

async function handleResolve(
  admin: SupabaseAdminClient, userId: string, userEmail: string | null,
  body: Record<string, unknown>, target: 'approved' | 'rejected',
) {
  const approval_id = body.approval_id as string;
  const reason = (body.reason as string | undefined)?.toString().slice(0, 2000) ?? null;
  if (!approval_id) return jsonError(400, 'BAD_REQUEST', 'approval_id required');
  if (target === 'rejected' && !reason) {
    return jsonError(400, 'BAD_REQUEST', 'reason required when rejecting');
  }

  const { data: row } = await admin.from('governance_approvals')
    .select('id, tenant_id, event_id, asset_id, status')
    .eq('id', approval_id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'approval not found');
  if (row.status !== 'pending') {
    return jsonError(409, 'ALREADY_RESOLVED', `approval is ${row.status}`);
  }
  if (!(await isOwnerOrAdmin(admin, userId, row.tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  const resolvedAt = new Date().toISOString();
  const { error: updErr } = await admin.from('governance_approvals')
    .update({
      status: target,
      resolved_by: userId,
      resolved_at: resolvedAt,
      resolution_reason: reason,
    })
    .eq('id', approval_id);
  if (updErr) throw updErr;

  // Drop an evidence row on the parent event so the audit trail
  // captures the decision permanently.
  await admin.from('governance_evidence').insert({
    tenant_id: row.tenant_id,
    event_id: row.event_id,
    asset_id: row.asset_id,
    evidence_type: 'approval',
    title: target === 'approved' ? 'Approval granted' : 'Approval denied',
    storage_path: null,
    content_hash: null,
    previous_hash: null,
    metadata: {
      approval_id,
      status: target,
      resolved_by_user_id: userId,
      resolved_by_email: userEmail,
      resolved_at: resolvedAt,
      reason,
    },
  });

  return jsonResponse({ ok: true, status: target, resolved_at: resolvedAt });
}

async function isOwnerOrAdmin(admin: SupabaseAdminClient, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships')
    .select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return data?.role === 'owner' || data?.role === 'admin';
}


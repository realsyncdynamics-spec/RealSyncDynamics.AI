// Governance Approvals — approve / reject pending events.
//
// POST /functions/v1/governance-approvals
// Authorization: Bearer <user JWT>
// Body shapes:
//   { op: 'list',    tenant_id, status? }
//   { op: 'approve', approval_id, reason? }
//   { op: 'reject',  approval_id, reason }
//
//   PDP-Approval-Gates (P1-4, Plan governance-os-enforcement-plan.md):
//   { op: 'gates_list',   tenant_id, status? }
//   { op: 'gate_approve', gate_id, reason? }
//   { op: 'gate_reject',  gate_id, reason }
//
// Owner / admin gated against memberships. Each resolved approval
// drops an evidence row of type 'approval' on the parent event so
// the audit trail captures who decided, when, and why.
//
// Gates zusaetzlich: die Rolle aus gate.approver_role (role_bindings,
// Bindung an Tenant oder Teilbaum) darf ebenfalls freigeben — der CEO
// muss nicht jede Aktion freigeben (Auftrag §2). Jede Gate-Entscheidung
// erzeugt Evidence in ai_evidence_events (EU AI Act Art. 14 + 12).

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
      case 'gates_list':   return await handleGatesList(admin, userId, body);
      case 'gate_approve': return await handleGateResolve(admin, userId, userEmail, body, 'approved');
      case 'gate_reject':  return await handleGateResolve(admin, userId, userEmail, body, 'rejected');
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


// ─── PDP-Approval-Gates (P1-4) ───────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function handleGatesList(admin: any, userId: string, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  const status = (body.status as string) ?? 'pending';
  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!ALLOWED_STATUS.includes(status)) {
    return jsonError(400, 'BAD_REQUEST', `status must be one of ${ALLOWED_STATUS.join('|')}`);
  }
  // Listen duerfen owner/admin und jede Rolle, die freigeben koennte —
  // ein reiner Freigeber muss seine offene Arbeit sehen.
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))
      && !(await hasAnyGovernanceRole(admin, userId, tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner/admin or hold a governance role');
  }
  const { data, error } = await admin.from('pdp_approval_gates')
    .select('id, tenant_id, fingerprint, policy_id, approver_role, status, request_summary, requested_by, resolved_by, resolved_at, resolution_reason, expires_at, created_at')
    .eq('tenant_id', tenant_id)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return jsonResponse({ ok: true, gates: data ?? [] });
}

// deno-lint-ignore no-explicit-any
async function handleGateResolve(
  admin: any, userId: string, userEmail: string | null,
  body: Record<string, unknown>, target: 'approved' | 'rejected',
) {
  const gate_id = body.gate_id as string;
  const reason = (body.reason as string | undefined)?.toString().slice(0, 2000) ?? null;
  if (!gate_id) return jsonError(400, 'BAD_REQUEST', 'gate_id required');
  if (target === 'rejected' && !reason) {
    return jsonError(400, 'BAD_REQUEST', 'reason required when rejecting');
  }

  const { data: gate } = await admin.from('pdp_approval_gates')
    .select('id, tenant_id, status, approver_role, policy_id, request_summary, expires_at')
    .eq('id', gate_id).maybeSingle();
  if (!gate) return jsonError(404, 'NOT_FOUND', 'gate not found');
  if (gate.status !== 'pending') {
    return jsonError(409, 'ALREADY_RESOLVED', `gate is ${gate.status}`);
  }
  if (new Date(gate.expires_at).getTime() <= Date.now()) {
    await admin.from('pdp_approval_gates').update({ status: 'expired' }).eq('id', gate_id);
    return jsonError(409, 'ALREADY_RESOLVED', 'gate is expired');
  }

  // Freigeben darf: owner/admin — oder wer die im Gate hinterlegte Rolle
  // haelt (role_bindings ueber den eigenen Principal). v1 prueft die Rolle
  // tenantweit, NICHT auf den Teilbaum des Antragstellers eingegrenzt —
  // das Gate traegt (noch) keinen Org-Kontext. Bewusste, dokumentierte
  // Vereinfachung; Teilbaum-Eingrenzung folgt mit den Rollen-Sichten (P1-3).
  const allowed = (await isOwnerOrAdmin(admin, userId, gate.tenant_id))
    || (await userHoldsRole(admin, userId, gate.tenant_id, gate.approver_role));
  if (!allowed) {
    return jsonError(403, 'FORBIDDEN', `must be owner/admin or hold role '${gate.approver_role}'`);
  }

  const resolvedAt = new Date().toISOString();
  const { error: updErr } = await admin.from('pdp_approval_gates')
    .update({
      status: target,
      resolved_by: userId,
      resolved_at: resolvedAt,
      resolution_reason: reason,
    })
    .eq('id', gate_id)
    .eq('status', 'pending');
  if (updErr) throw updErr;

  // Pruefpfad am Entscheidungsstrom des PDP (gleicher Ort wie governance-decide)
  await admin.from('ai_evidence_events').insert({
    tenant_id: gate.tenant_id,
    policy_id: gate.policy_id,
    event_type: 'pdp:approval',
    event_summary: target === 'approved'
      ? `Freigabe erteilt (Gate ${gate_id}, Rolle ${gate.approver_role})`
      : `Freigabe abgelehnt (Gate ${gate_id}): ${reason}`,
    risk_level: 'medium',
    evidence: {
      gate_id,
      status: target,
      approver_role: gate.approver_role,
      resolved_by_user_id: userId,
      resolved_by_email: userEmail,
      resolved_at: resolvedAt,
      reason,
      request_summary: gate.request_summary,
    },
  });

  return jsonResponse({ ok: true, status: target, resolved_at: resolvedAt });
}

// deno-lint-ignore no-explicit-any
async function userHoldsRole(admin: any, userId: string, tenantId: string, role: string): Promise<boolean> {
  const { data: principal } = await admin.from('principals')
    .select('id, status')
    .eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (!principal || principal.status !== 'active') return false;
  const { data: binding } = await admin.from('role_bindings')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('principal_id', principal.id)
    .eq('role', role)
    .limit(1)
    .maybeSingle();
  return !!binding;
}

// deno-lint-ignore no-explicit-any
async function hasAnyGovernanceRole(admin: any, userId: string, tenantId: string): Promise<boolean> {
  const { data: principal } = await admin.from('principals')
    .select('id, status')
    .eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (!principal || principal.status !== 'active') return false;
  const { data: binding } = await admin.from('role_bindings')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('principal_id', principal.id)
    .limit(1)
    .maybeSingle();
  return !!binding;
}

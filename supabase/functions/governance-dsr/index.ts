// Governance DSR — Betroffenenrechte / Data Subject Requests (DSGVO Art. 15–21).
//
// POST /functions/v1/governance-dsr
// Authorization: Bearer <user JWT>
// op:
//   create  (tenant_id, request_type, requester_email, requester_name?, subject_description?, assigned_to?, affected_assets?)
//   update  (id, status?, response_notes?, assigned_to?, subject_description?, requester_name?, affected_assets?)
//   assign  (id, assigned_to)
//   close   (id, status?('completed'|'rejected'), response_notes?)
//   export  (id | (subject_ref, tenant_id))  — Art. 15 Auskunft: Datenbestand + Event-Timeline
//
// Tenant-membership gated (owner/admin/dpo/editor can write; viewer_auditor is read-only).
// Reads happen directly from the SPA via RLS (dsr_requests tenant-read policy).
//
// Side effects per write:
//   • governance_admin_log audit row (best-effort, observable on failure)
//   • DSR row + durable evidence outbox via database trigger (atomic);
//     a cron worker appends runtime_events asynchronously and idempotently.
//   • subject_ref HMAC computed from requester_email; a tenant key is
//     provisioned lazily on first use, and a subject_ref_mappings row is
//     created so the subject is linkable for export + erasure.
//   • request_type='erasure' → enqueues the subject for the automated
//     erasure sweep (governance-erasure-sweeper drains it daily).

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { ensureSubjectRef } from '../_shared/dsrSubjectRef.ts';
import { audit } from '../_shared/auditLog.ts';
import {
  buildClosePatch,
  buildCreate,
  buildUpdatePatch,
  isWriterRole,
  normalizeExportRequest,
} from './logic.ts';

interface DsrRequest {
  id?: string;
  metadata?: Record<string, unknown>;
  tenant_id?: string;
  [key: string]: unknown;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
      case 'create': return await handleCreate(admin, userId, userEmail, body);
      case 'update': return await handleUpdate(admin, userId, userEmail, body);
      case 'assign': return await handleAssign(admin, userId, userEmail, body);
      case 'close':  return await handleClose(admin, userId, userEmail, body);
      case 'export': return await handleExport(admin, userClient, userId, body);
      default:       return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

async function handleCreate(admin: SupabaseClient, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const built = buildCreate(body);
  if (built.error || !built.row) return jsonError(400, 'BAD_REQUEST', built.error ?? 'invalid payload');
  const row = built.row;
  if (!(await isWriter(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be a tenant member');
  if (!(await outboxReady(admin))) return jsonError(503, 'EVIDENCE_UNAVAILABLE', 'DSR evidence outbox not ready');

  // Resolve (and lazily provision) the subject reference. Best-effort: a
  // failure here must never block intake — the DSR record is the source of
  // truth and can be linked later.
  const subject = await ensureSubjectRef(admin, row.tenant_id, row.requester_email);
  const subject_ref = subject?.subject_ref ?? null;

  const { data, error } = await admin.from('dsr_requests').insert({
    ...row,
    metadata: subject_ref ? { subject_ref } : {},
  }).select('*').single();
  if (error) throw error;

  // Fast path: verify the computed HMAC, persist mapping and enqueue
  // erasure evidence atomically in PostgreSQL. The DSR trigger already
  // persisted a durable recovery item if this attempt fails.
  if (subject) {
    const { data: linked, error: linkError } = await admin.rpc('dsr_outbox_subject_link', {
      p_dsr_id: data.id,
      p_tenant_id: row.tenant_id,
      p_subject_ref: subject.subject_ref,
      p_key_version: subject.key_version,
    });
    if (linkError || linked !== true) {
      // Only a code: database error messages may contain personal data.
      console.error(JSON.stringify({ scope: 'dsr_subject_link_pending',
        code: linkError?.code ?? 'SUBJECT_LINK_FAILED' }));
    }
  }

  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'dsr.create', target_type: 'dsr_request', target_id: data.id, payload: { request_type: row.request_type } });
  return json({ ok: true, dsr: data });
}

async function handleUpdate(admin: SupabaseClient, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const row = await loadRow(admin, id);
  if (!row) return jsonError(404, 'NOT_FOUND', 'dsr request not found');
  if (!(await isWriter(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be a tenant member');
  if (!(await outboxReady(admin))) return jsonError(503, 'EVIDENCE_UNAVAILABLE', 'DSR evidence outbox not ready');

  const built = buildUpdatePatch(body, row.completed_at ?? null, new Date().toISOString());
  if (built.error || !built.patch) return jsonError(400, 'BAD_REQUEST', built.error ?? 'invalid payload');
  const patch = built.patch;

  const { data, error } = await admin.from('dsr_requests').update(patch).eq('id', id).select('*').single();
  if (error) throw error;

  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'dsr.update', target_type: 'dsr_request', target_id: id, payload: patch });
  return json({ ok: true, dsr: data });
}

async function handleAssign(admin: SupabaseClient, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  const assigned_to = (body.assigned_to as string ?? '').trim();
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  if (!assigned_to) return jsonError(400, 'BAD_REQUEST', 'assigned_to required');
  const row = await loadRow(admin, id);
  if (!row) return jsonError(404, 'NOT_FOUND', 'dsr request not found');
  if (!(await isWriter(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be a tenant member');
  if (!(await outboxReady(admin))) return jsonError(503, 'EVIDENCE_UNAVAILABLE', 'DSR evidence outbox not ready');

  const { data, error } = await admin.from('dsr_requests').update({ assigned_to: assigned_to.slice(0, 254) }).eq('id', id).select('*').single();
  if (error) throw error;

  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'dsr.assign', target_type: 'dsr_request', target_id: id, payload: { assigned_to } });
  return json({ ok: true, dsr: data });
}

async function handleClose(admin: SupabaseClient, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const row = await loadRow(admin, id);
  if (!row) return jsonError(404, 'NOT_FOUND', 'dsr request not found');
  if (!(await isWriter(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be a tenant member');
  if (!(await outboxReady(admin))) return jsonError(503, 'EVIDENCE_UNAVAILABLE', 'DSR evidence outbox not ready');

  const built = buildClosePatch(body, row.completed_at ?? null, new Date().toISOString());
  if (built.error || !built.patch) return jsonError(400, 'BAD_REQUEST', built.error ?? 'invalid payload');
  const patch = built.patch;

  const { data, error } = await admin.from('dsr_requests').update(patch).eq('id', id).select('*').single();
  if (error) throw error;

  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'dsr.close', target_type: 'dsr_request', target_id: id, payload: { status: patch.status } });
  return json({ ok: true, dsr: data });
}

// Art. 15 Auskunft: returns the subject's data inventory + the pseudonymous,
// hash-chained event timeline. Read-only — any tenant member may run it.
// The canonical RPCs (has_tenant_membership-guarded) are invoked via the
// user client so the membership check uses the caller's own identity.
async function handleExport(admin: SupabaseClient, userClient: SupabaseClient, userId: string, body: Record<string, unknown>) {
  const target = normalizeExportRequest(body);
  if (target.error) return jsonError(400, 'BAD_REQUEST', target.error);

  let tenant_id: string;
  let subject_ref: string;
  if (target.by === 'id') {
    const { data: dsr } = await admin.from('dsr_requests').select('tenant_id, metadata').eq('id', target.value).maybeSingle();
    if (!dsr) return jsonError(404, 'NOT_FOUND', 'dsr request not found');
    const ref = dsr.metadata?.subject_ref;
    if (typeof ref !== 'string' || ref.length < 8) return jsonError(409, 'NO_SUBJECT_REF', 'request has no linked subject reference');
    tenant_id = dsr.tenant_id;
    subject_ref = ref;
  } else {
    const tid = body.tenant_id as string;
    if (!tid) return jsonError(400, 'BAD_REQUEST', 'tenant_id required with subject_ref');
    tenant_id = tid;
    subject_ref = target.value!;
  }

  if (!(await isMember(admin, userId, tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be a tenant member');

  const { data: inventory, error: invErr } = await userClient.rpc('dsr_subject_inventory', { p_tenant_id: tenant_id, p_subject_ref: subject_ref });
  if (invErr) return jsonError(500, 'EXPORT_FAILED', invErr.message);
  const { data: events, error: evErr } = await userClient.rpc('incident_correlation_export', { p_tenant_id: tenant_id, p_subject_ref: subject_ref });
  if (evErr) return jsonError(500, 'EXPORT_FAILED', evErr.message);

  return json({ ok: true, subject_ref, inventory, events: events ?? [] });
}

// ── Helpers ──────────────────────────────────────────────────────────

async function loadRow(admin: SupabaseClient, id: string) {
  const { data } = await admin.from('dsr_requests').select('id, tenant_id, completed_at, metadata').eq('id', id).maybeSingle();
  return data ?? null;
}

async function isWriter(admin: SupabaseClient, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships').select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return isWriterRole(data?.role);
}

// Migration readiness gate. Never fall back to unproven best-effort evidence
// when a changed DSR record must be accompanied by a durable outbox row.
async function outboxReady(admin: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc('dsr_outbox_ready');
    return !error && data === true;
  } catch {
    return false;
  }
}

async function isMember(admin: SupabaseClient, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships').select('user_id').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return !!data;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}

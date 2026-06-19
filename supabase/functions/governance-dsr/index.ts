// Governance DSR — Betroffenenrechte / Data Subject Requests (DSGVO Art. 15–21).
//
// POST /functions/v1/governance-dsr
// Authorization: Bearer <user JWT>
// op:
//   create  (tenant_id, request_type, requester_email, requester_name?, subject_description?, assigned_to?, affected_assets?)
//   update  (id, status?, response_notes?, assigned_to?, subject_description?, requester_name?, affected_assets?)
//   assign  (id, assigned_to)
//   close   (id, status?('completed'|'rejected'), response_notes?)
//
// Tenant-membership gated (owner/admin/member can write; viewer is read-only).
// Reads happen directly from the SPA via RLS (dsr_requests tenant-read policy).
//
// Side effects per write:
//   • governance_admin_log audit row (best-effort, observable on failure)
//   • runtime_events evidence row (best-effort, append-only hash chain)
//   • subject_ref HMAC computed from requester_email when a tenant key exists,
//     so the erasure queue can later link the subject without re-reading PII.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { audit } from '../_shared/auditLog.ts';
import { buildClosePatch, buildCreate, buildUpdatePatch, isWriterRole } from './logic.ts';

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
      default:       return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

// deno-lint-ignore no-explicit-any
async function handleCreate(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const built = buildCreate(body);
  if (built.error || !built.row) return jsonError(400, 'BAD_REQUEST', built.error ?? 'invalid payload');
  const row = built.row;
  if (!(await isWriter(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be a tenant member');

  // Best-effort HMAC subject reference — never blocks intake.
  const subject_ref = await computeSubjectRef(admin, row.tenant_id, row.requester_email);

  const { data, error } = await admin.from('dsr_requests').insert({
    ...row,
    metadata: subject_ref ? { subject_ref } : {},
  }).select('*').single();
  if (error) throw error;

  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'dsr.create', target_type: 'dsr_request', target_id: data.id, payload: { request_type: row.request_type } });
  await emitEvidence(admin, { tenant_id: row.tenant_id, eventType: 'dsr.created', dsr: data, subject_ref, payload: { request_type: row.request_type } });
  return json({ ok: true, dsr: data });
}

// deno-lint-ignore no-explicit-any
async function handleUpdate(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const row = await loadRow(admin, id);
  if (!row) return jsonError(404, 'NOT_FOUND', 'dsr request not found');
  if (!(await isWriter(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be a tenant member');

  const built = buildUpdatePatch(body, row.completed_at ?? null, new Date().toISOString());
  if (built.error || !built.patch) return jsonError(400, 'BAD_REQUEST', built.error ?? 'invalid payload');
  const patch = built.patch;

  const { data, error } = await admin.from('dsr_requests').update(patch).eq('id', id).select('*').single();
  if (error) throw error;

  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'dsr.update', target_type: 'dsr_request', target_id: id, payload: patch });
  await emitEvidence(admin, { tenant_id: row.tenant_id, eventType: 'dsr.updated', dsr: data, subject_ref: subjectRefOf(data), payload: { status: data.status } });
  return json({ ok: true, dsr: data });
}

// deno-lint-ignore no-explicit-any
async function handleAssign(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  const assigned_to = (body.assigned_to as string ?? '').trim();
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  if (!assigned_to) return jsonError(400, 'BAD_REQUEST', 'assigned_to required');
  const row = await loadRow(admin, id);
  if (!row) return jsonError(404, 'NOT_FOUND', 'dsr request not found');
  if (!(await isWriter(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be a tenant member');

  const { data, error } = await admin.from('dsr_requests').update({ assigned_to: assigned_to.slice(0, 254) }).eq('id', id).select('*').single();
  if (error) throw error;

  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'dsr.assign', target_type: 'dsr_request', target_id: id, payload: { assigned_to } });
  await emitEvidence(admin, { tenant_id: row.tenant_id, eventType: 'dsr.assigned', dsr: data, subject_ref: subjectRefOf(data), payload: { assigned_to } });
  return json({ ok: true, dsr: data });
}

// deno-lint-ignore no-explicit-any
async function handleClose(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const row = await loadRow(admin, id);
  if (!row) return jsonError(404, 'NOT_FOUND', 'dsr request not found');
  if (!(await isWriter(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be a tenant member');

  const built = buildClosePatch(body, row.completed_at ?? null, new Date().toISOString());
  if (built.error || !built.patch) return jsonError(400, 'BAD_REQUEST', built.error ?? 'invalid payload');
  const patch = built.patch;

  const { data, error } = await admin.from('dsr_requests').update(patch).eq('id', id).select('*').single();
  if (error) throw error;

  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'dsr.close', target_type: 'dsr_request', target_id: id, payload: { status: patch.status } });
  await emitEvidence(admin, { tenant_id: row.tenant_id, eventType: 'dsr.closed', dsr: data, subject_ref: subjectRefOf(data), severity: 'medium', payload: { status: patch.status } });
  return json({ ok: true, dsr: data });
}

// ── Helpers ──────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function loadRow(admin: any, id: string) {
  const { data } = await admin.from('dsr_requests').select('id, tenant_id, completed_at, metadata').eq('id', id).maybeSingle();
  return data ?? null;
}

// deno-lint-ignore no-explicit-any
async function isWriter(admin: any, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships').select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return isWriterRole(data?.role);
}

// Best-effort HMAC subject reference. Returns null when the tenant has no
// active subject_ref key — intake must never fail because of this.
// deno-lint-ignore no-explicit-any
async function computeSubjectRef(admin: any, tenantId: string, email: string): Promise<string | null> {
  try {
    const { data, error } = await admin.rpc('subject_ref_compute', {
      p_tenant_id: tenantId, p_subject_kind: 'email', p_value: email,
    });
    if (error || typeof data !== 'string' || data.length < 8) return null;
    return data;
  } catch {
    return null;
  }
}

// deno-lint-ignore no-explicit-any
function subjectRefOf(dsr: any): string | null {
  const ref = dsr?.metadata?.subject_ref;
  return typeof ref === 'string' && ref.length >= 8 ? ref : null;
}

// Append-only evidence row on the per-tenant hash chain. Best-effort: a
// failure here (e.g. a missing future partition) is logged but never blocks
// the DSR write, which is the source of truth.
// deno-lint-ignore no-explicit-any
async function emitEvidence(admin: any, args: {
  tenant_id: string;
  eventType: string;
  // deno-lint-ignore no-explicit-any
  dsr: any;
  subject_ref: string | null;
  severity?: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await admin.from('runtime_events').insert({
      tenant_id: args.tenant_id,
      type: args.eventType,
      severity: args.severity ?? 'info',
      source: 'governance-dsr',
      subject_ref: args.subject_ref,
      payload: { dsr_id: args.dsr?.id, ...args.payload },
      correlation_id: args.dsr?.id ?? null,
    });
    if (error) throw error;
  } catch (e) {
    console.error(JSON.stringify({
      level: 'error', scope: 'dsr_evidence_emit_failed',
      event_type: args.eventType, tenant_id: args.tenant_id,
      dsr_id: args.dsr?.id, error: (e as Error)?.message ?? String(e),
    }));
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}

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
// Tenant-membership gated (owner/admin/member can write; viewer is read-only).
// Reads happen directly from the SPA via RLS (dsr_requests tenant-read policy).
//
// Side effects per write:
//   • governance_admin_log audit row (best-effort, observable on failure)
//   • runtime_events evidence row (best-effort, append-only hash chain)
//   • subject_ref HMAC computed from requester_email; a tenant key is
//     provisioned lazily on first use, and a subject_ref_mappings row is
//     created so the subject is linkable for export + erasure.
//   • request_type='erasure' → enqueues the subject for the automated
//     erasure sweep (governance-erasure-sweeper drains it daily).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { audit } from '../_shared/auditLog.ts';
import {
  buildClosePatch,
  buildCreate,
  buildUpdatePatch,
  isErasure,
  isWriterRole,
  normalizeExportRequest,
} from './logic.ts';

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

// deno-lint-ignore no-explicit-any
async function handleCreate(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const built = buildCreate(body);
  if (built.error || !built.row) return jsonError(400, 'BAD_REQUEST', built.error ?? 'invalid payload');
  const row = built.row;
  if (!(await isWriter(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be a tenant member');

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

  // Anchor the subject so export + erasure can find it (best-effort).
  if (subject) {
    await upsertMapping(admin, { subject_ref: subject.subject_ref, tenant_id: row.tenant_id, key_version: subject.key_version });
    if (isErasure(row.request_type)) {
      await enqueueErasure(admin, row.tenant_id, subject.subject_ref, data.id);
    }
  }

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

// Art. 15 Auskunft: returns the subject's data inventory + the pseudonymous,
// hash-chained event timeline. Read-only — any tenant member may run it.
// The canonical RPCs (has_tenant_membership-guarded) are invoked via the
// user client so the membership check uses the caller's own identity.
// deno-lint-ignore no-explicit-any
async function handleExport(admin: any, userClient: any, userId: string, body: Record<string, unknown>) {
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

// deno-lint-ignore no-explicit-any
async function isMember(admin: any, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships').select('user_id').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return !!data;
}

// deno-lint-ignore no-explicit-any
async function getActiveKey(admin: any, tenantId: string): Promise<{ key_version: number; vault_secret_name: string } | null> {
  const { data } = await admin.from('subject_ref_keys')
    .select('key_version, vault_secret_name')
    .eq('tenant_id', tenantId).eq('status', 'active')
    .order('key_version', { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Resolve the HMAC subject_ref for an email, provisioning a per-tenant key
// (metadata row + Vault secret) on first use. Best-effort: returns null on
// any failure so DSR intake is never blocked.
// deno-lint-ignore no-explicit-any
async function ensureSubjectRef(admin: any, tenantId: string, email: string): Promise<{ subject_ref: string; key_version: number } | null> {
  try {
    let key = await getActiveKey(admin, tenantId);
    if (!key) {
      // Mint key v1: metadata via rotate RPC, then write the actual HMAC
      // secret to Vault under the deterministic vault_secret_name.
      const { error: rotErr } = await admin.rpc('rotate_subject_ref_key', { p_tenant_id: tenantId });
      if (rotErr) return null;
      key = await getActiveKey(admin, tenantId);
      if (!key) return null;
      const { error: setErr } = await admin.rpc('set_app_secret', { secret_name: key.vault_secret_name, secret_value: randomHex(32) });
      if (setErr) return null;
    }
    const { data, error } = await admin.rpc('subject_ref_compute', {
      p_tenant_id: tenantId, p_subject_kind: 'email', p_value: email,
    });
    if (error || typeof data !== 'string' || data.length < 8) return null;
    return { subject_ref: data, key_version: key.key_version };
  } catch {
    return null;
  }
}

// Create the subject anchor if absent; never disturb an existing mapping's
// lifecycle (deletion_requested_at / erased_at / retention_class).
// deno-lint-ignore no-explicit-any
async function upsertMapping(admin: any, m: { subject_ref: string; tenant_id: string; key_version: number }): Promise<void> {
  try {
    const { error } = await admin.from('subject_ref_mappings').upsert(
      { subject_ref: m.subject_ref, tenant_id: m.tenant_id, key_version: m.key_version, subject_kind: 'email' },
      { onConflict: 'subject_ref', ignoreDuplicates: true },
    );
    if (error) throw error;
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'dsr_mapping_upsert_failed', tenant_id: m.tenant_id, error: (e as Error)?.message ?? String(e) }));
  }
}

// Enqueue the subject for the automated erasure sweep. Replicates the effect
// of request_subject_erasure() via the service-role client (that RPC guards
// on has_tenant_membership/auth.uid(), which is absent for service role).
// The membership check already happened in handleCreate (isWriter).
// deno-lint-ignore no-explicit-any
async function enqueueErasure(admin: any, tenantId: string, subjectRef: string, dsrId: string): Promise<void> {
  try {
    const { error } = await admin.from('subject_ref_mappings')
      .update({ deletion_requested_at: new Date().toISOString() })
      .eq('tenant_id', tenantId).eq('subject_ref', subjectRef).is('deletion_requested_at', null);
    if (error) throw error;
    await emitEvidence(admin, {
      tenant_id: tenantId, eventType: 'dsr.erasure_requested', dsr: { id: dsrId },
      subject_ref: subjectRef, severity: 'high',
      payload: { request_id: crypto.randomUUID(), retention_hold: '30 days', reason: `dsr:${dsrId}` },
    });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'dsr_erasure_enqueue_failed', tenant_id: tenantId, dsr_id: dsrId, error: (e as Error)?.message ?? String(e) }));
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
      // runtime_events CHECK restricts spec_version to ('0.1','0.2'); the
      // column default is still '1.0' (fixed in 20260626000000), so set it
      // explicitly to stay valid regardless of deploy order.
      spec_version: '0.2',
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

// Governance Vendors — Sub-Processor / Auftragsverarbeiter inventory
// (DSGVO Art. 28 / Art. 46 transfer mechanisms).
//
// POST /functions/v1/governance-vendors
// Authorization: Bearer <user JWT>
// op:
//   create (tenant_id, name, ...)
//   update (id, ...patch)
//   delete (id)
//
// Tenant-membership gated (owner/admin/member can write; viewer is read-only).
// Reads happen directly from the SPA via RLS (vendors tenant-read policy).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { audit } from '../_shared/auditLog.ts';
import { buildPatch, isWriterRole, validateEnums } from './logic.ts';

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
      case 'delete': return await handleDelete(admin, userId, userEmail, body);
      default:       return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

// deno-lint-ignore no-explicit-any
async function handleCreate(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  const name = (body.name as string ?? '').trim();
  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!name) return jsonError(400, 'BAD_REQUEST', 'name required');
  if (!(await isWriter(admin, userId, tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be a tenant member');

  const patch = buildPatch(body);
  const enumErr = validateEnums(patch);
  if (enumErr) return jsonError(400, 'BAD_REQUEST', enumErr);

  const { data, error } = await admin.from('vendors').insert({
    tenant_id,
    name: name.slice(0, 200),
    ...patch,
  }).select('*').single();
  if (error) throw error;

  await audit(admin, { tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'vendor.create', target_type: 'vendor', target_id: data.id, payload: { name } });
  await emitEvidence(admin, { tenant_id, eventType: 'vendor.created', vendorId: data.id, payload: { name, dpa_status: data.dpa_status } });
  return json({ ok: true, vendor: data });
}

// deno-lint-ignore no-explicit-any
async function handleUpdate(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const { data: row } = await admin.from('vendors').select('tenant_id').eq('id', id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'vendor not found');
  if (!(await isWriter(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be a tenant member');

  const patch = buildPatch(body);
  if ('name' in body) {
    const name = (body.name as string ?? '').trim();
    if (!name) return jsonError(400, 'BAD_REQUEST', 'name cannot be empty');
    patch.name = name.slice(0, 200);
  }
  const enumErr = validateEnums(patch);
  if (enumErr) return jsonError(400, 'BAD_REQUEST', enumErr);
  if (Object.keys(patch).length === 0) return jsonError(400, 'BAD_REQUEST', 'no updatable fields supplied');

  const { data, error } = await admin.from('vendors').update(patch).eq('id', id).select('*').single();
  if (error) throw error;

  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'vendor.update', target_type: 'vendor', target_id: id, payload: patch });
  await emitEvidence(admin, { tenant_id: row.tenant_id, eventType: 'vendor.updated', vendorId: id, payload: { dpa_status: data.dpa_status } });
  return json({ ok: true, vendor: data });
}

// deno-lint-ignore no-explicit-any
async function handleDelete(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const { data: row } = await admin.from('vendors').select('tenant_id, name').eq('id', id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'vendor not found');
  if (!(await isWriter(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be a tenant member');

  // asset_vendor_links has ON DELETE CASCADE on vendor_id, so links are
  // cleaned up automatically. The vendor row itself is removed.
  const { error } = await admin.from('vendors').delete().eq('id', id);
  if (error) throw error;

  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'vendor.delete', target_type: 'vendor', target_id: id, payload: { name: row.name } });
  await emitEvidence(admin, { tenant_id: row.tenant_id, eventType: 'vendor.deleted', vendorId: id, severity: 'medium', payload: { name: row.name } });
  return json({ ok: true });
}

// ── Helpers ──────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function isWriter(admin: any, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships').select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return isWriterRole(data?.role);
}

// deno-lint-ignore no-explicit-any
async function emitEvidence(admin: any, args: {
  tenant_id: string;
  eventType: string;
  vendorId: string;
  severity?: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await admin.from('runtime_events').insert({
      tenant_id: args.tenant_id,
      type: args.eventType,
      severity: args.severity ?? 'info',
      source: 'governance-vendors',
      payload: { vendor_id: args.vendorId, ...args.payload },
      correlation_id: args.vendorId,
    });
    if (error) throw error;
  } catch (e) {
    console.error(JSON.stringify({
      level: 'error', scope: 'vendor_evidence_emit_failed',
      event_type: args.eventType, tenant_id: args.tenant_id,
      vendor_id: args.vendorId, error: (e as Error)?.message ?? String(e),
    }));
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}

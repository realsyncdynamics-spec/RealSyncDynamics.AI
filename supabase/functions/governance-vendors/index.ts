// Governance Vendors — CRUD fuer das Vendor-/Sub-Processor-Inventar.
//
// POST /functions/v1/governance-vendors
// Authorization: Bearer <user JWT>
// op: create (tenant_id, name, ...) | update (id, ...) | delete (id)
//
// Owner/admin gated via memberships. Tenant wird serverseitig aufgeloest.
// Listen/Counts liest das Frontend direkt aus vendors (RLS-Read-Policy).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { audit } from '../_shared/auditLog.ts';
import { buildVendorInsert, buildVendorPatch } from '../_shared/governance-validation.ts';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
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
      case 'create': return await handleCreate(admin, userId, userEmail, body);
      case 'update': return await handleUpdate(admin, userId, userEmail, body);
      case 'delete': return await handleDelete(admin, userId, userEmail, body);
      default:       return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) { return jsonError(500, 'INTERNAL', (e as Error).message); }
});

// deno-lint-ignore no-explicit-any
async function handleCreate(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  const built = buildVendorInsert(body);
  if ('error' in built) return jsonError(400, 'BAD_REQUEST', built.error);
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be owner or admin');

  const { data, error } = await admin.from('vendors').insert({ tenant_id, ...built.value }).select('*').single();
  if (error) throw error;
  await audit(admin, { tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'vendor.create', target_type: 'vendor', target_id: data.id, payload: { name: built.value.name } });
  return json({ ok: true, vendor: data });
}

// deno-lint-ignore no-explicit-any
async function handleUpdate(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const built = buildVendorPatch(body);
  if ('error' in built) return jsonError(400, 'BAD_REQUEST', built.error);
  const { data: row } = await admin.from('vendors').select('tenant_id').eq('id', id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'vendor not found');
  if (!(await isOwnerOrAdmin(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be owner or admin');

  const { data, error } = await admin.from('vendors').update(built.value).eq('id', id).select('*').single();
  if (error) throw error;
  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'vendor.update', target_type: 'vendor', target_id: id, payload: built.value });
  return json({ ok: true, vendor: data });
}

// deno-lint-ignore no-explicit-any
async function handleDelete(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const { data: row } = await admin.from('vendors').select('tenant_id').eq('id', id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'vendor not found');
  if (!(await isOwnerOrAdmin(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  const { error } = await admin.from('vendors').delete().eq('id', id);
  if (error) throw error;
  await audit(admin, { tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail, action: 'vendor.delete', target_type: 'vendor', target_id: id });
  return json({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function isOwnerOrAdmin(admin: any, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships').select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return data?.role === 'owner' || data?.role === 'admin';
}

function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } }); }
function jsonError(status: number, code: string, message: string): Response { return json({ ok: false, error: { code, message } }, status); }

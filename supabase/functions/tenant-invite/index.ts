// Tenant invite management.
//
// POST /functions/v1/tenant-invite
// Authorization: Bearer <user JWT>
// Body shapes:
//   { op: 'create',  tenant_id, email, role, ttl_hours? }
//   { op: 'list',    tenant_id }
//   { op: 'revoke',  invite_id }
//   { op: 'accept',  token }
//
// Owner / admin can create / list / revoke invites for their tenants.
// Any authenticated user can accept a token (we match the email if it
// is verified on the auth.users record).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sha256Hex, randomToken } from '../_shared/hash.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Role = 'admin' | 'editor' | 'viewer_auditor';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const user = userResp.user;
  const userId = user.id;
  const userEmail = (user.email ?? '').toLowerCase();

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  try {
    switch (body.op) {
      case 'create': return await handleCreate(admin, userId, body);
      case 'list':   return await handleList(admin, userId, body);
      case 'revoke': return await handleRevoke(admin, userId, body);
      case 'accept': return await handleAccept(admin, userId, userEmail, body);
      default:       return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

// deno-lint-ignore no-explicit-any
async function handleCreate(admin: any, userId: string, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = body.role as Role;
  const ttlHours = Math.min(Math.max(Number(body.ttl_hours ?? 168), 1), 24 * 30);

  if (!tenant_id || !email || !['admin', 'editor', 'viewer_auditor'].includes(role)) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id, email, role required');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return jsonError(400, 'BAD_REQUEST', 'invalid email');
  }

  // Caller must be owner or admin of the tenant.
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  const token = randomToken();
  const token_hash = await sha256Hex(token);
  const expires_at = new Date(Date.now() + ttlHours * 3600_000).toISOString();

  const { data, error } = await admin.from('tenant_invites').insert({
    tenant_id, email, role, token_hash, invited_by: userId, expires_at,
  }).select('id,tenant_id,email,role,expires_at,created_at').single();
  if (error) throw error;

  return json({ ok: true, invite: data, token });
}

// deno-lint-ignore no-explicit-any
async function handleList(admin: any, userId: string, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }
  const { data, error } = await admin.from('tenant_invites')
    .select('id,tenant_id,email,role,expires_at,accepted_at,revoked_at,created_at')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return json({ ok: true, invites: data ?? [] });
}

// deno-lint-ignore no-explicit-any
async function handleRevoke(admin: any, userId: string, body: Record<string, unknown>) {
  const invite_id = body.invite_id as string;
  if (!invite_id) return jsonError(400, 'BAD_REQUEST', 'invite_id required');

  const { data: invite } = await admin.from('tenant_invites')
    .select('tenant_id,accepted_at,revoked_at')
    .eq('id', invite_id).maybeSingle();
  if (!invite) return jsonError(404, 'NOT_FOUND', 'invite not found');
  if (invite.accepted_at) return jsonError(409, 'CONFLICT', 'invite already accepted');
  if (invite.revoked_at)  return json({ ok: true, already_revoked: true });

  if (!(await isOwnerOrAdmin(admin, userId, invite.tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  const { error } = await admin.from('tenant_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invite_id);
  if (error) throw error;
  return json({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function handleAccept(admin: any, userId: string, userEmail: string, body: Record<string, unknown>) {
  const token = body.token as string;
  if (!token) return jsonError(400, 'BAD_REQUEST', 'token required');

  const token_hash = await sha256Hex(token);
  const { data: invite } = await admin.from('tenant_invites')
    .select('id,tenant_id,email,role,expires_at,accepted_at,revoked_at')
    .eq('token_hash', token_hash).maybeSingle();
  if (!invite) return jsonError(404, 'NOT_FOUND', 'invalid token');
  if (invite.revoked_at)  return jsonError(410, 'REVOKED',  'invite was revoked');
  if (invite.accepted_at) return jsonError(409, 'CONSUMED', 'invite already accepted');
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return jsonError(410, 'EXPIRED', 'invite expired');
  }
  if (invite.email && userEmail && invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    return jsonError(403, 'EMAIL_MISMATCH', `invite is for ${invite.email}, you are signed in as ${userEmail}`);
  }

  // Idempotent membership upsert (don't error on existing).
  const { error: memErr } = await admin.from('memberships').insert({
    tenant_id: invite.tenant_id,
    user_id: userId,
    role: invite.role,
  });
  if (memErr && !/duplicate key/i.test(memErr.message)) throw memErr;

  const { error: updErr } = await admin.from('tenant_invites')
    .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
    .eq('id', invite.id);
  if (updErr) throw updErr;

  return json({ ok: true, tenant_id: invite.tenant_id, role: invite.role });
}

// deno-lint-ignore no-explicit-any
async function isOwnerOrAdmin(admin: any, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships')
    .select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return data?.role === 'owner' || data?.role === 'admin';
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

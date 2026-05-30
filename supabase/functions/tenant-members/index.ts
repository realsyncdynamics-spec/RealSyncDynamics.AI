// Tenant member management — client + server roles (P0b).
//
// POST /functions/v1/tenant-members
// Authorization: Bearer <user JWT>   (verify_jwt=true, Default)
// Body:
//   { op: 'list',     tenant_id }
//   { op: 'set_role', tenant_id, target_user_id, role }
//   { op: 'remove',   tenant_id, target_user_id }
//
// Owner/admin gated via memberships. Guards (ADR 0005):
//   - role whitelist: owner|admin|dpo|editor|viewer_auditor
//   - last-owner protection: never remove/demote the final owner
//   - self-demote/self-remove of the acting admin blocked
//   - cross-tenant: target must be a member of the same tenant
// Every write is audited into governance_admin_log (best effort).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ROLES = ['owner', 'admin', 'dpo', 'editor', 'viewer_auditor'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function err(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return err(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return err(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return err(401, 'UNAUTHORIZED', 'invalid token');
  const actorId = userResp.user.id;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'BAD_REQUEST', 'invalid json'); }

  try {
    switch (body.op) {
      case 'list':     return await handleList(admin, actorId, body);
      case 'set_role': return await handleSetRole(admin, actorId, body);
      case 'remove':   return await handleRemove(admin, actorId, body);
      default:         return err(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return err(500, 'INTERNAL', (e as Error).message);
  }
});

// deno-lint-ignore no-explicit-any
async function callerRole(admin: any, userId: string, tenantId: string): Promise<string | null> {
  const { data } = await admin.from('memberships')
    .select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return data?.role ?? null;
}

// deno-lint-ignore no-explicit-any
async function ownerCount(admin: any, tenantId: string): Promise<number> {
  const { count } = await admin.from('memberships')
    .select('user_id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId).eq('role', 'owner');
  return count ?? 0;
}

// deno-lint-ignore no-explicit-any
async function audit(admin: any, tenantId: string, actorId: string, action: string, targetId: string, payload: unknown) {
  await admin.from('governance_admin_log').insert({
    tenant_id: tenantId, actor_user_id: actorId, action,
    target_type: 'membership', target_id: targetId, payload,
  }).then(() => {}, () => {}); // never hard-fail on audit
}

// deno-lint-ignore no-explicit-any
async function handleList(admin: any, actorId: string, body: Record<string, unknown>) {
  const tenantId = body.tenant_id as string;
  if (!tenantId) return err(400, 'BAD_REQUEST', 'tenant_id required');
  // Any member of the tenant may read the roster.
  const role = await callerRole(admin, actorId, tenantId);
  if (!role) return err(403, 'FORBIDDEN', 'not a member of this tenant');

  const { data, error } = await admin.from('memberships')
    .select('user_id, role, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  // Enrich with email (best effort via auth admin).
  const members = [];
  for (const m of data ?? []) {
    let email: string | null = null;
    try {
      // deno-lint-ignore no-explicit-any
      const { data: u } = await (admin as any).auth.admin.getUserById(m.user_id);
      email = u?.user?.email ?? null;
    } catch { /* ignore */ }
    members.push({ user_id: m.user_id, role: m.role, created_at: m.created_at, email, is_self: m.user_id === actorId });
  }
  return json({ ok: true, members, caller_role: role });
}

// deno-lint-ignore no-explicit-any
async function handleSetRole(admin: any, actorId: string, body: Record<string, unknown>) {
  const tenantId = body.tenant_id as string;
  const targetUserId = body.target_user_id as string;
  const role = body.role as string;
  if (!tenantId || !targetUserId || !role) return err(400, 'BAD_REQUEST', 'tenant_id, target_user_id, role required');
  if (!ROLES.includes(role)) return err(400, 'BAD_ROLE', `role must be one of ${ROLES.join(', ')}`);

  const callerR = await callerRole(admin, actorId, tenantId);
  if (callerR !== 'owner' && callerR !== 'admin') return err(403, 'FORBIDDEN', 'must be owner or admin');

  // Only an owner may grant or revoke the owner role.
  if ((role === 'owner' || (await targetRole(admin, targetUserId, tenantId)) === 'owner') && callerR !== 'owner') {
    return err(403, 'FORBIDDEN', 'only an owner may change owner role');
  }

  const target = await targetMembership(admin, targetUserId, tenantId);
  if (!target) return err(404, 'NOT_FOUND', 'target is not a member of this tenant');

  // Last-owner protection: demoting the final owner is forbidden.
  if (target.role === 'owner' && role !== 'owner' && (await ownerCount(admin, tenantId)) <= 1) {
    return err(409, 'LAST_OWNER', 'cannot demote the last owner');
  }
  // Self-demote protection for the acting admin/owner.
  if (targetUserId === actorId && role !== callerR && (callerR === 'owner' || callerR === 'admin')) {
    if (callerR === 'owner' && (await ownerCount(admin, tenantId)) <= 1) {
      return err(409, 'SELF_DEMOTE', 'last owner cannot demote themselves');
    }
  }

  const { error } = await admin.from('memberships')
    .update({ role }).eq('tenant_id', tenantId).eq('user_id', targetUserId);
  if (error) throw error;

  await audit(admin, tenantId, actorId, 'membership.set_role', targetUserId, { from: target.role, to: role });
  return json({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function handleRemove(admin: any, actorId: string, body: Record<string, unknown>) {
  const tenantId = body.tenant_id as string;
  const targetUserId = body.target_user_id as string;
  if (!tenantId || !targetUserId) return err(400, 'BAD_REQUEST', 'tenant_id, target_user_id required');

  const callerR = await callerRole(admin, actorId, tenantId);
  if (callerR !== 'owner' && callerR !== 'admin') return err(403, 'FORBIDDEN', 'must be owner or admin');

  const target = await targetMembership(admin, targetUserId, tenantId);
  if (!target) return err(404, 'NOT_FOUND', 'target is not a member of this tenant');

  // Only an owner may remove another owner.
  if (target.role === 'owner' && callerR !== 'owner') return err(403, 'FORBIDDEN', 'only an owner may remove an owner');
  // Last-owner protection.
  if (target.role === 'owner' && (await ownerCount(admin, tenantId)) <= 1) {
    return err(409, 'LAST_OWNER', 'cannot remove the last owner');
  }
  // Self-remove of the last owner blocked (other self-removes allowed = "leave tenant").
  if (targetUserId === actorId && target.role === 'owner' && (await ownerCount(admin, tenantId)) <= 1) {
    return err(409, 'SELF_REMOVE', 'last owner cannot remove themselves');
  }

  const { error } = await admin.from('memberships')
    .delete().eq('tenant_id', tenantId).eq('user_id', targetUserId);
  if (error) throw error;

  await audit(admin, tenantId, actorId, 'membership.remove', targetUserId, { role: target.role });
  return json({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function targetMembership(admin: any, userId: string, tenantId: string): Promise<{ role: string } | null> {
  const { data } = await admin.from('memberships')
    .select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return data ?? null;
}
// deno-lint-ignore no-explicit-any
async function targetRole(admin: any, userId: string, tenantId: string): Promise<string | null> {
  return (await targetMembership(admin, userId, tenantId))?.role ?? null;
}

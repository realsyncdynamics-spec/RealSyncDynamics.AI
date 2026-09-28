// Governance Incidents — create and transition security / data-breach
// incidents (DSGVO Art. 33/34, NIS2 Art. 23).
//
// POST /functions/v1/governance-incidents
// Authorization: Bearer <user JWT>
// op:
//   create     (tenant_id, title, severity?, description?, asset_id?,
//               personal_data_affected?, breach_confirmed?, affected_data_types?,
//               estimated_affected_subjects?, assigned_to?)
//   transition (id, status, note?, authority_reference?)
//
// Writes go to public.incidents — the table the SPA reads via RLS
// (incidentsApi.fetchTenantIncidents). Tenant-membership gated: owner, admin,
// dpo and editor may write; viewer_auditor and non-members get 403. The JWT is verified
// in-function (config.toml keeps verify_jwt = false like the other
// governance-* functions).
//
// Before this rewrite the function was a stub that read `action` instead of
// `op`, never answered with `ok`, checked no caller and inserted tenant-less
// rows into governance_incidents with the service role.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { audit } from '../_shared/auditLog.ts';
import { corsHeaders, handleOptions, jsonError, jsonResponse } from '../_shared/gateway.ts';
import { buildCreateRow, buildTransitionPatch, isUuid, isWriterRole } from './logic.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
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
      case 'create':     return await handleCreate(admin, userId, userEmail, body);
      case 'transition': return await handleTransition(admin, userId, userEmail, body);
      default:           return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

async function memberRole(admin: SupabaseClient, userId: string, tenantId: string): Promise<string | null> {
  const { data } = await admin
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as { role?: string } | null)?.role ?? null;
}

async function handleCreate(
  admin: SupabaseClient,
  userId: string,
  userEmail: string | null,
  body: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  const built = buildCreateRow(body, userEmail ?? userId, now);
  if (!built.ok) return jsonError(400, 'BAD_REQUEST', built.message);
  const tenantId = built.value.tenant_id as string;

  if (!isWriterRole(await memberRole(admin, userId, tenantId))) {
    return jsonError(403, 'FORBIDDEN', 'must be a writing member of the tenant');
  }

  // Cross-tenant guard: an attached asset must belong to the same tenant.
  const assetId = built.value.asset_id as string | null;
  if (assetId) {
    const { data: asset } = await admin
      .from('governance_assets').select('tenant_id').eq('id', assetId).maybeSingle();
    if (!asset) return jsonError(404, 'NOT_FOUND', 'asset not found');
    if ((asset as { tenant_id: string }).tenant_id !== tenantId) {
      return jsonError(403, 'CROSS_TENANT', 'asset belongs to another tenant');
    }
  }

  const { data, error } = await admin.from('incidents').insert(built.value).select('*').single();
  if (error) throw error;
  const incident = data as { id: string; severity: string };

  await audit(admin as unknown as Parameters<typeof audit>[0], {
    tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail,
    action: 'incident.create', target_type: 'incident', target_id: incident.id,
    payload: { severity: incident.severity },
  });
  return jsonResponse({ ok: true, incident: data });
}

async function handleTransition(
  admin: SupabaseClient,
  userId: string,
  userEmail: string | null,
  body: Record<string, unknown>,
) {
  if (!isUuid(body.id)) return jsonError(400, 'BAD_REQUEST', 'id must be a UUID');

  const { data: row } = await admin
    .from('incidents').select('id, tenant_id, status, timeline').eq('id', body.id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'incident not found');
  const current = row as { id: string; tenant_id: string | null; status: string; timeline: unknown };

  // Tenant-less legacy rows cannot be authorised against a membership.
  if (!current.tenant_id || !isWriterRole(await memberRole(admin, userId, current.tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be a writing member of the tenant');
  }

  const built = buildTransitionPatch(current, body, userEmail ?? userId, new Date().toISOString());
  if (!built.ok) return jsonError(400, 'BAD_REQUEST', built.message);

  // Compare-and-set on the status we read: the timeline is appended in
  // JS (read-modify-write), so a concurrent transition that already moved
  // the incident must not be overwritten with a stale timeline. Every valid
  // transition changes the status, so `status = <read status>` is exactly
  // the "nobody else wrote in between" check. Zero matched rows → 409.
  const { data, error } = await admin
    .from('incidents')
    .update(built.value)
    .eq('id', current.id)
    .eq('status', current.status)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) return jsonError(409, 'CONFLICT', 'incident changed concurrently; reload and retry');

  await audit(admin as unknown as Parameters<typeof audit>[0], {
    tenant_id: current.tenant_id, actor_user_id: userId, actor_email: userEmail,
    action: 'incident.transition', target_type: 'incident', target_id: current.id,
    payload: { from: current.status, to: built.value.status },
  });
  return jsonResponse({ ok: true, incident: data });
}

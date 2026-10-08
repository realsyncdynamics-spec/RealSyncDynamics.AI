// siteos/project-bind — bind the latest SiteOS blueprint to Website Operations.
//
// This is the missing bridge between the append-only SiteOS blueprint chain
// and the existing website_projects lifecycle used by preview / production.
//
// Properties:
// - authenticated user JWT + tenant membership
// - owner/admin only
// - siteos.publish entitlement required
// - only the latest blueprint version for a slug may be bound
// - idempotent: an already-bound blueprint returns the existing project
// - race-safe enough for repeated clicks: a losing project insert is deleted
//   when another request bound the blueprint first
// - no Cloudflare project, domain, DNS, SSL or live-state change happens here

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { audit } from '../../_shared/auditLog.ts';
import { EntitlementError, gateFeature } from '../../_shared/entitlements.ts';
import { handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../../_shared/gateway.ts';

const BIND_ROLES = new Set(['owner', 'admin']);

export async function handle(req: Request): Promise<Response> {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const tenantId = String(body.tenant_id ?? '').trim();
  const blueprintId = String(body.blueprint_id ?? '').trim();
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!blueprintId) return jsonError(400, 'BAD_REQUEST', 'blueprint_id required');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  }

  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data: member } = await admin
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle<{ role: string }>();

  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
  if (!BIND_ROLES.has(member.role)) {
    return jsonError(403, 'FORBIDDEN', `role "${member.role}" may not bind a publish project`);
  }

  try {
    await gateFeature(admin, tenantId, 'siteos.publish');
  } catch (error) {
    if (error instanceof EntitlementError) {
      const status = error.code === 'INTERNAL' ? 500 : 403;
      return jsonError(status, error.code, error.message);
    }
    throw error;
  }

  const { data: blueprint } = await admin
    .from('siteos_blueprints')
    .select('id, slug, name, industry, version, project_id')
    .eq('id', blueprintId)
    .eq('tenant_id', tenantId)
    .maybeSingle<{
      id: string;
      slug: string;
      name: string;
      industry: string;
      version: number;
      project_id: string | null;
    }>();

  if (!blueprint) {
    return jsonError(404, 'NOT_FOUND', 'blueprint not found for this tenant');
  }

  const { data: latest } = await admin
    .from('siteos_blueprints')
    .select('id, version, project_id')
    .eq('tenant_id', tenantId)
    .eq('slug', blueprint.slug)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; version: number; project_id: string | null }>();

  if (!latest || latest.id !== blueprint.id) {
    return jsonError(
      409,
      'STALE_BLUEPRINT',
      'Only the latest blueprint version may be bound to a publish project',
    );
  }

  if (blueprint.project_id) {
    const existing = await loadProject(admin, tenantId, blueprint.project_id);
    if (!existing) {
      return jsonError(
        409,
        'PROJECT_NOT_FOUND',
        'Blueprint references a website project that no longer exists for this tenant',
      );
    }
    return jsonResponse({
      ok: true,
      created: false,
      project: existing,
      blueprint_id: blueprint.id,
      version: blueprint.version,
    });
  }

  const { data: inserted, error: insertErr } = await admin
    .from('website_projects')
    .insert({
      tenant_id: tenantId,
      name: blueprint.name,
      industry: blueprint.industry,
      status: 'draft',
      configuration: {
        siteos_slug: blueprint.slug,
        siteos_bound_blueprint_id: blueprint.id,
        siteos_binding_version: blueprint.version,
      },
      created_by: userId,
    })
    .select('id, name, status')
    .single<{ id: string; name: string; status: string }>();

  if (insertErr || !inserted) {
    console.error(JSON.stringify({
      level: 'error',
      scope: 'siteos_project_bind_insert_failed',
      blueprint_id: blueprint.id,
      error: insertErr?.message ?? 'missing inserted project',
    }));
    return jsonError(500, 'INTERNAL', 'website project could not be created');
  }

  const { data: bound, error: bindErr } = await admin
    .from('siteos_blueprints')
    .update({ project_id: inserted.id })
    .eq('id', blueprint.id)
    .eq('tenant_id', tenantId)
    .is('project_id', null)
    .select('project_id')
    .maybeSingle<{ project_id: string | null }>();

  if (bindErr) {
    await cleanupProject(admin, tenantId, inserted.id);
    console.error(JSON.stringify({
      level: 'error',
      scope: 'siteos_project_bind_update_failed',
      blueprint_id: blueprint.id,
      project_id: inserted.id,
      error: bindErr.message,
    }));
    return jsonError(500, 'INTERNAL', 'blueprint could not be bound to website project');
  }

  // Another request may have won after our insert but before the conditional
  // update. Delete our still-unused project and return the winning binding.
  if (!bound?.project_id) {
    await cleanupProject(admin, tenantId, inserted.id);
    const { data: winner } = await admin
      .from('siteos_blueprints')
      .select('project_id')
      .eq('id', blueprint.id)
      .eq('tenant_id', tenantId)
      .maybeSingle<{ project_id: string | null }>();

    if (!winner?.project_id) {
      return jsonError(409, 'BIND_CONFLICT', 'blueprint binding changed concurrently; retry');
    }

    const existing = await loadProject(admin, tenantId, winner.project_id);
    if (!existing) {
      return jsonError(409, 'PROJECT_NOT_FOUND', 'winning website project could not be resolved');
    }
    return jsonResponse({
      ok: true,
      created: false,
      project: existing,
      blueprint_id: blueprint.id,
      version: blueprint.version,
    });
  }

  const auditResult = await audit(admin, {
    tenant_id: tenantId,
    actor_user_id: userId,
    actor_email: userEmail,
    action: 'siteos.project.bind',
    target_type: 'website_project',
    target_id: inserted.id,
    payload: {
      blueprint_id: blueprint.id,
      slug: blueprint.slug,
      version: blueprint.version,
    },
  });

  return jsonResponse({
    ok: true,
    created: true,
    project: inserted,
    blueprint_id: blueprint.id,
    version: blueprint.version,
    audit_recorded: auditResult.ok,
  });
}

// deno-lint-ignore no-explicit-any
async function loadProject(admin: any, tenantId: string, projectId: string): Promise<{
  id: string;
  name: string;
  status: string;
} | null> {
  const { data } = await admin
    .from('website_projects')
    .select('id, name, status')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return data ?? null;
}

// deno-lint-ignore no-explicit-any
async function cleanupProject(admin: any, tenantId: string, projectId: string): Promise<void> {
  const { error } = await admin
    .from('website_projects')
    .delete()
    .eq('id', projectId)
    .eq('tenant_id', tenantId);
  if (error) {
    console.error(JSON.stringify({
      level: 'error',
      scope: 'siteos_project_bind_cleanup_failed',
      project_id: projectId,
      error: error.message,
    }));
  }
}

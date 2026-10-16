// siteos/publish-rollback — governed Cloudflare Pages production rollback (O-WP9).
//
// Setzt Production auf den vorherigen Live-Stand zurück. Kein neuer Build,
// kein Upload: Cloudflare stellt die gespeicherte Production-Deployment
// wieder live. Das Ziel bestimmt der Server, nie der Browser.
//
// Vorbedingungen:
//   1. Owner/Admin, ausdrückliche Bestätigung und eine Begründung.
//   2. Blueprint ist an das Website-Projekt dieses Mandanten gebunden.
//   3. Ein aktueller und ein vorheriger Production-Stand sind erfasst
//      (publish-production hält den vorherigen fest).
//   4. Das Ziel existiert bei Cloudflare noch als Production-Deployment.
//
// Danach tauschen aktueller und vorheriger Stand die Plätze. Ein zweiter
// Rollback führt also wieder vorwärts.
//
// Keine Domain-/DNS-Operation. Kein Publish-GO: Der Zielstand war bereits
// freigegeben und live; seine Evaluation-ID bleibt im Nachweis erhalten.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { audit } from '../../_shared/auditLog.ts';
import { handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../../_shared/gateway.ts';
import {
  CloudflarePagesError,
  getPagesDeployment,
  getPagesProject,
  rollbackPagesDeployment,
} from '../cloudflare-pages.ts';

const PUBLISHER_ROLES = new Set(['owner', 'admin']);
const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

interface ProductionState {
  deployment_id: string;
  branch: string;
  artifact_sha256: string;
  evaluation_id: string;
  deployed_at: string;
}

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
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!blueprintId) return jsonError(400, 'BAD_REQUEST', 'blueprint_id required');
  if (body.confirm_rollback !== true) {
    return jsonError(400, 'BAD_REQUEST', 'Rollback requires confirm_rollback=true');
  }
  if (reason.length < MIN_REASON_LENGTH) {
    return jsonError(400, 'BAD_REQUEST', `reason must be at least ${MIN_REASON_LENGTH} characters`);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN') ?? '';
  const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? '';

  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
    return jsonError(503, 'CLOUDFLARE_NOT_CONFIGURED', 'Cloudflare production transport is not configured');
  }

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
  if (!PUBLISHER_ROLES.has(member.role)) {
    return jsonError(403, 'FORBIDDEN', `role "${member.role}" may not roll back SiteOS production`);
  }

  const { data: blueprintRow } = await admin
    .from('siteos_blueprints')
    .select('id, project_id, slug')
    .eq('id', blueprintId)
    .eq('tenant_id', tenantId)
    .maybeSingle<{ id: string; project_id: string | null; slug: string }>();

  if (!blueprintRow) {
    return jsonError(404, 'NOT_FOUND', 'blueprint not found for this tenant');
  }
  if (!blueprintRow.project_id) {
    return jsonError(409, 'PROJECT_REQUIRED', 'Rollback requires a website project bound to this blueprint');
  }

  const { data: project } = await admin
    .from('website_projects')
    .select('id, cloudflare_project_id, last_deployed_at, configuration')
    .eq('id', blueprintRow.project_id)
    .eq('tenant_id', tenantId)
    .maybeSingle<{
      id: string;
      cloudflare_project_id: string | null;
      last_deployed_at: string | null;
      configuration: Record<string, unknown> | null;
    }>();

  if (!project) {
    return jsonError(409, 'PROJECT_NOT_FOUND', 'bound website project not found for this tenant');
  }

  const configuration = isRecord(project.configuration) ? project.configuration : {};
  const cloudflareProjectName = readNonEmptyString(configuration.siteos_cloudflare_project_name);
  const current = readProductionState(configuration.siteos_last_production);
  const target = readProductionState(configuration.siteos_previous_production);

  if (!cloudflareProjectName || !current) {
    return jsonError(409, 'PRODUCTION_REQUIRED', 'No governed production deployment is recorded');
  }
  if (!target) {
    return jsonError(409, 'ROLLBACK_TARGET_REQUIRED', 'No earlier production deployment is recorded');
  }
  if (target.deployment_id === current.deployment_id) {
    return jsonError(409, 'ROLLBACK_TARGET_INVALID', 'Rollback target equals the current production deployment');
  }

  // Read-only Cloudflare preflight: Projekt und Ziel müssen noch existieren.
  let remoteProject;
  try {
    remoteProject = await getPagesProject({
      accountId: CLOUDFLARE_ACCOUNT_ID,
      apiToken: CLOUDFLARE_API_TOKEN,
      projectName: cloudflareProjectName,
    });
  } catch (error) {
    return cloudflareFailure(error, 'Cloudflare project preflight failed');
  }
  if (!remoteProject) {
    return jsonError(409, 'CLOUDFLARE_PROJECT_REQUIRED', 'The recorded Pages project no longer exists');
  }
  if (project.cloudflare_project_id && remoteProject.id !== project.cloudflare_project_id) {
    return jsonError(409, 'CLOUDFLARE_PROJECT_MISMATCH', 'Recorded website project and Cloudflare Pages project no longer match');
  }

  let remoteTarget;
  try {
    remoteTarget = await getPagesDeployment({
      accountId: CLOUDFLARE_ACCOUNT_ID,
      apiToken: CLOUDFLARE_API_TOKEN,
      projectName: cloudflareProjectName,
      deploymentId: target.deployment_id,
    });
  } catch (error) {
    return cloudflareFailure(error, 'Cloudflare rollback target verification failed');
  }
  if (!remoteTarget) {
    return jsonError(409, 'ROLLBACK_TARGET_MISSING', 'The earlier production deployment no longer exists in Cloudflare');
  }
  if (remoteTarget.environment !== 'production') {
    return jsonError(409, 'ROLLBACK_TARGET_REMOTE_MISMATCH', 'The rollback target is not a Cloudflare production deployment');
  }

  const startedAt = new Date().toISOString();
  const auditPayload = {
    blueprint_id: blueprintId,
    slug: blueprintRow.slug,
    reason: reason.slice(0, MAX_REASON_LENGTH),
    cloudflare_project_name: cloudflareProjectName,
    from_deployment_id: current.deployment_id,
    from_artifact_sha256: current.artifact_sha256,
    from_evaluation_id: current.evaluation_id,
    to_deployment_id: target.deployment_id,
    to_artifact_sha256: target.artifact_sha256,
    to_evaluation_id: target.evaluation_id,
  };
  await audit(admin, {
    tenant_id: tenantId,
    actor_user_id: userId,
    actor_email: userEmail,
    action: 'siteos.publish.rollback.start',
    target_type: 'website_project',
    target_id: project.id,
    payload: auditPayload,
  });

  let rolledBack;
  try {
    rolledBack = await rollbackPagesDeployment({
      accountId: CLOUDFLARE_ACCOUNT_ID,
      apiToken: CLOUDFLARE_API_TOKEN,
      projectName: cloudflareProjectName,
      deploymentId: target.deployment_id,
    });
  } catch (error) {
    const failure = normalizeCloudflareFailure(error, 'Cloudflare production rollback failed');
    await recordFailure({ admin, projectId: project.id, tenantId, userId, userEmail, auditPayload, code: failure.code, message: failure.message, startedAt });
    return jsonError(failure.status, failure.code, failure.message);
  }

  const completedAt = new Date().toISOString();
  const recordingWarnings: string[] = [];
  const nextConfiguration = { ...configuration };
  nextConfiguration.siteos_last_production = {
    ...target,
    rolled_back_at: completedAt,
    rolled_back_from: current.deployment_id,
  };
  nextConfiguration.siteos_previous_production = current;

  // Nur übernehmen, wenn seit dem Lesen niemand anders Production verändert
  // hat (Deploy oder Rollback). Sonst stimmt der lokale Stand nicht mehr.
  let projectUpdate = admin
    .from('website_projects')
    .update({
      status: 'live',
      deployment_url: rolledBack.url,
      last_deployed_at: completedAt,
      configuration: nextConfiguration,
    })
    .eq('id', project.id)
    .eq('tenant_id', tenantId);
  projectUpdate = project.last_deployed_at
    ? projectUpdate.eq('last_deployed_at', project.last_deployed_at)
    : projectUpdate.is('last_deployed_at', null);
  const { data: updatedRows, error: projectUpdateErr } = await projectUpdate.select('id');

  if (projectUpdateErr) {
    recordingWarnings.push(`ROLLBACK_STATE_NOT_RECORDED: ${projectUpdateErr.message}`);
  } else if (!updatedRows || updatedRows.length === 0) {
    recordingWarnings.push('ROLLBACK_STATE_CONFLICT: production changed concurrently; local state not updated');
  }

  const { error: logErr } = await admin.from('deployment_logs').insert({
    project_id: project.id,
    tenant_id: tenantId,
    event_type: 'deploy',
    status: 'success',
    title: 'SiteOS Cloudflare production rollback',
    message: rolledBack.url,
    details: {
      preview_only: false,
      rollback: true,
      cloudflare_deployment_id: rolledBack.id,
      ...auditPayload,
      started_at: startedAt,
    },
    triggered_by: 'user',
    triggered_by_user_id: userId,
    started_at: startedAt,
    completed_at: completedAt,
  });
  if (logErr) {
    recordingWarnings.push(`ROLLBACK_LOG_NOT_RECORDED: ${logErr.message}`);
  }

  try {
    await audit(admin, {
      tenant_id: tenantId,
      actor_user_id: userId,
      actor_email: userEmail,
      action: 'siteos.publish.rollback.completed',
      target_type: 'website_project',
      target_id: project.id,
      payload: { ...auditPayload, production_url: rolledBack.url, cloudflare_deployment_id: rolledBack.id },
    });
  } catch (error) {
    recordingWarnings.push(
      `ROLLBACK_AUDIT_NOT_RECORDED: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (recordingWarnings.length > 0) {
    console.error(JSON.stringify({
      level: 'error',
      scope: 'siteos_rollback_recording_incomplete',
      project_id: project.id,
      deployment_id: rolledBack.id,
      warnings: recordingWarnings,
    }));
  }

  return jsonResponse({
    ok: true,
    rollback: {
      url: rolledBack.url,
      deployment_id: rolledBack.id,
      project_name: cloudflareProjectName,
      from_deployment_id: current.deployment_id,
      to_deployment_id: target.deployment_id,
      artifact_sha256: target.artifact_sha256,
      evaluation_id: target.evaluation_id,
      rolled_back_at: completedAt,
      recording_complete: recordingWarnings.length === 0,
      recording_warnings: recordingWarnings,
    },
  });
}

function readProductionState(value: unknown): ProductionState | null {
  if (!isRecord(value)) return null;
  const deploymentId = readNonEmptyString(value.deployment_id);
  const branch = readNonEmptyString(value.branch);
  const artifactSha256 = readNonEmptyString(value.artifact_sha256);
  const evaluationId = readNonEmptyString(value.evaluation_id);
  const deployedAt = readNonEmptyString(value.deployed_at);
  if (
    !deploymentId
    || !branch
    || !/^[0-9a-f]{64}$/.test(artifactSha256 ?? '')
    || !evaluationId
    || !deployedAt
  ) {
    return null;
  }
  return {
    deployment_id: deploymentId,
    branch,
    artifact_sha256: artifactSha256!,
    evaluation_id: evaluationId,
    deployed_at: deployedAt,
  };
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeCloudflareFailure(
  error: unknown,
  fallback: string,
): { status: number; code: string; message: string } {
  const code = error instanceof CloudflarePagesError ? error.code : 'CLOUDFLARE_ROLLBACK_FAILED';
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof CloudflarePagesError && error.status >= 400 && error.status < 500
    ? error.status
    : 502;
  return { status, code, message };
}

function cloudflareFailure(error: unknown, fallback: string): Response {
  const failure = normalizeCloudflareFailure(error, fallback);
  return jsonError(failure.status, failure.code, failure.message);
}

async function recordFailure(args: {
  // No generated Database type exists in this repository.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: ReturnType<typeof createClient<any, 'public', any>>;
  projectId: string;
  tenantId: string;
  userId: string;
  userEmail: string | null;
  auditPayload: Record<string, unknown>;
  code: string;
  message: string;
  startedAt: string;
}): Promise<void> {
  try {
    await args.admin.from('deployment_logs').insert({
      project_id: args.projectId,
      tenant_id: args.tenantId,
      event_type: 'deploy',
      status: 'failed',
      title: 'SiteOS Cloudflare production rollback fehlgeschlagen',
      message: args.message,
      details: { preview_only: false, rollback: true, error_code: args.code, ...args.auditPayload },
      triggered_by: 'user',
      triggered_by_user_id: args.userId,
      started_at: args.startedAt,
      completed_at: new Date().toISOString(),
    });
  } catch {
    // Preserve original transport error.
  }

  try {
    await audit(args.admin, {
      tenant_id: args.tenantId,
      actor_user_id: args.userId,
      actor_email: args.userEmail,
      action: 'siteos.publish.rollback.failed',
      target_type: 'website_project',
      target_id: args.projectId,
      payload: { ...args.auditPayload, error_code: args.code },
    });
  } catch {
    // Preserve original transport error.
  }
}

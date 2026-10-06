// siteos/publish-production — governed Cloudflare Pages production cutover.
//
// Preconditions before a production GO is even recorded:
//   1. Blueprint is bound to this tenant's website project.
//   2. A real Cloudflare preview was recorded for that project.
//   3. The current deterministic artifact equals that preview artifact.
//   4. The referenced Cloudflare Pages project still exists.
//
// Then, and only then:
//   publish-export performs a fresh gate evaluation + explicit GO,
//   and exactly those returned bytes are deployed to Cloudflare's own
//   production_branch.
//
// No domain/DNS operation lives here.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { audit } from '../../_shared/auditLog.ts';
import { handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../../_shared/gateway.ts';
import {
  buildDeploymentArtifact,
  type SiteBlueprint,
} from '../../../../packages/siteos-core/src/index.ts';
import {
  CloudflarePagesError,
  deployPagesProduction,
  getPagesDeployment,
  getPagesProject,
  type ReleaseFile,
} from '../cloudflare-pages.ts';
import { handleExport } from './publish-gate.ts';

const PUBLISHER_ROLES = new Set(['owner', 'admin']);

// No generated Database type exists in this repository.
type AdminClient = ReturnType<typeof createClient<any, 'public', any>>;

interface PublishExportPayload {
  ok: true;
  manifest: {
    format: 'realsync-siteos-export/1';
    slug: string;
    version: number;
    blueprint_sha256: string;
    artifact_sha256: string;
    evaluation_id: string;
    go_by: string;
    go_at: string;
    base_url: string | null;
    files: Array<{ path: string; sha256: string; bytes: number }>;
  };
  files: ReleaseFile[];
}

interface LastPreview {
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

  // Preserve the exact authenticated request for publish-export. It is called
  // only after every deployment prerequisite below has passed.
  const exportRequest = req.clone();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const tenantId = String(body.tenant_id ?? '').trim();
  const blueprintId = String(body.blueprint_id ?? '').trim();
  const baseUrl = typeof body.base_url === 'string' ? body.base_url : undefined;
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!blueprintId) return jsonError(400, 'BAD_REQUEST', 'blueprint_id required');
  if (body.confirm_preview !== true || body.confirm_go !== true) {
    return jsonError(
      400,
      'BAD_REQUEST',
      'Production requires confirm_preview=true and confirm_go=true',
    );
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
    return jsonError(
      503,
      'CLOUDFLARE_NOT_CONFIGURED',
      'Cloudflare production transport is not configured',
    );
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });
  const { data: member } = await admin
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userResp.user.id)
    .maybeSingle<{ role: string }>();

  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
  if (!PUBLISHER_ROLES.has(member.role)) {
    return jsonError(
      403,
      'FORBIDDEN',
      `role "${member.role}" may not deploy SiteOS to production`,
    );
  }

  const { data: blueprintRow } = await admin
    .from('siteos_blueprints')
    .select('id, project_id, slug, version, blueprint')
    .eq('id', blueprintId)
    .eq('tenant_id', tenantId)
    .maybeSingle<{
      id: string;
      project_id: string | null;
      slug: string;
      version: number;
      blueprint: SiteBlueprint;
    }>();

  if (!blueprintRow?.blueprint) {
    return jsonError(404, 'NOT_FOUND', 'blueprint not found for this tenant');
  }
  if (!blueprintRow.project_id) {
    return jsonError(
      409,
      'PROJECT_REQUIRED',
      'Production requires a website project bound to this blueprint',
    );
  }

  const { data: project } = await admin
    .from('website_projects')
    .select('id, name, cloudflare_project_id, preview_url, configuration')
    .eq('id', blueprintRow.project_id)
    .eq('tenant_id', tenantId)
    .maybeSingle<{
      id: string;
      name: string;
      cloudflare_project_id: string | null;
      preview_url: string | null;
      configuration: Record<string, unknown> | null;
    }>();

  if (!project) {
    return jsonError(
      409,
      'PROJECT_NOT_FOUND',
      'bound website project not found for this tenant',
    );
  }

  const configuration = isRecord(project.configuration)
    ? project.configuration
    : {};
  const cloudflareProjectName = readNonEmptyString(
    configuration.siteos_cloudflare_project_name,
  );
  const lastPreview = readLastPreview(configuration.siteos_last_preview);

  if (!project.preview_url || !cloudflareProjectName || !lastPreview) {
    return jsonError(
      409,
      'PREVIEW_REQUIRED',
      'A successful governed Cloudflare preview is required before production',
    );
  }
  if (!lastPreview.branch.startsWith('preview-')) {
    return jsonError(
      409,
      'PREVIEW_INVALID',
      'Recorded preview is not bound to a governed preview branch',
    );
  }

  // Build before GO. This prevents recording a production GO for a version
  // that was never the version actually previewed.
  const preflightArtifact = await buildDeploymentArtifact(blueprintRow.blueprint, {
    baseUrl,
    presentation: 'showcase',
  });
  if (preflightArtifact.artifactSha256 !== lastPreview.artifact_sha256) {
    return jsonError(
      409,
      'PREVIEW_STALE',
      'The current release differs from the last governed preview; deploy and review a new preview first',
    );
  }

  // Read-only Cloudflare preflight before GO. Production never creates a
  // project implicitly; preview must have established it.
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
    return jsonError(
      409,
      'CLOUDFLARE_PROJECT_REQUIRED',
      'The Pages project recorded by the preview no longer exists',
    );
  }
  if (
    project.cloudflare_project_id
    && remoteProject.id !== project.cloudflare_project_id
  ) {
    return jsonError(
      409,
      'CLOUDFLARE_PROJECT_MISMATCH',
      'Recorded website project and Cloudflare Pages project no longer match',
    );
  }

  let remotePreview;
  try {
    remotePreview = await getPagesDeployment({
      accountId: CLOUDFLARE_ACCOUNT_ID,
      apiToken: CLOUDFLARE_API_TOKEN,
      projectName: cloudflareProjectName,
      deploymentId: lastPreview.deployment_id,
    });
  } catch (error) {
    return cloudflareFailure(error, 'Cloudflare preview verification failed');
  }
  if (!remotePreview) {
    return jsonError(
      409,
      'PREVIEW_MISSING',
      'The governed preview deployment no longer exists in Cloudflare',
    );
  }
  if (
    remotePreview.environment !== 'preview'
    || remotePreview.branch !== lastPreview.branch
  ) {
    return jsonError(
      409,
      'PREVIEW_REMOTE_MISMATCH',
      'The recorded preview no longer matches Cloudflare preview state',
    );
  }
  if (normalizeUrl(remotePreview.url) !== normalizeUrl(project.preview_url)) {
    return jsonError(
      409,
      'PREVIEW_URL_MISMATCH',
      'The recorded preview URL no longer matches the Cloudflare deployment',
    );
  }

  // Fresh evaluation + explicit human GO, canonical implementation from #1782.
  const releaseResponse = await handleExport(exportRequest);
  if (!releaseResponse.ok) return releaseResponse;

  let release: PublishExportPayload;
  try {
    release = await releaseResponse.json() as PublishExportPayload;
  } catch {
    return jsonError(
      500,
      'INTERNAL',
      'governed publish export returned invalid json',
    );
  }
  if (
    release?.manifest?.format !== 'realsync-siteos-export/1'
    || !Array.isArray(release.files)
  ) {
    return jsonError(
      500,
      'INTERNAL',
      'governed publish export returned an invalid manifest',
    );
  }

  // Recheck after GO: deploy only the exact bytes the human previewed.
  if (
    release.manifest.artifact_sha256 !== lastPreview.artifact_sha256
    || release.manifest.artifact_sha256 !== preflightArtifact.artifactSha256
  ) {
    return jsonError(
      409,
      'PREVIEW_STALE',
      'Release changed between preview verification and production GO',
    );
  }

  const startedAt = new Date().toISOString();
  await audit(admin, {
    tenant_id: tenantId,
    actor_user_id: userResp.user.id,
    actor_email: userResp.user.email ?? null,
    action: 'siteos.publish.production.start',
    target_type: 'website_project',
    target_id: project.id,
    payload: {
      blueprint_id: blueprintId,
      slug: blueprintRow.slug,
      artifact_sha256: release.manifest.artifact_sha256,
      evaluation_id: release.manifest.evaluation_id,
      preview_deployment_id: lastPreview.deployment_id,
      preview_evaluation_id: lastPreview.evaluation_id,
      cloudflare_project_name: cloudflareProjectName,
    },
  });

  let deployment;
  try {
    deployment = await deployPagesProduction({
      accountId: CLOUDFLARE_ACCOUNT_ID,
      apiToken: CLOUDFLARE_API_TOKEN,
      projectName: cloudflareProjectName,
      artifactSha256: release.manifest.artifact_sha256,
      files: release.files,
    });
  } catch (error) {
    const failure = normalizeCloudflareFailure(
      error,
      'Cloudflare production deployment failed',
    );
    await recordFailure({
      admin,
      projectId: project.id,
      tenantId,
      userId: userResp.user.id,
      userEmail: userResp.user.email ?? null,
      blueprintId,
      artifactSha256: release.manifest.artifact_sha256,
      evaluationId: release.manifest.evaluation_id,
      code: failure.code,
      message: failure.message,
      startedAt,
    });
    return jsonError(failure.status, failure.code, failure.message);
  }

  // The transport itself also enforces this, but the handler records the
  // invariant explicitly before setting any local live state.
  if (
    deployment.environment !== 'production'
    || deployment.branch !== deployment.project.productionBranch
  ) {
    await recordFailure({
      admin,
      projectId: project.id,
      tenantId,
      userId: userResp.user.id,
      userEmail: userResp.user.email ?? null,
      blueprintId,
      artifactSha256: release.manifest.artifact_sha256,
      evaluationId: release.manifest.evaluation_id,
      code: 'PRODUCTION_NOT_CONFIRMED',
      message: 'Cloudflare did not confirm the production branch/environment',
      startedAt,
    });
    return jsonError(
      502,
      'PRODUCTION_NOT_CONFIRMED',
      'Cloudflare did not confirm the production branch/environment',
    );
  }

  const completedAt = new Date().toISOString();
  const nextConfiguration = { ...configuration };
  nextConfiguration.siteos_cloudflare_project_name = deployment.project.name;
  nextConfiguration.siteos_last_production = {
    deployment_id: deployment.id,
    branch: deployment.branch,
    artifact_sha256: release.manifest.artifact_sha256,
    evaluation_id: release.manifest.evaluation_id,
    preview_deployment_id: lastPreview.deployment_id,
    deployed_at: completedAt,
  };

  const { error: projectUpdateErr } = await admin
    .from('website_projects')
    .update({
      status: 'live',
      deployment_url: deployment.url,
      last_deployed_at: completedAt,
      cloudflare_project_id: deployment.project.id,
      configuration: nextConfiguration,
    })
    .eq('id', project.id)
    .eq('tenant_id', tenantId);

  if (projectUpdateErr) {
    return jsonError(
      500,
      'PRODUCTION_STATE_NOT_RECORDED',
      `Cloudflare production exists but website project state could not be recorded: ${projectUpdateErr.message}`,
    );
  }

  const { error: blueprintUpdateErr } = await admin
    .from('siteos_blueprints')
    .update({ status: 'deployed' })
    .eq('id', blueprintId)
    .eq('tenant_id', tenantId);

  if (blueprintUpdateErr) {
    return jsonError(
      500,
      'BLUEPRINT_DEPLOY_STATE_NOT_RECORDED',
      `Cloudflare production exists but blueprint deploy state could not be recorded: ${blueprintUpdateErr.message}`,
    );
  }

  const { error: logErr } = await admin.from('deployment_logs').insert({
    project_id: project.id,
    tenant_id: tenantId,
    event_type: 'deploy',
    status: 'success',
    title: 'SiteOS Cloudflare production',
    message: deployment.url,
    details: {
      preview_only: false,
      cloudflare_deployment_id: deployment.id,
      cloudflare_project_name: deployment.project.name,
      branch: deployment.branch,
      artifact_sha256: release.manifest.artifact_sha256,
      blueprint_sha256: release.manifest.blueprint_sha256,
      evaluation_id: release.manifest.evaluation_id,
      preview_deployment_id: lastPreview.deployment_id,
      file_count: release.files.length,
      started_at: startedAt,
    },
    triggered_by: 'user',
    triggered_by_user_id: userResp.user.id,
    started_at: startedAt,
    completed_at: completedAt,
  });
  if (logErr) {
    return jsonError(
      500,
      'PRODUCTION_LOG_NOT_RECORDED',
      `Cloudflare production exists but deployment log failed: ${logErr.message}`,
    );
  }

  try {
    await audit(admin, {
      tenant_id: tenantId,
      actor_user_id: userResp.user.id,
      actor_email: userResp.user.email ?? null,
      action: 'siteos.publish.production.deployed',
      target_type: 'website_project',
      target_id: project.id,
      payload: {
        blueprint_id: blueprintId,
        slug: blueprintRow.slug,
        production_url: deployment.url,
        cloudflare_deployment_id: deployment.id,
        cloudflare_project_name: deployment.project.name,
        branch: deployment.branch,
        artifact_sha256: release.manifest.artifact_sha256,
        evaluation_id: release.manifest.evaluation_id,
        preview_deployment_id: lastPreview.deployment_id,
      },
    });
  } catch (error) {
    return jsonError(
      500,
      'PRODUCTION_AUDIT_NOT_RECORDED',
      `Cloudflare production exists but completion audit failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return jsonResponse({
    ok: true,
    production: {
      url: deployment.url,
      deployment_id: deployment.id,
      project_name: deployment.project.name,
      branch: deployment.branch,
      environment: deployment.environment,
      artifact_sha256: release.manifest.artifact_sha256,
      evaluation_id: release.manifest.evaluation_id,
      preview_deployment_id: lastPreview.deployment_id,
      deployed_at: completedAt,
      production: true,
    },
  });
}

function readLastPreview(value: unknown): LastPreview | null {
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

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
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
  const code = error instanceof CloudflarePagesError
    ? error.code
    : 'CLOUDFLARE_PRODUCTION_FAILED';
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof CloudflarePagesError
    && error.status >= 400
    && error.status < 500
    ? error.status
    : 502;
  return { status, code, message };
}

function cloudflareFailure(error: unknown, fallback: string): Response {
  const failure = normalizeCloudflareFailure(error, fallback);
  return jsonError(failure.status, failure.code, failure.message);
}

async function recordFailure(args: {
  admin: AdminClient;
  projectId: string;
  tenantId: string;
  userId: string;
  userEmail: string | null;
  blueprintId: string;
  artifactSha256: string;
  evaluationId: string;
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
      title: 'SiteOS Cloudflare production fehlgeschlagen',
      message: args.message,
      details: {
        preview_only: false,
        error_code: args.code,
        artifact_sha256: args.artifactSha256,
        evaluation_id: args.evaluationId,
      },
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
      action: 'siteos.publish.production.failed',
      target_type: 'website_project',
      target_id: args.projectId,
      payload: {
        blueprint_id: args.blueprintId,
        artifact_sha256: args.artifactSha256,
        evaluation_id: args.evaluationId,
        error_code: args.code,
      },
    });
  } catch {
    // Preserve original transport error.
  }
}

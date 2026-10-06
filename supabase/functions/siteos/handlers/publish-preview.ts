// siteos/publish-preview — governed Cloudflare Pages preview transport.
//
// This endpoint does not accept files, HTML, hashes or a deployment URL from
// the browser. It obtains the release exclusively from handleExport(), i.e.
// the already governed server-side path:
//
//   Blueprint -> fresh gate -> explicit GO -> exact release bundle
//             -> Cloudflare Direct Upload -> PREVIEW branch only.
//
// Production remains a different, not-yet-wired action.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { audit } from '../../_shared/auditLog.ts';
import { handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../../_shared/gateway.ts';
import { CloudflarePagesError, deployPagesPreview, type ReleaseFile } from '../cloudflare-pages.ts';
import { handleExport } from './publish-gate.ts';

const PREVIEW_ROLES = new Set(['owner', 'admin']);

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

export async function handle(req: Request): Promise<Response> {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  // Clone before consuming the body. The clone is handed to the existing
  // governed export handler; this endpoint never recreates its gate logic.
  const exportRequest = req.clone();

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
  if (body.confirm_go !== true || body.confirm_preview !== true) {
    return jsonError(400, 'BAD_REQUEST', 'confirm_go and confirm_preview must both be true');
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
    return jsonError(503, 'CLOUDFLARE_NOT_CONFIGURED', 'Cloudflare preview transport is not configured');
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: member } = await admin
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userResp.user.id)
    .maybeSingle<{ role: string }>();

  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
  if (!PREVIEW_ROLES.has(member.role)) {
    return jsonError(403, 'FORBIDDEN', `role "${member.role}" may not deploy a SiteOS preview`);
  }

  // Resolve deployment target server-side. A browser-supplied project id
  // would let a request choose a different website target than the blueprint.
  const { data: blueprintRow } = await admin
    .from('siteos_blueprints')
    .select('id, project_id, slug')
    .eq('id', blueprintId)
    .eq('tenant_id', tenantId)
    .maybeSingle<{ id: string; project_id: string | null; slug: string }>();

  if (!blueprintRow) return jsonError(404, 'NOT_FOUND', 'blueprint not found for this tenant');
  if (!blueprintRow.project_id) {
    return jsonError(
      409,
      'PROJECT_REQUIRED',
      'This SiteOS blueprint is not bound to a website project; create/bind the project before preview deployment.',
    );
  }

  const { data: project } = await admin
    .from('website_projects')
    .select('id, name, cloudflare_project_id, configuration')
    .eq('id', blueprintRow.project_id)
    .eq('tenant_id', tenantId)
    .maybeSingle<{
      id: string;
      name: string;
      cloudflare_project_id: string | null;
      configuration: Record<string, unknown> | null;
    }>();

  if (!project) return jsonError(409, 'PROJECT_NOT_FOUND', 'bound website project not found for this tenant');

  // Only after all local deployment prerequisites exist do we record/release
  // the governed GO. handleExport performs a fresh gate evaluation and returns
  // the exact bytes bound to its artifact hash.
  const releaseResponse = await handleExport(exportRequest);
  if (!releaseResponse.ok) return releaseResponse;

  let release: PublishExportPayload;
  try {
    release = await releaseResponse.json() as PublishExportPayload;
  } catch {
    return jsonError(500, 'INTERNAL', 'governed publish export returned invalid json');
  }

  if (release?.manifest?.format !== 'realsync-siteos-export/1' || !Array.isArray(release.files)) {
    return jsonError(500, 'INTERNAL', 'governed publish export returned an invalid manifest');
  }

  const startedAt = new Date().toISOString();

  try {
    const deployment = await deployPagesPreview({
      accountId: CLOUDFLARE_ACCOUNT_ID,
      apiToken: CLOUDFLARE_API_TOKEN,
      projectId: project.id,
      projectName: project.name,
      artifactSha256: release.manifest.artifact_sha256,
      files: release.files,
    });

    // Never mark this project live here. Preview is a distinct state and URL.
    const configuration = isRecord(project.configuration) ? { ...project.configuration } : {};
    configuration.siteos_cloudflare_project_name = deployment.project.name;
    configuration.siteos_last_preview = {
      deployment_id: deployment.id,
      branch: deployment.branch,
      artifact_sha256: release.manifest.artifact_sha256,
      evaluation_id: release.manifest.evaluation_id,
      deployed_at: new Date().toISOString(),
    };

    const projectUpdate: Record<string, unknown> = {
      status: 'preview',
      preview_url: deployment.url,
      configuration,
    };
    if (deployment.project.id && deployment.project.id !== project.cloudflare_project_id) {
      projectUpdate.cloudflare_project_id = deployment.project.id;
    }

    const { error: updateErr } = await admin
      .from('website_projects')
      .update(projectUpdate)
      .eq('id', project.id)
      .eq('tenant_id', tenantId);

    if (updateErr) {
      console.error(JSON.stringify({
        level: 'error',
        scope: 'siteos_preview_project_update_failed',
        project_id: project.id,
        error: updateErr.message,
      }));
      return jsonError(
        500,
        'PREVIEW_STATE_NOT_RECORDED',
        'Cloudflare preview exists but local project state could not be recorded',
      );
    }

    await admin.from('deployment_logs').insert({
      project_id: project.id,
      tenant_id: tenantId,
      event_type: 'deploy',
      status: 'success',
      title: 'SiteOS Cloudflare preview',
      message: deployment.url,
      details: {
        preview_only: true,
        cloudflare_deployment_id: deployment.id,
        cloudflare_project_name: deployment.project.name,
        branch: deployment.branch,
        artifact_sha256: release.manifest.artifact_sha256,
        blueprint_sha256: release.manifest.blueprint_sha256,
        evaluation_id: release.manifest.evaluation_id,
        file_count: release.files.length,
        started_at: startedAt,
      },
      triggered_by: 'user',
      triggered_by_user_id: userResp.user.id,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    });

    await audit(admin, {
      tenant_id: tenantId,
      actor_user_id: userResp.user.id,
      actor_email: userResp.user.email ?? null,
      action: 'siteos.publish.preview.deploy',
      target_type: 'website_project',
      target_id: project.id,
      payload: {
        blueprint_id: blueprintId,
        slug: blueprintRow.slug,
        preview_only: true,
        preview_url: deployment.url,
        cloudflare_deployment_id: deployment.id,
        cloudflare_project_name: deployment.project.name,
        branch: deployment.branch,
        artifact_sha256: release.manifest.artifact_sha256,
        evaluation_id: release.manifest.evaluation_id,
      },
    });

    return jsonResponse({
      ok: true,
      preview: {
        url: deployment.url,
        deployment_id: deployment.id,
        project_name: deployment.project.name,
        branch: deployment.branch,
        environment: deployment.environment,
        artifact_sha256: release.manifest.artifact_sha256,
        evaluation_id: release.manifest.evaluation_id,
        production: false,
      },
    });
  } catch (error) {
    const code = error instanceof CloudflarePagesError ? error.code : 'CLOUDFLARE_PREVIEW_FAILED';
    const message = error instanceof Error ? error.message : 'Cloudflare preview deployment failed';
    const status = error instanceof CloudflarePagesError && error.status >= 400 && error.status < 500
      ? error.status
      : 502;

    await admin.from('deployment_logs').insert({
      project_id: project.id,
      tenant_id: tenantId,
      event_type: 'deploy',
      status: 'failed',
      title: 'SiteOS Cloudflare preview fehlgeschlagen',
      message,
      details: {
        preview_only: true,
        error_code: code,
        artifact_sha256: release.manifest.artifact_sha256,
        evaluation_id: release.manifest.evaluation_id,
      },
      triggered_by: 'user',
      triggered_by_user_id: userResp.user.id,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    });

    await audit(admin, {
      tenant_id: tenantId,
      actor_user_id: userResp.user.id,
      actor_email: userResp.user.email ?? null,
      action: 'siteos.publish.preview.failed',
      target_type: 'website_project',
      target_id: project.id,
      payload: {
        blueprint_id: blueprintId,
        artifact_sha256: release.manifest.artifact_sha256,
        evaluation_id: release.manifest.evaluation_id,
        error_code: code,
      },
    });

    console.error(JSON.stringify({
      level: 'error',
      scope: 'siteos_cloudflare_preview_failed',
      project_id: project.id,
      artifact_sha256: release.manifest.artifact_sha256,
      code,
      error: message,
    }));

    return jsonError(status, code, message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

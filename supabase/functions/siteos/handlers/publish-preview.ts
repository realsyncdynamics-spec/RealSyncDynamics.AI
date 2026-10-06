// siteos/publish-preview — governed Cloudflare Pages preview transport.
//
// Preview is deliberately before production GO:
//
//   Blueprint -> fresh publish-gate evaluation -> exact artifact hash check
//             -> Cloudflare PREVIEW branch
//             -> user reviews the real preview
//             -> only later: publish-export with confirm_preview + GO.
//
// The browser never supplies files, HTML, artifact hashes or a project target.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { audit } from '../../_shared/auditLog.ts';
import { handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../../_shared/gateway.ts';
import {
  buildDeploymentArtifact,
  type PublishGateEvaluation,
  type SiteBlueprint,
} from '../../../../packages/siteos-core/src/index.ts';
import { CloudflarePagesError, deployPagesPreview } from '../cloudflare-pages.ts';
import { handle as handlePublishGate } from './publish-gate.ts';

const PREVIEW_ROLES = new Set(['owner', 'admin']);

export async function handle(req: Request): Promise<Response> {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  // Clone before reading the request. The clone is evaluated by the canonical
  // publish-gate handler; this transport does not reproduce its policy logic.
  const gateRequest = req.clone();

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
  if (body.confirm_preview_deploy !== true) {
    return jsonError(400, 'BAD_REQUEST', 'confirm_preview_deploy must be true');
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

  // Resolve target and content server-side. No browser-selected project.
  const { data: blueprintRow } = await admin
    .from('siteos_blueprints')
    .select('id, project_id, slug, blueprint')
    .eq('id', blueprintId)
    .eq('tenant_id', tenantId)
    .maybeSingle<{
      id: string;
      project_id: string | null;
      slug: string;
      blueprint: SiteBlueprint;
    }>();

  if (!blueprintRow?.blueprint) return jsonError(404, 'NOT_FOUND', 'blueprint not found for this tenant');
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

  // Fresh canonical evaluation. This writes the evidence snapshot/custody that
  // the gate itself requires, but it does NOT write a publish GO.
  const gateResponse = await handlePublishGate(gateRequest);
  if (!gateResponse.ok) return gateResponse;

  let evaluation: PublishGateEvaluation;
  try {
    const payload = await gateResponse.json() as { ok?: boolean; evaluation?: PublishGateEvaluation };
    if (!payload?.evaluation) throw new Error('missing evaluation');
    evaluation = payload.evaluation;
  } catch {
    return jsonError(500, 'INTERNAL', 'publish gate returned invalid json');
  }

  if (!evaluation.publishable) {
    const reason = evaluation.blockers.length > 0
      ? evaluation.blockers.join(' · ')
      : evaluation.human_approval_required
        ? 'Für diesen Stand steht eine Freigabe aus.'
        : 'Der Publish Gate hat diesen Stand nicht bestanden.';
    return jsonError(
      409,
      'NOT_PUBLISHABLE',
      `Preview nicht veröffentlichbar (Bewertung ${evaluation.evaluation_id.slice(0, 8)}): ${reason}`,
    );
  }

  // Deterministically rebuild exactly what publish-gate evaluated and bind
  // transport to its hash. If these differ, nothing leaves the system.
  const artifact = await buildDeploymentArtifact(blueprintRow.blueprint, {
    baseUrl,
    presentation: 'showcase',
  });
  if (artifact.artifactSha256 !== evaluation.artifact_sha256) {
    return jsonError(
      409,
      'STALE_ARTIFACT',
      'Preview artifact differs from the freshly evaluated artifact; retry evaluation.',
    );
  }

  const startedAt = new Date().toISOString();

  try {
    const deployment = await deployPagesPreview({
      accountId: CLOUDFLARE_ACCOUNT_ID,
      apiToken: CLOUDFLARE_API_TOKEN,
      projectId: project.id,
      projectName: project.name,
      artifactSha256: artifact.artifactSha256,
      files: artifact.files,
    });

    // Never mark this project live here. Preview state is separate.
    const configuration = isRecord(project.configuration) ? { ...project.configuration } : {};
    configuration.siteos_cloudflare_project_name = deployment.project.name;
    configuration.siteos_last_preview = {
      deployment_id: deployment.id,
      branch: deployment.branch,
      artifact_sha256: artifact.artifactSha256,
      evaluation_id: evaluation.evaluation_id,
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
        artifact_sha256: artifact.artifactSha256,
        blueprint_sha256: artifact.blueprintSha256,
        evaluation_id: evaluation.evaluation_id,
        file_count: artifact.files.length,
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
        artifact_sha256: artifact.artifactSha256,
        evaluation_id: evaluation.evaluation_id,
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
        artifact_sha256: artifact.artifactSha256,
        evaluation_id: evaluation.evaluation_id,
        production: false,
      },
    });
  } catch (error) {
    const code = error instanceof CloudflarePagesError ? error.code : 'CLOUDFLARE_PREVIEW_FAILED';
    const message = error instanceof Error ? error.message : 'Cloudflare preview deployment failed';
    const status = error instanceof CloudflarePagesError && error.status >= 400 && error.status < 500
      ? error.status
      : 502;

    try {
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
          artifact_sha256: artifact.artifactSha256,
          evaluation_id: evaluation.evaluation_id,
        },
        triggered_by: 'user',
        triggered_by_user_id: userResp.user.id,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      });
    } catch {
      // Preserve the original transport failure.
    }

    try {
      await audit(admin, {
        tenant_id: tenantId,
        actor_user_id: userResp.user.id,
        actor_email: userResp.user.email ?? null,
        action: 'siteos.publish.preview.failed',
        target_type: 'website_project',
        target_id: project.id,
        payload: {
          blueprint_id: blueprintId,
          artifact_sha256: artifact.artifactSha256,
          evaluation_id: evaluation.evaluation_id,
          error_code: code,
        },
      });
    } catch {
      // Preserve the original transport failure.
    }

    console.error(JSON.stringify({
      level: 'error',
      scope: 'siteos_cloudflare_preview_failed',
      project_id: project.id,
      artifact_sha256: artifact.artifactSha256,
      code,
      error: message,
    }));

    return jsonError(status, code, message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

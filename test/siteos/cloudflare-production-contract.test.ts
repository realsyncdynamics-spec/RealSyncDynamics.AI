import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const transport = readFileSync(
  resolve(ROOT, 'supabase/functions/siteos/cloudflare-pages.ts'),
  'utf8',
);
const handler = readFileSync(
  resolve(ROOT, 'supabase/functions/siteos/handlers/publish-production.ts'),
  'utf8',
);
const router = readFileSync(
  resolve(ROOT, 'supabase/functions/siteos/index.ts'),
  'utf8',
);
const api = readFileSync(
  resolve(ROOT, 'src/features/siteos/siteOsApi.ts'),
  'utf8',
);

describe('SiteOS Cloudflare production — governed cutover contract', () => {
  it('requires a real recorded preview before production GO', () => {
    const previewRequired = handler.indexOf("'PREVIEW_REQUIRED'");
    const artifactBuild = handler.indexOf('buildDeploymentArtifact(blueprintRow.blueprint');
    const remoteProject = handler.indexOf('getPagesProject({');
    const remotePreview = handler.indexOf('getPagesDeployment({');
    const exportCall = handler.indexOf('handleExport(exportRequest)');

    expect(previewRequired).toBeGreaterThanOrEqual(0);
    expect(artifactBuild).toBeGreaterThan(previewRequired);
    expect(remoteProject).toBeGreaterThan(artifactBuild);
    expect(remotePreview).toBeGreaterThan(remoteProject);
    expect(exportCall).toBeGreaterThan(remotePreview);
  });

  it('binds production to the exact artifact that was really previewed', () => {
    expect(handler).toContain('preflightArtifact.artifactSha256 !== lastPreview.artifact_sha256');
    expect(handler).toContain("remotePreview.environment !== 'preview'");
    expect(handler).toContain('remotePreview.branch !== lastPreview.branch');
    expect(handler).toContain('normalizeUrl(remotePreview.url) !== normalizeUrl(project.preview_url)');
    expect(handler).toContain('release.manifest.artifact_sha256 !== lastPreview.artifact_sha256');
    expect(handler).toContain('release.manifest.artifact_sha256 !== preflightArtifact.artifactSha256');
    expect(handler).toContain("'PREVIEW_STALE'");
    expect(handler).toContain("'PREVIEW_REMOTE_MISMATCH'");
  });

  it('records GO only through the existing publish-export path', () => {
    expect(handler).toContain('const exportRequest = req.clone()');
    expect(handler).toContain('const releaseResponse = await handleExport(exportRequest)');
    expect(handler).toContain('body.confirm_preview !== true');
    expect(handler).toContain('body.confirm_go !== true');
    expect(handler).not.toContain("action: 'siteos.publish.go'");
  });

  it('never accepts files, artifact hashes or a deployment target from the browser', () => {
    expect(handler).not.toContain('body.files');
    expect(handler).not.toContain('body.artifact_sha256');
    expect(handler).not.toContain('body.project_id');
    expect(handler).not.toContain('body.cloudflare_project');
    expect(handler).not.toContain('body.production_branch');
    expect(handler).not.toContain('body.deployment_url');
  });

  it('production transport never creates a Pages project implicitly', () => {
    const start = transport.indexOf('export async function deployPagesProduction');
    const end = transport.indexOf('async function ensurePagesProject', start);
    const src = transport.slice(start, end);

    expect(src).toContain('fetchPagesProject(');
    expect(src).toContain("'CLOUDFLARE_PROJECT_REQUIRED'");
    expect(src).toContain('branch: project.productionBranch');
    expect(src).toContain("deployment.environment !== 'production'");
    expect(src).not.toContain('ensurePagesProject(');
    expect(src).not.toContain("body: JSON.stringify({ name:");
  });

  it('verifies the concrete preview deployment remotely', () => {
    expect(transport).toContain('export async function getPagesDeployment');
    expect(transport).toContain('/deployments/\${encodeURIComponent(args.deploymentId)}');
    expect(transport).toContain('deployment.deployment_trigger?.metadata?.branch');
  });

  it('marks local live state only after Cloudflare confirms production', () => {
    const deploy = handler.indexOf('deployment = await deployPagesProduction({');
    const confirmed = handler.indexOf("deployment.environment !== 'production'");
    const live = handler.indexOf("status: 'live'");
    const url = handler.indexOf('deployment_url: deployment.url');

    expect(deploy).toBeGreaterThanOrEqual(0);
    expect(confirmed).toBeGreaterThan(deploy);
    expect(live).toBeGreaterThan(confirmed);
    expect(url).toBeGreaterThan(live);
    expect(handler).toContain("action: 'siteos.publish.production.start'");
    expect(handler).toContain("action: 'siteos.publish.production.deployed'");
  });

  it('does not touch custom domains, DNS or SSL', () => {
    expect(handler).not.toContain('website_domains');
    expect(handler).not.toContain('dns');
    expect(handler).not.toContain('ssl');
    expect(handler).not.toContain('custom_domains');
    expect(transport).not.toContain('/domains');
  });

  it('registers one explicit route and a narrow client contract', () => {
    expect(router).toContain("'publish-production': publishProduction");

    const start = api.indexOf('export async function deployPublishProduction');
    const end = api.indexOf('// ── Anonymer Build', start);
    const src = api.slice(start, end);

    expect(src).toContain("invoke('siteos/publish-production'");
    expect(src).toContain('tenant_id: string');
    expect(src).toContain('blueprint_id: string');
    expect(src).toContain('confirm_preview: true');
    expect(src).toContain('confirm_go: true');
    expect(src).not.toContain('files:');
    expect(src).not.toContain('artifact_sha256:');
    expect(src).not.toContain('project_id:');
    expect(src).not.toContain('production_branch:');
  });
});

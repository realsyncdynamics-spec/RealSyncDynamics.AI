import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const transport = readFileSync(
  resolve(ROOT, 'supabase/functions/siteos/cloudflare-pages.ts'),
  'utf8',
);
const handler = readFileSync(
  resolve(ROOT, 'supabase/functions/siteos/handlers/publish-preview.ts'),
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

describe('SiteOS Cloudflare preview — Direct Upload contract', () => {
  it('uses the same Pages asset-key algorithm/version as current Wrangler', () => {
    expect(transport).toContain("from 'npm:blake3-wasm@2.1.5'");
    expect(transport).toContain("blake3hash(base64 + extension).toString('hex').slice(0, 32)");
    expect(transport).toContain('utf8ToBase64(file.content)');
  });

  it('implements the official Direct Upload sequence', () => {
    expect(transport).toContain('/upload-token');
    expect(transport).toContain('/pages/assets/check-missing');
    expect(transport).toContain('/pages/assets/upload');
    expect(transport).toContain('/pages/assets/upsert-hashes');
    expect(transport).toContain('/deployments');
    expect(transport).toContain("form.set('manifest', JSON.stringify(manifest))");
  });

  it('is preview-only and cannot silently target the production branch', () => {
    expect(transport).toContain("const branch = \`preview-\${args.artifactSha256.slice(0, 12)}\`");
    expect(transport).toContain('project.productionBranch === branch');
    expect(transport).toContain("'PREVIEW_BRANCH_IS_PRODUCTION'");
    expect(transport).toContain("production_branch: 'main'");
    expect(transport).not.toContain("form.set('branch', 'main')");
    expect(transport).not.toContain("form.set('commit_hash', args.artifactSha256)");
  });

  it('never accepts release files, GO state or deployment target from the browser', () => {
    expect(handler).toContain('const gateRequest = req.clone()');
    expect(handler).toContain('const gateResponse = await handlePublishGate(gateRequest)');
    expect(handler).toContain("select('id, project_id, slug, blueprint')");
    expect(handler).toContain("'PROJECT_REQUIRED'");
    expect(handler).toContain(".eq('id', blueprintRow.project_id)");
    expect(handler).not.toContain('handleExport');
    expect(handler).not.toContain('body.project_id');
    expect(handler).not.toContain('body.files');
    expect(handler).not.toContain('body.artifact_sha256');
    expect(handler).not.toContain('body.cloudflare_project');
    expect(handler).not.toContain('body.confirm_go');
    expect(handler).not.toContain("'siteos.publish.go'");
  });

  it('does not mark a preview as a production deployment', () => {
    expect(handler).toContain("status: 'preview'");
    expect(handler).toContain('preview_url: deployment.url');
    expect(handler).toContain('production: false');
    expect(handler).not.toContain("status: 'live'");
    expect(handler).not.toContain('deployment_url: deployment.url');
    expect(handler).not.toContain('last_deployed_at');
    expect(handler).not.toContain('website_domains');
  });

  it('checks local prerequisites, evaluates fresh, then binds transport to the evaluated artifact', () => {
    const config = handler.indexOf('CLOUDFLARE_NOT_CONFIGURED');
    const project = handler.indexOf("'PROJECT_REQUIRED'");
    const gate = handler.indexOf('handlePublishGate(gateRequest)');
    const build = handler.indexOf('buildDeploymentArtifact(blueprintRow.blueprint');
    const hashCheck = handler.indexOf('artifact.artifactSha256 !== evaluation.artifact_sha256');
    const upload = handler.indexOf('deployPagesPreview({');
    expect(config).toBeGreaterThanOrEqual(0);
    expect(project).toBeGreaterThan(config);
    expect(gate).toBeGreaterThan(project);
    expect(build).toBeGreaterThan(gate);
    expect(hashCheck).toBeGreaterThan(build);
    expect(upload).toBeGreaterThan(hashCheck);
  });

  it('registers one explicit preview route and a narrow client request', () => {
    expect(router).toContain("'publish-preview': publishPreview");
    const start = api.indexOf('export async function deployPublishPreview');
    const end = api.indexOf('// ── Anonymer Build', start);
    const src = api.slice(start, end);
    expect(src).toContain("invoke('siteos/publish-preview'");
    expect(src).toContain('tenant_id: string');
    expect(src).toContain('blueprint_id: string');
    expect(src).toContain('confirm_preview_deploy: true');
    expect(src).not.toContain('confirm_go: true');
    expect(src).not.toContain('confirm_preview: true');
    expect(src).not.toContain('files:');
    expect(src).not.toContain('artifact_sha256:');
    expect(src).not.toContain('project_id:');
  });
});

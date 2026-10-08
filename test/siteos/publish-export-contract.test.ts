import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const handler = readFileSync(
  resolve(ROOT, 'supabase/functions/siteos/handlers/publish-gate.ts'),
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

function exportHandlerSource(): string {
  const start = handler.indexOf('export async function handleExport');
  const end = handler.indexOf('// ─────────────────────────────────────────────────────────────────────\n// Auswertung', start);
  if (start < 0 || end < 0) throw new Error('handleExport source not found');
  return handler.slice(start, end);
}

describe('SiteOS publish-export — governed GO contract', () => {
  it('is registered as a SiteOS route and remains an export, not a deploy endpoint', () => {
    expect(router).toContain("'publish-export': publishExport");
    expect(router).toContain('handleExport as publishExport');
    const src = exportHandlerSource();
    expect(src).not.toContain('cloudflare-deployer');
    expect(src).not.toContain('website-domain-manager');
    expect(src).not.toMatch(/fetch\s*\(/);
  });

  it('requires publish entitlement, publisher role, explicit GO and confirmed preview', () => {
    const src = exportHandlerSource();
    expect(src).toContain('gateSitePublish(ctx.admin, ctx.tenantId)');
    expect(handler).toContain("const PUBLISHER_ROLES = new Set(['owner', 'admin'])");
    expect(src).toContain('PUBLISHER_ROLES.has(ctx.role)');
    expect(src).toContain('body.confirm_go !== true');
    expect(src).toContain('body.confirm_preview !== true');
  });

  it('always performs a fresh gate evaluation for the requested blueprint', () => {
    const src = exportHandlerSource();
    expect(src).toContain('runEvaluation(ctx, blueprintId, baseUrl)');
    expect(src).not.toContain("from('siteos_publish_evaluations')");
    expect(src).toContain('if (!evaluation.publishable)');
  });

  it('rebuilds the artifact server-side and releases only the evaluated hash', () => {
    const src = exportHandlerSource();
    expect(src).toContain('buildDeploymentArtifact(row.blueprint');
    expect(src).toContain('evaluation.artifact_sha256 !== artifact.artifactSha256');
    expect(src).toContain("'STALE_ARTIFACT'");
    expect(src).toContain("format: 'realsync-siteos-export/1'");
    expect(src).toContain('content: file.content');
  });

  it('records GO before returning files and fails closed when custody cannot be linked', () => {
    const src = exportHandlerSource();
    const custody = src.indexOf('appendCustodyEvent');
    const audit = src.indexOf("action: 'siteos.publish.go'");
    const response = src.indexOf('return jsonResponse({');
    expect(custody).toBeGreaterThanOrEqual(0);
    expect(audit).toBeGreaterThan(custody);
    expect(response).toBeGreaterThan(audit);
    expect(src).toContain("'siteos_publish_go_custody_failed'");
    expect(src).toContain('return jsonError(500');
  });

  it('client sends only identity, base URL and explicit confirmations — never blueprint/gate claims', () => {
    const start = api.indexOf('export async function exportPublish');
    const end = api.indexOf('export interface PublishPreviewResponse', start);
    const src = api.slice(start, end);
    expect(src).toContain("invoke('siteos/publish-export'");
    expect(src).toContain('blueprint_id: string');
    expect(src).toContain('confirm_go: true');
    expect(src).toContain('confirm_preview: true');
    expect(src).not.toMatch(/\bblueprint\s*:/);
    expect(src).not.toMatch(/\btheme\s*:/);
    expect(src).not.toMatch(/\bbackend\s*:/);
    expect(src).not.toMatch(/\bpublishable\s*:/);
    expect(src).not.toMatch(/\bartifact_sha256\s*:/);
  });
});

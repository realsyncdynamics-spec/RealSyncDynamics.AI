import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const handler = readFileSync(
  resolve(ROOT, 'supabase/functions/siteos/handlers/project-bind.ts'),
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

describe('SiteOS project-bind — Website Operations bridge contract', () => {
  it('requires authenticated membership, owner/admin and siteos.publish', () => {
    expect(handler).toContain("authHeader?.startsWith('Bearer ')");
    expect(handler).toContain(".from('memberships')");
    expect(handler).toContain("const BIND_ROLES = new Set(['owner', 'admin'])");
    expect(handler).toContain("gateFeature(admin, tenantId, 'siteos.publish')");
  });

  it('binds only the latest blueprint of the tenant', () => {
    expect(handler).toContain(".eq('id', blueprintId)");
    expect(handler).toContain(".eq('tenant_id', tenantId)");
    expect(handler).toContain(".eq('slug', blueprint.slug)");
    expect(handler).toContain(".order('version', { ascending: false })");
    expect(handler).toContain("latest.id !== blueprint.id");
    expect(handler).toContain("'STALE_BLUEPRINT'");
  });

  it('is idempotent and refuses client-selected project/deployment targets', () => {
    expect(handler).toContain('if (blueprint.project_id)');
    expect(handler).toContain("created: false");
    expect(handler).not.toContain('body.project_id');
    expect(handler).not.toContain('body.cloudflare_project');
    expect(handler).not.toContain('body.cloudflare_project_id');
    expect(handler).not.toContain('body.production_branch');
    expect(handler).not.toContain('body.domain');
    expect(handler).not.toContain('body.deployment_url');
  });

  it('creates only a draft website project and conditionally binds it', () => {
    expect(handler).toContain(".from('website_projects')");
    expect(handler).toContain("status: 'draft'");
    expect(handler).toContain('siteos_bound_blueprint_id: blueprint.id');
    expect(handler).toContain(".update({ project_id: inserted.id })");
    expect(handler).toContain(".is('project_id', null)");
    expect(handler).toContain('cleanupProject(admin, tenantId, inserted.id)');
    expect(handler).not.toContain("status: 'preview'");
    expect(handler).not.toContain("status: 'live'");
  });

  it('writes a governance audit for a new binding', () => {
    expect(handler).toContain("action: 'siteos.project.bind'");
    expect(handler).toContain("target_type: 'website_project'");
    expect(handler).toContain('blueprint_id: blueprint.id');
    expect(handler).toContain('version: blueprint.version');
  });

  it('is registered in the router and keeps the browser contract narrow', () => {
    expect(router).toContain("'project-bind': projectBind");

    const start = api.indexOf('export async function bindSiteProject');
    const end = api.indexOf('// ── Publish Gate', start);
    const src = api.slice(start, end);

    expect(src).toContain("invoke('siteos/project-bind'");
    expect(src).toContain('tenant_id: string');
    expect(src).toContain('blueprint_id: string');
    expect(src).not.toContain('project_id:');
    expect(src).not.toContain('cloudflare');
    expect(src).not.toContain('domain');
  });
});

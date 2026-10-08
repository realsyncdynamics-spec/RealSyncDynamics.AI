import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(
  resolve(__dirname, '../../supabase/functions/cloudflare-deployer/index.ts'),
  'utf8',
);

describe('cloudflare-deployer — no simulated production success', () => {
  it('fails closed for every action whose implementation is still a placeholder', () => {
    for (const action of ['upload-assets', 'deploy-to-pages', 'setup-domain', 'validate-ssl']) {
      expect(src).toContain(`'${action}'`);
    }
    expect(src).toContain("501");
    expect(src).toContain("'NOT_IMPLEMENTED'");
    expect(src).toContain('simulatedActions.has(body.action)');
  });

  it('does not remove tenant/project authorization before the fail-closed guard', () => {
    const auth = src.indexOf('requireAuthAndTenant');
    const project = src.indexOf("from('website_projects')");
    const guard = src.indexOf('simulatedActions.has(body.action)');
    expect(auth).toBeGreaterThanOrEqual(0);
    expect(project).toBeGreaterThan(auth);
    expect(guard).toBeGreaterThan(project);
  });

  it('keeps the only real Cloudflare API operation separate', () => {
    const guard = src.indexOf('simulatedActions.has(body.action)');
    const create = src.indexOf("case 'create-pages-project'");
    expect(create).toBeGreaterThan(guard);
    expect(src).toContain('callCloudflareAPI');
  });
});

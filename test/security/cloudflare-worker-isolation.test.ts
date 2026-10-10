import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wrangler = readFileSync('wrangler-workers.toml', 'utf8');
const router = readFileSync('src/workers/index.ts', 'utf8');

describe('Cloudflare Worker production isolation', () => {
  it('keeps production routing disabled until tenant authorization is implemented', () => {
    expect(wrangler).not.toMatch(/\broute\s*=/);
    expect(wrangler).not.toMatch(/\[\[env\.production\.routes\]\]/);
    expect(wrangler).not.toMatch(/custom_domain\s*=\s*true/);
    expect(wrangler).not.toContain('api.realsyncdynamicsai.de');
  });

  it('uses the live worker SSoT and only the approved production KV binding', () => {
    expect(wrangler).toContain('name = "realsyncdynamics"');
    expect(wrangler).toContain('binding = "POLICY_CACHE"');
    expect(wrangler).toContain('id = "5bb700e74b83404caee6223533db1e90"');
    expect(wrangler).not.toContain('SESSION_CACHE');
    expect(wrangler).not.toContain('EVIDENCE_VAULT');
    expect(wrangler).not.toContain('realsyncdynamics.ai');
  });

  it('does not wire privileged tenant-scoped policy/evidence handlers into the public router', () => {
    expect(router).not.toContain('./kv-cache/');
    expect(router).not.toContain('./r2-evidence/');
    expect(router).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(router).not.toMatch(/\/api\/policies\//);
    expect(router).not.toMatch(/\/api\/evidence\//);
    expect(router).not.toMatch(/\/api\/cache\/invalidate/);
  });
});

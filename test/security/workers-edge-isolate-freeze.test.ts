import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const WORKER_INDEX = readFileSync(resolve(ROOT, 'src/workers/index.ts'), 'utf8');
const KV_CACHE = readFileSync(resolve(ROOT, 'src/workers/kv-cache/index.ts'), 'utf8');
const VERIFY_JWT = readFileSync(resolve(ROOT, 'src/workers/verify-jwt/index.ts'), 'utf8');

describe('workers edge isolate freeze', () => {
  it('keeps policy GET on ai_policies with service-role credentials', () => {
    expect(KV_CACHE).toContain('/rest/v1/ai_policies');
    expect(KV_CACHE).toContain('env.SUPABASE_URL');
    const start = KV_CACHE.indexOf('/rest/v1/ai_policies');
    const end = KV_CACHE.indexOf('if (!response.ok)');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const fetchSlice = KV_CACHE.slice(start, end);
    expect(fetchSlice).toContain("'Authorization':");
    expect(fetchSlice).toContain("'apikey': env.SUPABASE_SERVICE_ROLE_KEY");
  });

  it('takes tenantId for policy route from URL path parts', () => {
    const routeStart = WORKER_INDEX.indexOf('// Route: GET /api/policies/{tenantId}/{policyId}');
    const routeEnd = WORKER_INDEX.indexOf('// Route: DELETE /api/cache/invalidate/{tenantId}/{policyId}');
    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);
    const block = WORKER_INDEX.slice(routeStart, routeEnd);
    expect(block).toContain("url.pathname.match(/^\\/api\\/policies\\/[^/]+\\/[^/]+$/)");
    expect(block).toContain("const pathParts = url.pathname.split('/')");
    expect(block).toContain('const tenantId = pathParts[3]');
    expect(block).toContain('const policyId = pathParts[4]');
  });

  it('keeps tenant-wide invalidation handler without authorization gate', () => {
    const fnMatch = KV_CACHE.match(
      /export async function handleInvalidateTenant\([\s\S]*?\n}\n/
    );
    expect(fnMatch).not.toBeNull();
    const block = fnMatch?.[0] ?? '';
    expect(block).not.toContain("request.headers.get('Authorization')");
    expect(block).not.toContain("auth?.startsWith('Bearer ')");
    expect(block).not.toMatch(/\brequireAuthAndTenant\b/);
    expect(block).not.toMatch(/\bwebhookSecret\b/);
  });

  it('keeps verify-jwt stateless and does not persist raw auth/session tokens to KV', () => {
    expect(VERIFY_JWT).not.toContain('SESSION_CACHE.put(');
    expect(VERIFY_JWT).not.toContain('POLICY_CACHE.put(');
    expect(VERIFY_JWT).not.toContain('requireAuthAndTenant');
    expect(VERIFY_JWT).toContain('does NOT check tenant membership');
  });

  it('declares an explicit deploy freeze marker for policy routes', () => {
    expect(WORKER_INDEX).toContain('export const WORKER_POLICY_ROUTES_DEPLOY_FROZEN = true;');
    expect(WORKER_INDEX).toContain('WORKER_POLICY_ROUTES_DEPLOY_FROZEN');
    expect(WORKER_INDEX).toContain("url.pathname.startsWith('/api/policies/')");
    expect(WORKER_INDEX).toContain("url.pathname.startsWith('/api/cache/invalidate/')");
    expect(WORKER_INDEX).toContain("'worker_policy_routes_frozen'");
  });

  it('keeps secret values out of console logs in worker sources', () => {
    const combined = [WORKER_INDEX, KV_CACHE, VERIFY_JWT].join('\n');
    const consoleLines = combined
      .split('\n')
      .filter((line) => /console\.(?:log|error|warn|info)\(/.test(line));
    for (const line of consoleLines) {
      expect(line).not.toContain('SUPABASE_JWT_SECRET');
      expect(line).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    }
    expect(WORKER_INDEX).toContain('SUPABASE_JWT_SECRET');
    expect(WORKER_INDEX).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});

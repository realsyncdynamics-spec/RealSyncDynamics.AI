/**
 * Browser integration test: Auth/PostgREST are MOCKED by Playwright.
 * This is not a real Supabase login or production E2E acceptance test.
 * Actual PostgreSQL RLS is tested separately in chief-of-staff-rls.db.test.ts.
 * All Supabase network requests are intercepted locally, with no live writes.
 */
import { test, expect, type Page } from '@playwright/test';

const API = 'https://ebljyceifhnlzhjfyxup.supabase.co';
const STORAGE_KEY = 'sb-ebljyceifhnlzhjfyxup-auth-token';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
function fixtureSession() {
  const user = {
    id: USER, aud: 'authenticated', role: 'authenticated',
    email: 'browser-fixture@example.invalid', is_anonymous: false,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {}, created_at: '2026-11-20T11:00:00.000Z',
  };
  const access_token = [
    encode({ typ: 'JWT', alg: 'HS256' }),
    encode({ sub: USER, role: 'authenticated', aud: 'authenticated', exp: 4102444800, iat: 1784628000 }),
    'not-a-real-signature',
  ].join('.');
  return {
    access_token, refresh_token: 'not-a-real-refresh-token',
    token_type: 'bearer', expires_in: 1800000000, expires_at: 4102444800, user,
  };
}
const TASKS = [
  {
    id: '11111111-1111-4111-8111-111111111111', tenant_id: A,
    agent: 'operations', task: 'Alpha private blocker', status: 'blocked',
    priority: 'critical', created_at: '2026-11-20T11:00:00Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222', tenant_id: B,
    agent: 'security', task: 'Beta private blocker', status: 'failed',
    priority: 'high', created_at: '2026-11-20T11:00:00Z',
  },
];

function responseRange(size: number): string {
  return size === 0 ? '*/0' : '0-' + (size - 1) + '/' + size;
}

async function installFixture(page: Page, bRole: 'owner' | 'viewer') {
  const writes: string[] = [];
  await page.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
    localStorage.setItem('realsync.activeTenantId', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  }, { storageKey: STORAGE_KEY, session: fixtureSession() });

  await page.route(API + '/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const path = url.pathname;
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, HEAD, POST, OPTIONS',
      'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, prefer, accept',
      'access-control-expose-headers': 'content-range',
    };
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (/^\/rest\/v1\/agent_(tasks|decisions|observations)$/.test(path) &&
        !['HEAD', 'GET'].includes(method)) {
      writes.push(method + ' ' + path);
      await route.fulfill({ status: 403, headers: cors, json: { error: 'read-only fixture' } });
      return;
    }
    if (path === '/auth/v1/user') {
      await route.fulfill({ status: 200, headers: cors, json: fixtureSession().user });
      return;
    }
    if (path.startsWith('/auth/v1/')) {
      await route.fulfill({ status: 200, headers: cors, json: fixtureSession() });
      return;
    }
    if (path === '/rest/v1/memberships') {
      const select = url.searchParams.get('select') || '';
      if (select.includes('tenant:tenants')) {
        const memberships = [
          { role: 'owner', tenant: { id: A, name: 'Mandant Alpha', is_public_sector: false, industry: null } },
          { role: bRole, tenant: { id: B, name: 'Mandant Beta', is_public_sector: false, industry: null } },
        ];
        await route.fulfill({ status: 200, headers: cors, json: memberships });
      } else if (select === 'role') {
        const scoped = (url.searchParams.get('tenant_id') || '').replace('eq.', '');
        const authorized = scoped === A || (scoped === B && bRole === 'owner');
        await route.fulfill({ status: 200, headers: cors, json: authorized ? { role: 'owner' } : null });
      } else {
        await route.fulfill({ status: 200, headers: cors, json: [] });
      }
      return;
    }
    if (path === '/rest/v1/agent_tasks') {
      const tenant = (url.searchParams.get('tenant_id') || '').replace('eq.', '');
      const status = url.searchParams.get('status') || '';
      let rows = TASKS.filter(row => row.tenant_id === tenant);
      if (status.startsWith('eq.')) rows = rows.filter(row => row.status === status.slice(3));
      if (status.startsWith('in.(')) {
        const accepted = status.slice(4, -1).split(',');
        rows = rows.filter(row => accepted.includes(row.status));
      }
      const count = rows.length;
      const limit = Number(url.searchParams.get('limit') || 100);
      const headers = { ...cors, 'content-range': responseRange(count) };
      if (method === 'HEAD') await route.fulfill({ status: 200, headers, body: '' });
      else await route.fulfill({ status: 200, headers, json: rows.slice(0, limit) });
      return;
    }
    // All remaining Supabase reads, including registry, decision list,
    // observations, and entitlements RPCs, get deterministic empty fixtures.
    const headers = { ...cors, 'content-range': '*/0' };
    if (method === 'HEAD') await route.fulfill({ status: 200, headers, body: '' });
    else await route.fulfill({ status: 200, headers, json: [] });
  });
  return writes;
}

test.describe('Chief of Staff: browser fixture – two tenants', () => {
  test('two owner memberships: A and B data never appear together', async ({ page }) => {
    const writes = await installFixture(page, 'owner');
    await page.goto('/app/command-center');
    await expect(page.getByRole('button', { name: 'Arbeitsüberblick' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Arbeitsüberblick' }).click();
    await expect(page.getByText('Alpha private blocker')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Beta private blocker')).toHaveCount(0);
    await page.getByLabel('Mandant wählen').selectOption(B);
    await expect(page.getByText('Alpha private blocker')).toHaveCount(0);
    await expect(page.getByText('Beta private blocker')).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Mandant wählen').selectOption(A);
    await expect(page.getByText('Beta private blocker')).toHaveCount(0);
    await expect(page.getByText('Alpha private blocker')).toBeVisible({ timeout: 15_000 });
    expect(writes).toEqual([]);
  });

  test('viewer in B: unauthorized view fails closed after switching from A', async ({ page }) => {
    const writes = await installFixture(page, 'viewer');
    await page.goto('/app/command-center');
    await page.getByRole('button', { name: 'Arbeitsüberblick' }).click();
    await expect(page.getByText('Alpha private blocker')).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Mandant wählen').selectOption(B);
    await expect(page.getByText('Alpha private blocker')).toHaveCount(0);
    await expect(page.getByRole('alert').filter({ hasText: 'Nur Owner oder Admin' }))
      .toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Beta private blocker')).toHaveCount(0);
    expect(writes).toEqual([]);
  });
});

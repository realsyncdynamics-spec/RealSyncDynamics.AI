#!/usr/bin/env node
/**
 * Public, secret-free first-customer smoke gate.
 *
 * This intentionally does not attempt a real Stripe purchase. It verifies
 * that the public acquisition surfaces are reachable and that the protected
 * Governance Launch checkout refuses unauthenticated access instead of
 * accidentally exposing a tenant-scoped payment endpoint.
 *
 * Usage:
 *   node scripts/first-customer-readiness-check.mjs
 *   RSD_BASE_URL=https://staging.realsyncdynamicsai.de node scripts/first-customer-readiness-check.mjs
 */

const BASE_URL = (process.env.RSD_BASE_URL || 'https://realsyncdynamicsai.de').replace(/\/$/, '');
const SUPABASE_URL = (process.env.RSD_SUPABASE_URL || 'https://ebljyceifhnlzhjfyxup.supabase.co').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.RSD_CHECK_TIMEOUT_MS) || 15000;

async function request(url, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      headers: { 'user-agent': 'RealSyncDynamicsAI-FirstCustomerGate/1.0', ...(init.headers || {}) },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function html(path, marker) {
  const res = await request(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const body = await res.text();
  if (!body.includes(marker)) throw new Error(`${path}: missing marker ${JSON.stringify(marker)}`);
  return `HTTP ${res.status}`;
}

async function protectedCheckoutProbe() {
  const res = await request(`${SUPABASE_URL}/functions/v1/checkout-website-rebuild`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tenant_id: '00000000-0000-0000-0000-000000000000',
      source_url: 'https://example.com',
      tier: 'governance_launch',
      redesign: true,
    }),
  });
  if (res.status !== 401) {
    const text = await res.text().catch(() => '');
    throw new Error(`checkout protection: expected HTTP 401 without auth, got ${res.status}${text ? ` — ${text.slice(0, 180)}` : ''}`);
  }
  return 'HTTP 401 (protected)';
}

const checks = [
  ['homepage', () => html('/', 'RealSyncDynamics')],
  ['public audit', () => html('/audit', 'DSGVO-Audit')],
  ['site transformation', () => html('/handwerk-website', 'Website Transformation')],
  ['protected Governance Launch checkout', protectedCheckoutProbe],
];

let failed = 0;
console.log(`\nFirst-customer readiness gate: ${BASE_URL}\n`);
for (const [name, fn] of checks) {
  try {
    const result = await fn();
    console.log(`PASS  ${name}: ${result}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${name}: ${error?.message || String(error)}`);
  }
}

if (failed) {
  console.error(`\n${failed} first-customer gate(s) failed.`);
  process.exit(1);
}

console.log('\nAll public/protection gates passed. A real Stripe payment remains a production-credential acceptance test.');

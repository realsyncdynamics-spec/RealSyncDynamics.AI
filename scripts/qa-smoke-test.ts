#!/usr/bin/env -S node --experimental-strip-types
// QA Smoke Test — fetch-only health/contract probes against the public
// surface + Supabase Edge Functions. No Playwright, no auth tokens.
// Designed for post-deploy verification.
//
// Usage:
//   tsx scripts/qa-smoke-test.ts
//   SUPABASE_URL=https://x.supabase.co RSD_BASE_URL=https://x.de tsx scripts/qa-smoke-test.ts
//
// Exit code 1 if any test FAILs.

const BASE_URL     = process.env.RSD_BASE_URL ?? 'https://realsyncdynamicsai.de';
const SUPABASE_URL = (process.env.SUPABASE_URL ?? 'https://ebljyceifhnlzhjfyxup.supabase.co').replace(/\/$/, '');
const TIMEOUT_MS   = Number(process.env.RSD_SMOKE_TIMEOUT_MS) || 15_000;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY ?? '';

interface Result {
  name: string;
  ok: boolean;
  status?: number;
  detail: string;
}

interface Probe {
  name: string;
  run: () => Promise<Result>;
}

const probes: Probe[] = [
  {
    name: '/audit reachable',
    run: async () => fetchAndExpect(`${BASE_URL}/audit`, (r) => r.ok && (r as { body: string }).body.includes('RealSyncDynamics')),
  },
  {
    name: '/pricing reachable',
    run: async () => fetchAndExpect(`${BASE_URL}/pricing`, (r) => r.ok && (r as { body: string }).body.includes('Free Audit')),
  },
  {
    name: '/integrations/shopify reachable',
    run: async () => fetchAndExpect(`${BASE_URL}/integrations/shopify`, (r) => r.ok),
  },
  {
    name: 'gdpr-audit · valid URL returns audit_id + score',
    run: async () => postFn('gdpr-audit', { url: 'https://example.de', email: 'test@example.com' }, (status, body) => {
      if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
      if (typeof body !== 'object' || body == null) return { ok: false, detail: 'response not an object' };
      const b = body as Record<string, unknown>;
      if (typeof b.audit_id !== 'string') return { ok: false, detail: 'missing audit_id' };
      if (typeof b.score !== 'number') return { ok: false, detail: 'missing score' };
      if (!Array.isArray(b.issues)) return { ok: false, detail: 'missing issues array' };
      return { ok: true, detail: `audit_id=${(b.audit_id as string).slice(0, 8)}… score=${b.score}` };
    }),
  },
  {
    name: 'gdpr-audit · empty URL returns 400',
    run: async () => postFn('gdpr-audit', { url: '', email: 'test@example.com' }, (status) =>
      ({ ok: status === 400, detail: `expected 400, got ${status}` })),
  },
  {
    name: 'gdpr-audit · invalid email returns 400',
    run: async () => postFn('gdpr-audit', { url: 'https://example.de', email: 'not-an-email' }, (status) =>
      ({ ok: status === 400, detail: `expected 400, got ${status}` })),
  },
  {
    name: 'shopify-install · no shop param returns 400',
    run: async () => {
      try {
        const url = `${SUPABASE_URL}/functions/v1/shopify-install`;
        const res = await fetchWithTimeout(url);
        return { name: '', ok: res.status === 400, status: res.status, detail: `expected 400, got ${res.status}` };
      } catch (e) {
        return { name: '', ok: false, detail: (e as Error).message };
      }
    },
  },
  {
    name: 'stripe-checkout · without auth returns 401',
    run: async () => postFn('stripe-checkout', { planKey: 'starter' }, (status) =>
      ({ ok: status === 401, detail: `expected 401, got ${status}` }), false),
  },
  {
    // Anon-key JWT passes the platform-level verify_jwt gate, so this probe
    // actually exercises the function code (env vars, Stripe SDK init,
    // Supabase auth.getUser() call) — unlike the probe above, which is
    // rejected before the function runs.
    name: 'stripe-checkout · with anon JWT (no user session) returns 401 UNAUTHORIZED',
    run: async () => {
      if (!ANON_KEY) return { name: '', ok: true, detail: 'skipped — SUPABASE_ANON_KEY not set' };
      return postFn('stripe-checkout', { tenant_id: '00000000-0000-0000-0000-000000000000', plan_key: 'starter' },
        (status, body) => {
          if (status !== 401) return { ok: false, detail: `expected 401, got ${status}` };
          const code = (body as Record<string, unknown> | null)?.error as Record<string, unknown> | undefined;
          if (code?.code !== 'UNAUTHORIZED') return { ok: false, detail: `expected error.code=UNAUTHORIZED, got ${JSON.stringify(body)}` };
          return { ok: true, detail: 'function reachable, rejected anon JWT as expected' };
        });
    },
  },
  {
    name: 'stripe-webhook · without signature returns 400',
    run: async () => {
      try {
        const url = `${SUPABASE_URL}/functions/v1/stripe-webhook`;
        const res = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: 'evt_test', type: 'noop' }),
        });
        return { name: '', ok: res.status === 400, status: res.status, detail: `expected 400, got ${res.status}` };
      } catch (e) {
        return { name: '', ok: false, detail: (e as Error).message };
      }
    },
  },
  {
    name: 'governance-agent · without acknowledge_us_routing returns 412',
    run: async () => postFn('governance-agent', { op: 'chat', tenant_id: '00000000-0000-0000-0000-000000000000', message: 'hi' }, (status) =>
      ({ ok: status === 401 || status === 412, detail: `expected 401/412, got ${status}` }), false),
  },
  {
    name: 'health · returns status field',
    run: async () => {
      try {
        const url = `${SUPABASE_URL}/functions/v1/health`;
        const res = await fetchWithTimeout(url);
        let parsed: unknown = null;
        try { parsed = await res.json(); } catch { /* ignore */ }
        const status = (parsed as Record<string, unknown> | null)?.status;
        const ok = (res.status === 200 || res.status === 503) && (status === 'ok' || status === 'degraded' || status === 'down');
        return { name: '', ok, status: res.status, detail: ok ? `status=${status}` : `unexpected response (HTTP ${res.status})` };
      } catch (e) {
        return { name: '', ok: false, detail: (e as Error).message };
      }
    },
  },
  {
    name: 'cookie-scan · valid URL returns score + severity',
    run: async () => postFn('cookie-scan', { url: 'https://example.com' }, (status, body) => {
      if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
      if (typeof body !== 'object' || body == null) return { ok: false, detail: 'response not an object' };
      const b = body as Record<string, unknown>;
      if (typeof b.score !== 'number') return { ok: false, detail: 'missing score' };
      if (typeof b.severity !== 'string') return { ok: false, detail: 'missing severity' };
      return { ok: true, detail: `score=${b.score} severity=${b.severity}` };
    }, false),
  },
  {
    name: 'cookie-scan · invalid URL returns 400',
    run: async () => postFn('cookie-scan', { url: 'not-a-url' }, (status) =>
      ({ ok: status === 400, detail: `expected 400, got ${status}` }), false),
  },
  {
    name: 'newsletter-subscribe · invalid email returns 400',
    run: async () => postFn('newsletter-subscribe', { email: 'not-an-email' }, (status) =>
      ({ ok: status === 400, detail: `expected 400, got ${status}` }), false),
  },
];

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...(init ?? {}), signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchAndExpect(url: string, predicate: (r: { ok: boolean; status: number; body: string }) => boolean): Promise<Result> {
  try {
    const res = await fetchWithTimeout(url, { headers: { 'user-agent': 'RealSyncDynamicsAI-Smoke/1.0' } });
    const body = await res.text();
    const ok = predicate({ ok: res.ok, status: res.status, body });
    return { name: '', ok, status: res.status, detail: ok ? 'OK' : `HTTP ${res.status}, body matched=false` };
  } catch (e) {
    return { name: '', ok: false, detail: (e as Error).message };
  }
}

async function postFn(
  fnName: string,
  body: Record<string, unknown>,
  check: (status: number, parsed: unknown) => { ok: boolean; detail: string },
  withAuth = true,
): Promise<Result> {
  const url = `${SUPABASE_URL}/functions/v1/${fnName}`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (withAuth && ANON_KEY) headers.authorization = `Bearer ${ANON_KEY}`;
  try {
    const res = await fetchWithTimeout(url, { method: 'POST', headers, body: JSON.stringify(body) });
    let parsed: unknown = null;
    try { parsed = await res.json(); } catch { /* may be text body */ }
    const result = check(res.status, parsed);
    return { name: '', ok: result.ok, status: res.status, detail: result.detail };
  } catch (e) {
    return { name: '', ok: false, detail: (e as Error).message };
  }
}

async function main() {
  console.log(`\nQA Smoke Test\n  BASE_URL=${BASE_URL}\n  SUPABASE_URL=${SUPABASE_URL}\n`);
  const results: Result[] = [];
  for (const p of probes) {
    const r = await p.run();
    r.name = p.name;
    results.push(r);
    const tag = r.ok ? '✓' : '✗';
    const color = r.ok ? '\x1b[32m' : '\x1b[31m';
    console.log(`${color}${tag}\x1b[0m  ${p.name} — ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    console.error('\nFailures:');
    for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main();

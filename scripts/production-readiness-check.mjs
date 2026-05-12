#!/usr/bin/env node
// Production readiness check for realsyncdynamicsai.de.
//
// Fetches the public surfaces a founder needs to verify after each
// deploy. Uses fetch-only — no Supabase, no secrets, no auth. Each
// check states what HTML/JSON marker must be present.
//
// Usage:
//   npm run check:production
//   RSD_BASE_URL=https://staging.realsyncdynamicsai.de npm run check:production

const BASE_URL = process.env.RSD_BASE_URL || 'https://realsyncdynamicsai.de';
const TIMEOUT_MS = Number(process.env.RSD_CHECK_TIMEOUT_MS) || 15_000;

const checks = [
  { name: 'Homepage reachable',           url: `${BASE_URL}/`,                  mustInclude: 'RealSyncDynamics' },
  { name: 'Governance runtime reachable', url: `${BASE_URL}/governance-runtime`, mustInclude: 'Governance' },
  { name: 'Trust Center reachable',       url: `${BASE_URL}/trust`,             mustInclude: 'Trust' },
  { name: 'Security page reachable',      url: `${BASE_URL}/security`,          mustInclude: 'Security' },
  { name: 'Pilot readiness reachable',    url: `${BASE_URL}/pilot-readiness`,   mustInclude: 'Pilot' },
  { name: 'Sitemap reachable',            url: `${BASE_URL}/sitemap.xml`,       mustInclude: 'governance' },
  { name: 'Robots.txt reachable',         url: `${BASE_URL}/robots.txt`,        mustInclude: 'Sitemap' },
];

async function check({ name, url, mustInclude }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'RealSyncDynamicsAI-Readiness-Check/1.0' },
      signal: ctrl.signal,
    });
    const text = await res.text();
    const found = text.includes(mustInclude);
    const ok = res.ok && found;
    return {
      name,
      url,
      status: res.status,
      ok,
      detail: ok ? 'OK' : (!res.ok ? `HTTP ${res.status}` : `missing: ${mustInclude}`),
    };
  } catch (err) {
    return {
      name,
      url,
      status: 0,
      ok: false,
      detail: err instanceof Error ? (err.name === 'AbortError' ? `timeout >${TIMEOUT_MS}ms` : err.message) : String(err),
    };
  } finally {
    clearTimeout(t);
  }
}

console.log(`\nProduction readiness check against ${BASE_URL}\n`);

const results = [];
for (const item of checks) results.push(await check(item));

console.table(
  results.map((r) => ({
    check: r.name,
    status: r.status || '—',
    ok: r.ok ? '✓' : '✗',
    detail: r.detail,
  })),
);

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length} of ${results.length} checks failed.\n`);
  for (const f of failed) console.error(`  ✗ ${f.name} — ${f.detail}`);
  process.exit(1);
}

console.log(`\nAll ${results.length} production readiness checks passed.`);

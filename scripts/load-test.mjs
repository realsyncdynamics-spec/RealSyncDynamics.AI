#!/usr/bin/env node
// Load test for realsyncdynamicsai.de — fetch-only, no dependencies.
//
// Fires concurrent requests against a configurable set of public routes for
// a fixed duration and reports throughput, latency percentiles and error
// rates. Intended as a pre-launch / pre-deploy sanity check on the VPS, not
// as a heavy stress tool — keep concurrency modest against production.
//
// Usage:
//   node scripts/load-test.mjs
//   RSD_BASE_URL=https://staging.realsyncdynamicsai.de node scripts/load-test.mjs
//   RSD_LOAD_TARGETS=/,/pricing,/audit RSD_LOAD_CONCURRENCY=20 RSD_LOAD_DURATION_S=30 node scripts/load-test.mjs
//   RSD_JSON=1 node scripts/load-test.mjs
//
// Env vars:
//   RSD_BASE_URL              base URL to test (default https://realsyncdynamicsai.de)
//   RSD_LOAD_TARGETS          comma-separated paths (default /,/pricing,/audit)
//   RSD_LOAD_CONCURRENCY      parallel workers per target (default 5)
//   RSD_LOAD_DURATION_S       test duration in seconds per target (default 15)
//   RSD_LOAD_TIMEOUT_MS       per-request timeout (default 15000)
//   RSD_LOAD_MAX_ERROR_RATE   fail if error rate exceeds this (default 0.05)
//   RSD_LOAD_MAX_P95_MS       fail if p95 latency exceeds this (default 3000)
//   RSD_JSON                  emit JSON only (CI friendly)
//
// Exit codes:
//   0  all targets within thresholds
//   1  one or more targets exceeded the error-rate or p95 threshold

const BASE_URL        = (process.env.RSD_BASE_URL || 'https://realsyncdynamicsai.de').replace(/\/$/, '');
const TARGETS         = (process.env.RSD_LOAD_TARGETS || '/,/pricing,/audit').split(',').map(s => s.trim()).filter(Boolean);
const CONCURRENCY     = Number(process.env.RSD_LOAD_CONCURRENCY) || 5;
const DURATION_S      = Number(process.env.RSD_LOAD_DURATION_S) || 15;
const TIMEOUT_MS      = Number(process.env.RSD_LOAD_TIMEOUT_MS) || 15_000;
const MAX_ERROR_RATE  = Number(process.env.RSD_LOAD_MAX_ERROR_RATE) || 0.05;
const MAX_P95_MS      = Number(process.env.RSD_LOAD_MAX_P95_MS) || 3000;
const JSON_OUT        = process.env.RSD_JSON === '1';

async function fetchOnce(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'RealSyncDynamicsAI-LoadTest/1.0' } });
    await res.arrayBuffer(); // drain body to measure full transfer time
    return { ms: performance.now() - start, ok: res.ok, status: res.status };
  } catch (e) {
    return { ms: performance.now() - start, ok: false, status: 0, error: e.message };
  } finally {
    clearTimeout(t);
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

async function runTarget(path) {
  const url = `${BASE_URL}${path}`;
  const deadline = Date.now() + DURATION_S * 1000;
  const latencies = [];
  let errors = 0;
  let total = 0;

  async function worker() {
    while (Date.now() < deadline) {
      const r = await fetchOnce(url);
      total++;
      latencies.push(r.ms);
      if (!r.ok) errors++;
    }
  }

  const wallStart = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const wallSec = (Date.now() - wallStart) / 1000;

  const sorted = [...latencies].sort((a, b) => a - b);
  const errorRate = total > 0 ? errors / total : 1;
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);

  return {
    path,
    url,
    requests: total,
    errors,
    errorRate,
    rps: total / wallSec,
    p50Ms: Math.round(p50),
    p95Ms: Math.round(p95),
    p99Ms: Math.round(p99),
    pass: errorRate <= MAX_ERROR_RATE && p95 <= MAX_P95_MS,
  };
}

async function main() {
  if (!JSON_OUT) {
    console.log(`\nLoad Test\n  BASE_URL=${BASE_URL}\n  TARGETS=${TARGETS.join(', ')}\n  CONCURRENCY=${CONCURRENCY}  DURATION=${DURATION_S}s/target\n`);
  }

  const results = [];
  for (const path of TARGETS) {
    if (!JSON_OUT) console.log(`Running ${path} ...`);
    results.push(await runTarget(path));
  }

  const failed = results.filter(r => !r.pass);

  if (JSON_OUT) {
    console.log(JSON.stringify({ baseUrl: BASE_URL, results, failed: failed.length }, null, 2));
  } else {
    console.log('');
    for (const r of results) {
      const tag = r.pass ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      console.log(`${tag}  ${r.path} — ${r.requests} reqs, ${r.rps.toFixed(1)} req/s, ` +
        `errors ${(r.errorRate * 100).toFixed(1)}%, p50=${r.p50Ms}ms p95=${r.p95Ms}ms p99=${r.p99Ms}ms`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} targets within thresholds ` +
      `(max error rate ${(MAX_ERROR_RATE * 100).toFixed(0)}%, max p95 ${MAX_P95_MS}ms).`);
  }

  if (failed.length > 0) process.exit(1);
}

main();

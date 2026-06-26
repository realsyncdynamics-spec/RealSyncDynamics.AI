#!/usr/bin/env -S node --experimental-strip-types
// QA Load Test — einfacher, abhängigkeitsfreier Lasttest gegen eine URL.
// Feuert für eine feste Dauer parallele Requests ab und meldet
// Erfolgsquote, Durchsatz (req/s) sowie Latenz-Perzentile (p50/p95/p99).
//
// Usage:
//   tsx scripts/qa-load-test.ts
//   RSD_LOAD_URL=https://realsyncdynamicsai.de/audit \
//   RSD_LOAD_CONCURRENCY=20 RSD_LOAD_DURATION_SEC=15 \
//   tsx scripts/qa-load-test.ts
//
// Exit code 1, wenn die Erfolgsquote unter RSD_LOAD_MIN_SUCCESS_RATE liegt
// oder p95 über RSD_LOAD_MAX_P95_MS.

const URL_TARGET       = process.env.RSD_LOAD_URL ?? 'http://localhost:3000/';
const CONCURRENCY      = Number(process.env.RSD_LOAD_CONCURRENCY) || 10;
const DURATION_SEC     = Number(process.env.RSD_LOAD_DURATION_SEC) || 10;
const TIMEOUT_MS       = Number(process.env.RSD_LOAD_TIMEOUT_MS) || 15_000;
const MIN_SUCCESS_RATE = Number(process.env.RSD_LOAD_MIN_SUCCESS_RATE) || 0.95;
const MAX_P95_MS       = Number(process.env.RSD_LOAD_MAX_P95_MS) || 0; // 0 = kein Gate

interface RequestSample {
  ok: boolean;
  status: number;
  durationMs: number;
}

async function fetchOnce(): Promise<RequestSample> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(URL_TARGET, { signal: ctrl.signal, headers: { 'user-agent': 'RealSyncDynamicsAI-LoadTest/1.0' } });
    await res.arrayBuffer(); // Body vollständig lesen, sonst verzerrt das die Latenz nicht
    return { ok: res.ok, status: res.status, durationMs: performance.now() - start };
  } catch {
    return { ok: false, status: 0, durationMs: performance.now() - start };
  } finally {
    clearTimeout(t);
  }
}

async function worker(samples: RequestSample[], deadline: number): Promise<void> {
  while (performance.now() < deadline) {
    samples.push(await fetchOnce());
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  console.log(`\nQA Load Test\n  URL=${URL_TARGET}\n  Concurrency=${CONCURRENCY}\n  Duration=${DURATION_SEC}s\n`);

  const samples: RequestSample[] = [];
  const deadline = performance.now() + DURATION_SEC * 1000;
  const start = Date.now();

  await Promise.all(
    Array.from({ length: CONCURRENCY }, () => worker(samples, deadline)),
  );

  const elapsedSec = (Date.now() - start) / 1000;
  const total = samples.length;
  const succeeded = samples.filter((s) => s.ok).length;
  const successRate = total > 0 ? succeeded / total : 0;
  const durations = samples.map((s) => s.durationMs).sort((a, b) => a - b);
  const avg = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);
  const rps = total / elapsedSec;

  const statusCounts = new Map<number, number>();
  for (const s of samples) statusCounts.set(s.status, (statusCounts.get(s.status) ?? 0) + 1);

  console.log(`Requests:      ${total}`);
  console.log(`Erfolgsquote:  ${(successRate * 100).toFixed(1)}% (${succeeded}/${total})`);
  console.log(`Durchsatz:     ${rps.toFixed(1)} req/s`);
  console.log(`Latenz (ms):   avg=${avg.toFixed(0)} p50=${p50.toFixed(0)} p95=${p95.toFixed(0)} p99=${p99.toFixed(0)}`);
  console.log('Status-Codes:  ' + [...statusCounts.entries()].sort().map(([s, c]) => `${s || 'ERR'}=${c}`).join(', '));

  let failed = false;
  if (successRate < MIN_SUCCESS_RATE) {
    console.error(`\n✗ Erfolgsquote ${(successRate * 100).toFixed(1)}% unter Schwelle ${(MIN_SUCCESS_RATE * 100).toFixed(1)}%`);
    failed = true;
  }
  if (MAX_P95_MS > 0 && p95 > MAX_P95_MS) {
    console.error(`\n✗ p95-Latenz ${p95.toFixed(0)}ms über Schwelle ${MAX_P95_MS}ms`);
    failed = true;
  }
  if (failed) process.exit(1);

  console.log('\n✓ Load Test bestanden.');
}

main();

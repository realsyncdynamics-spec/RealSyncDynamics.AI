#!/usr/bin/env node
// Post-Deploy Smoke-Check für realsync-runtime-core.
//
// Prüft den /health-Endpunkt (routes/health.js) der laufenden Instanz und
// verifiziert, dass status === 'ok' und alle Dependencies (db, redis, nats)
// 'ok' melden. Gedacht für den ersten Cloudflare-Container-Deploy
// (DEPLOY_CLOUDFLARE.md) und für CI/Monitoring.
//
// Nutzung:
//   node scripts/smoke.mjs <BASE_URL>
//   RUNTIME_CORE_URL=https://…workers.dev node scripts/smoke.mjs
//   npm run smoke -- https://realsync-runtime-core.<subdomain>.workers.dev
//
// Exit-Code 0 = gesund, 1 = ungesund/nicht erreichbar. Keine externen Deps
// (Node 20+ fetch/AbortSignal).

const base = (process.argv[2] || process.env.RUNTIME_CORE_URL || '').replace(/\/+$/, '');
if (!base) {
  console.error('✗ Keine Base-URL. Aufruf: node scripts/smoke.mjs <BASE_URL>  (oder RUNTIME_CORE_URL setzen)');
  process.exit(1);
}

const url = `${base}/health`;
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 10000);
const RETRIES = Number(process.env.SMOKE_RETRIES || 3);
const RETRY_DELAY_MS = Number(process.env.SMOKE_RETRY_DELAY_MS || 3000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe() {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => null);
  return { httpStatus: res.status, body };
}

// Der erste Request nach Scale-to-zero kann den Container erst hochfahren —
// daher mehrere Versuche mit Backoff, bevor wir es als Fehlschlag werten.
let last;
for (let attempt = 1; attempt <= RETRIES; attempt++) {
  try {
    last = await probe();
    const deps = last.body?.dependencies ?? {};
    const healthy =
      last.httpStatus === 200 &&
      last.body?.status === 'ok' &&
      Object.values(deps).every((v) => v === 'ok');

    if (healthy) {
      console.log(`✓ ${last.body.service} gesund (HTTP ${last.httpStatus})`);
      for (const [dep, state] of Object.entries(deps)) console.log(`  • ${dep}: ${state}`);
      process.exit(0);
    }

    console.warn(
      `Versuch ${attempt}/${RETRIES}: nicht gesund — HTTP ${last.httpStatus}, ` +
      `status=${last.body?.status ?? 'n/a'}, deps=${JSON.stringify(last.body?.dependencies ?? {})}`,
    );
  } catch (err) {
    console.warn(`Versuch ${attempt}/${RETRIES}: nicht erreichbar — ${(err && err.message) || err}`);
  }
  if (attempt < RETRIES) await sleep(RETRY_DELAY_MS);
}

console.error(`✗ realsync-runtime-core ist nach ${RETRIES} Versuchen NICHT gesund (${url}).`);
if (last?.body) console.error(`  Letzte Antwort: ${JSON.stringify(last.body)}`);
process.exit(1);

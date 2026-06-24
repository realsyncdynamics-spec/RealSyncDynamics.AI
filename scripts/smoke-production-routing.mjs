#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Production-Routing-Smoke-Test — RealSyncDynamics.AI
// ─────────────────────────────────────────────────────────────────────────────
// Prüft die Cloudflare-Pages-Default-Domain UND die Custom Domain auf saubere
// SPA-Routing-Auslieferung: HTTP-Status, Redirect-Ziel, Content-Type, ob HTML
// ausgeliefert wird, und ob 404/500/502/„Cache-miss"-artige Edge-Fehler auftreten.
//
// Nutzung:
//   node scripts/smoke-production-routing.mjs
//   SMOKE_STRICT_APEX=1 node scripts/smoke-production-routing.mjs   # Apex blockierend
//
// Exit-Code:
//   0 = alle ERFORDERLICHEN Routen liefern 200 + HTML
//   1 = mindestens eine erforderliche Route ist nicht sauber
//
// pages.dev ist immer erforderlich. Der Apex ist standardmäßig ADVISORY
// (bekannter, dashboard-seitiger Custom-Domain-Blocker — siehe
// REALSYNC_LIVE_ROUTING_STATUS.md). Mit SMOKE_STRICT_APEX=1 wird der Apex
// ebenfalls blockierend geprüft (für CI nach erfolgter Domain-Bindung).
// ─────────────────────────────────────────────────────────────────────────────

const BASES = [
  { name: 'pages.dev', url: 'https://realsyncdynamics-ai.pages.dev', required: true },
  { name: 'apex',      url: 'https://realsyncdynamicsai.de',         required: process.env.SMOKE_STRICT_APEX === '1' },
];

// Öffentliche Routen (kein Auth-Redirect erwartet). App-/Login-Routen liefern
// als SPA ebenfalls den index.html-Shell mit 200 (clientseitiges Routing).
const ROUTES = ['/', '/pricing', '/pricing/', '/audit', '/audit/', '/login', '/app'];
const TIMEOUT_MS = 15000;
const UA = 'rsd-smoke/1';

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA }, ...opts });
  } finally {
    clearTimeout(timer);
  }
}

async function probe(baseUrl, route) {
  const url = baseUrl + route;
  let status = 0;
  let finalPath = route;
  let location = null;
  let contentType = null;
  let cache = null;
  let note = '';

  try {
    // Erst ohne Redirect-Folgen, um ein Redirect-Ziel (Trailing-Slash etc.) zu sehen.
    const r = await fetchWithTimeout(url, { method: 'GET', redirect: 'manual' });
    status = r.status;
    cache = r.headers.get('cf-cache-status');
    location = r.headers.get('location');
    contentType = r.headers.get('content-type');

    if (status >= 300 && status < 400 && location) {
      const target = new URL(location, url);
      const rf = await fetchWithTimeout(target.toString(), { redirect: 'follow' });
      status = rf.status;
      finalPath = rf.url.replace(baseUrl, '');
      contentType = rf.headers.get('content-type');
      cache = rf.headers.get('cf-cache-status') || cache;
    }
  } catch (e) {
    status = 0;
    note = 'fetch-error: ' + (e.code || e.name || e.message || 'unknown');
  }

  const isHtml = !!contentType && contentType.includes('text/html');
  const ok = status === 200 && isHtml;
  if (!ok && !note) {
    if (status === 0) note = 'keine Antwort / Timeout';
    else if (status >= 500) note = `Edge-/Server-Fehler (cache=${cache || '-'})`;
    else if (status === 404) note = '404 — SPA-Catch-all greift nicht';
    else if (status >= 300 && status < 400) note = `Redirect ${status} → ${location || '?'}`;
    else if (!isHtml) note = `kein HTML (content-type=${contentType || '-'})`;
    else note = `Status ${status}`;
  }
  return { route, finalPath, status, ok, location, cache, contentType, note };
}

function pad(value, width) {
  const s = String(value ?? '');
  return s.length >= width ? s.slice(0, width - 1) + '…' : s + ' '.repeat(width - s.length);
}

async function main() {
  let hardFail = false;
  console.log('Production-Routing-Smoke-Test — RealSyncDynamics.AI');
  console.log('Zeit:', new Date().toISOString());

  for (const base of BASES) {
    console.log(`\n=== ${base.name}  (${base.url})  ${base.required ? '[erforderlich]' : '[advisory]'} ===`);
    console.log(
      pad('Route', 12) + pad('Final', 16) + pad('Status', 8) +
      pad('Cache', 10) + pad('Ergebnis', 9) + 'Hinweis',
    );
    for (const route of ROUTES) {
      const res = await probe(base.url, route);
      console.log(
        pad(res.route, 12) +
        pad(res.finalPath, 16) +
        pad(res.status, 8) +
        pad(res.cache || '-', 10) +
        pad(res.ok ? 'OK' : 'FAIL', 9) +
        (res.note || ''),
      );
      if (!res.ok && base.required) hardFail = true;
    }
  }

  console.log('');
  if (hardFail) {
    console.error('SMOKE FAIL: mindestens eine erforderliche Route ist nicht sauber (erwartet: 200 + text/html).');
    process.exit(1);
  }
  console.log('SMOKE OK: alle erforderlichen Routen liefern 200 + HTML.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

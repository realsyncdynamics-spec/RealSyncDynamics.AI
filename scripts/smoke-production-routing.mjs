#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Production-Routing-Smoke-Test
// ─────────────────────────────────────────────────────────────────────────────
// Prüft die öffentlich erreichbaren Routen sowohl auf der Cloudflare-Pages-
// Default-Domain (*.pages.dev) als auch auf der Custom-Domain. Vergleicht das
// Verhalten beider Bases, deckt „Split-Brain"-Effekte auf (z. B. wenn die
// Custom-Domain durch einen alten Worker / falsches Pages-Projekt / Cache
// einen 500/502/„Cache miss" liefert, obwohl *.pages.dev sauber 200 liefert).
//
// Aufruf:   node scripts/smoke-production-routing.mjs
//           npm run smoke:production
//
// Optional: SMOKE_BASES="https://a,https://b"  überschreibt die Default-Bases
//           SMOKE_FAIL_ON_DELTA=1              FAIL, wenn Bases unterschiedlich
//
// Exit-Code 0 = alle Routen liefern HTML (200). Sonst 1.
// Benötigt Node >= 18 (global fetch). Keine externen Dependencies.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BASES = [
  'https://realsyncdynamics-ai.pages.dev',
  'https://realsyncdynamicsai.de',
];

const BASES = (process.env.SMOKE_BASES
  ? process.env.SMOKE_BASES.split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_BASES);

const ROUTES = ['/', '/pricing', '/pricing/', '/audit', '/audit/', '/login', '/app'];

const TIMEOUT_MS = 20_000;

/** Einzelne URL prüfen: erst ohne Redirect-Follow (für Redirect-Ziel),
 *  dann mit Follow (für finalen Status + Content-Type). */
async function probe(url) {
  const out = {
    url,
    status: 0,
    finalUrl: url,
    redirectTo: '',
    contentType: '',
    isHtml: false,
    note: '',
    ok: false,
  };

  // 1) Manueller Modus: Redirect-Ziel & initialer Status
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const r0 = await fetch(url, { redirect: 'manual', signal: ctrl.signal });
    clearTimeout(t);
    if (r0.status >= 300 && r0.status < 400) {
      out.redirectTo = r0.headers.get('location') || '';
    }
  } catch {
    /* im Follow-Schritt erneut versucht */
  }

  // 2) Follow-Modus: finaler Status + Content-Type
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal });
    clearTimeout(t);
    out.status = r.status;
    out.finalUrl = r.url || url;
    out.contentType = r.headers.get('content-type') || '';
    out.isHtml = out.contentType.includes('text/html');

    const cfCache = (r.headers.get('cf-cache-status') || '').toLowerCase();
    if (r.status === 200 && out.isHtml) {
      out.ok = true;
    } else if (r.status === 200 && !out.isHtml) {
      out.note = `200 aber kein HTML (${out.contentType || 'kein content-type'})`;
    } else if (r.status === 404) {
      out.note = '404 — SPA-Catch-all greift nicht';
    } else if (r.status === 500 || r.status === 502 || r.status === 503 || r.status === 504) {
      out.note = `${r.status} — Gateway/Origin-Fehler (cf-cache: ${cfCache || 'n/a'})`;
    } else {
      out.note = `unerwarteter Status ${r.status} (cf-cache: ${cfCache || 'n/a'})`;
    }
  } catch (err) {
    out.note = `Request fehlgeschlagen: ${err?.name === 'AbortError' ? 'Timeout' : (err?.message || err)}`;
  }

  return out;
}

function pad(s, n) {
  s = String(s ?? '');
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

async function main() {
  const rows = [];
  for (const base of BASES) {
    for (const route of ROUTES) {
      // eslint-disable-next-line no-await-in-loop
      const res = await probe(base + route);
      rows.push({ base, route, ...res });
    }
  }

  // Tabelle ausgeben
  const H = {
    base: 34, route: 11, finalUrl: 42, status: 7, ok: 5, note: 40,
  };
  const sep = '─'.repeat(H.base + H.route + H.finalUrl + H.status + H.ok + H.note + 5);
  console.log('\nProduction-Routing-Smoke-Test');
  console.log(sep);
  console.log(
    pad('Base', H.base), pad('Route', H.route), pad('Final URL', H.finalUrl),
    pad('Status', H.status), pad('OK', H.ok), pad('Hinweis', H.note),
  );
  console.log(sep);

  let failures = 0;
  for (const r of rows) {
    if (!r.ok) failures += 1;
    const finalShown = r.redirectTo && r.finalUrl === (r.base + r.route)
      ? `→ ${r.redirectTo}`
      : r.finalUrl;
    console.log(
      pad(r.base, H.base),
      pad(r.route, H.route),
      pad(finalShown, H.finalUrl),
      pad(r.status || '—', H.status),
      pad(r.ok ? 'OK' : 'FAIL', H.ok),
      pad(r.note, H.note),
    );
  }
  console.log(sep);

  // Split-Brain-Vergleich: gleiche Route, unterschiedliches Verhalten je Base
  let delta = 0;
  if (BASES.length >= 2) {
    console.log('\nBase-Vergleich (Split-Brain-Detektion)');
    console.log(sep);
    for (const route of ROUTES) {
      const perBase = BASES.map((b) => rows.find((x) => x.base === b && x.route === route));
      const statuses = perBase.map((x) => x?.status || 0);
      const allEqual = statuses.every((s) => s === statuses[0]);
      if (!allEqual) {
        delta += 1;
        console.log(
          pad(route, H.route),
          'DELTA →',
          perBase.map((x) => `${x.base.replace(/^https?:\/\//, '')}=${x.status}`).join('  |  '),
        );
      }
    }
    if (delta === 0) console.log('Keine Abweichungen zwischen den Bases. ✓');
    console.log(sep);
  }

  console.log(`\nErgebnis: ${rows.length - failures}/${rows.length} OK · ${failures} FAIL · ${delta} Base-Delta(s)\n`);

  const failOnDelta = process.env.SMOKE_FAIL_ON_DELTA === '1';
  if (failures > 0 || (failOnDelta && delta > 0)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Smoke-Test abgebrochen:', err);
  process.exit(1);
});

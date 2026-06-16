#!/usr/bin/env -S node --experimental-strip-types
// QA Governance Test — fetch-only DSGVO / Impressum / Consent / Security-Header
// probes against the public site. No Playwright, no auth tokens.
//
// Complements scripts/qa-smoke-test.ts (Edge-Function contracts) and
// scripts/production-readiness-check.mjs (deploy freshness + legal
// Pflichtangaben) with checks specific to EU-Compliance:
//   - Impressum / Datenschutzerklärung Pflichtsektionen
//   - Cookie-Consent-Banner vorhanden (Accept/Reject)
//   - Tracking-Pixel NICHT unconditional im statischen HTML (Consent-Gate)
//   - Security-Header (HSTS, X-Frame-Options, X-Content-Type-Options, ...)
//   - CSP-Meta-Tag mit den erwarteten Direktiven
//   - EU AI Act Seiten erreichbar
//
// Usage:
//   tsx scripts/qa-governance-test.ts
//   RSD_BASE_URL=https://x.de tsx scripts/qa-governance-test.ts
//
// Exit code 1 if any test FAILs.

const BASE_URL   = process.env.RSD_BASE_URL ?? 'https://realsyncdynamicsai.de';
const TIMEOUT_MS = Number(process.env.RSD_GOVERNANCE_TIMEOUT_MS) || 15_000;

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

// Tracking-Skripte, die laut src/lib/pixels.ts erst NACH Consent
// (window.fbq/ttq/gtag-Injection) nachgeladen werden. Tauchen sie als
// <script src="..."> bereits im statischen HTML auf, würde vor Consent
// getrackt werden.
const TRACKING_SRC_MARKERS = [
  'connect.facebook.net/en_US/fbevents.js',
  'analytics.tiktok.com/i18n/pixel/events.js',
  'www.googletagmanager.com/gtag/js',
];

const probes: Probe[] = [
  {
    name: 'Impressum · § 5 TMG Pflichtsektionen vorhanden',
    run: async () => fetchAndExpectAll(`${BASE_URL}/legal/impressum`, [
      'Impressum',
      'Umsatzsteuer-Identifikationsnummer',
    ]),
  },
  {
    name: 'Datenschutzerklärung · DSGVO-Pflichtsektionen vorhanden',
    run: async () => fetchAndExpectAll(`${BASE_URL}/legal/privacy`, [
      'Datenschutzerklärung',
      'Verantwortlicher',
      'Cookies',
    ]),
  },
  {
    name: 'Sub-Prozessoren-Liste erreichbar',
    run: async () => fetchAndExpectAll(`${BASE_URL}/legal/sub-processors`, [
      'Sub-Prozessoren',
    ]),
  },
  {
    name: 'Cookie-Consent-Banner im HTML vorhanden (Accept/Reject)',
    run: async () => fetchAndExpectAll(`${BASE_URL}/`, [
      'consent-accept-all',
      'consent-reject-all',
    ]),
  },
  {
    name: 'Tracking-Skripte nicht unconditional vor Consent geladen',
    run: async () => {
      const res = await fetchAndExpectNone(`${BASE_URL}/`, TRACKING_SRC_MARKERS);
      return res;
    },
  },
  {
    name: 'CSP-Meta-Tag mit erwarteten Direktiven vorhanden',
    run: async () => fetchAndExpectAll(`${BASE_URL}/`, [
      'http-equiv="Content-Security-Policy"',
      "frame-ancestors 'self'",
      "default-src 'self'",
    ]),
  },
  {
    name: 'Security-Header gesetzt (HSTS, X-Frame-Options, X-Content-Type-Options)',
    run: async () => checkSecurityHeaders(`${BASE_URL}/`),
  },
  {
    name: 'EU AI Act Seite erreichbar',
    run: async () => fetchAndExpectAll(`${BASE_URL}/ai-act`, [
      'AI Act',
    ]),
  },
  {
    name: 'EU AI Act Klassifikator erreichbar',
    run: async () => fetchAndExpectAll(`${BASE_URL}/ai-act-klassifikator`, [
      'AI Act',
    ]),
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

async function fetchAndExpectAll(url: string, mustInclude: string[]): Promise<Result> {
  try {
    const res = await fetchWithTimeout(url, { headers: { 'user-agent': 'RealSyncDynamicsAI-Governance/1.0' } });
    if (!res.ok) return { name: '', ok: false, status: res.status, detail: `HTTP ${res.status}` };
    const body = await res.text();
    const missing = mustInclude.filter((m) => !body.includes(m));
    if (missing.length > 0) {
      return { name: '', ok: false, status: res.status, detail: `missing marker(s): ${missing.join(', ')}` };
    }
    return { name: '', ok: true, status: res.status, detail: 'OK' };
  } catch (e) {
    return { name: '', ok: false, detail: (e as Error).message };
  }
}

async function fetchAndExpectNone(url: string, mustNotInclude: string[]): Promise<Result> {
  try {
    const res = await fetchWithTimeout(url, { headers: { 'user-agent': 'RealSyncDynamicsAI-Governance/1.0' } });
    if (!res.ok) return { name: '', ok: false, status: res.status, detail: `HTTP ${res.status}` };
    const body = await res.text();
    const found = mustNotInclude.filter((m) => body.includes(m));
    if (found.length > 0) {
      return { name: '', ok: false, status: res.status, detail: `unconditional tracking marker(s) found: ${found.join(', ')}` };
    }
    return { name: '', ok: true, status: res.status, detail: 'OK' };
  } catch (e) {
    return { name: '', ok: false, detail: (e as Error).message };
  }
}

async function checkSecurityHeaders(url: string): Promise<Result> {
  try {
    const res = await fetchWithTimeout(url, { method: 'HEAD', headers: { 'user-agent': 'RealSyncDynamicsAI-Governance/1.0' } });
    const required = [
      'strict-transport-security',
      'x-frame-options',
      'x-content-type-options',
      'referrer-policy',
      'permissions-policy',
    ];
    const missing = required.filter((h) => !res.headers.get(h));
    if (missing.length > 0) {
      return { name: '', ok: false, status: res.status, detail: `missing header(s): ${missing.join(', ')}` };
    }
    return { name: '', ok: true, status: res.status, detail: 'OK' };
  } catch (e) {
    return { name: '', ok: false, detail: (e as Error).message };
  }
}

async function main() {
  console.log(`\nQA Governance Test\n  BASE_URL=${BASE_URL}\n`);
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

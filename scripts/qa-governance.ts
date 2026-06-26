#!/usr/bin/env -S node --experimental-strip-types
// QA Governance Check — DSGVO/EU-AI-Act-relevante Compliance-Probes gegen
// die öffentliche Produktionsoberfläche + cookie-scan Edge Function.
// Ergänzt qa-smoke-test.ts (technische Health-Probes) um rechtliche/
// Compliance-Signale: Impressum/Datenschutz, Security-Header, CSP,
// Tracking-vor-Consent, EU-AI-Act-Hinweise.
//
// Usage:
//   tsx scripts/qa-governance.ts
//   RSD_BASE_URL=https://x.de SUPABASE_URL=https://x.supabase.co tsx scripts/qa-governance.ts
//
// Exit code 1 if any test FAILs.

const BASE_URL     = process.env.RSD_BASE_URL ?? 'https://realsyncdynamicsai.de';
const SUPABASE_URL = (process.env.SUPABASE_URL ?? 'https://ebljyceifhnlzhjfyxup.supabase.co').replace(/\/$/, '');
const TIMEOUT_MS   = Number(process.env.RSD_SMOKE_TIMEOUT_MS) || 15_000;

interface Result {
  name: string;
  ok: boolean;
  detail: string;
}

interface Probe {
  name: string;
  run: () => Promise<Result>;
}

const probes: Probe[] = [
  {
    name: '/impressum reachable + enthält Diensteanbieter-Angaben',
    run: async () => fetchAndExpect(`${BASE_URL}/impressum`, (body) =>
      /impressum/i.test(body) && /diensteanbieter/i.test(body)),
  },
  {
    name: '/datenschutz reachable + enthält DSGVO-Hinweis',
    run: async () => fetchAndExpect(`${BASE_URL}/datenschutz`, (body) =>
      /datenschutz/i.test(body) && /dsgvo/i.test(body)),
  },
  {
    name: '/ai-act reachable (EU AI Act Hinweise)',
    run: async () => {
      try {
        const res = await fetchWithTimeout(`${BASE_URL}/ai-act`, { redirect: 'follow' });
        return { name: '', ok: res.ok, detail: `HTTP ${res.status}` };
      } catch (e) {
        return { name: '', ok: false, detail: (e as Error).message };
      }
    },
  },
  {
    name: 'CSP meta-Tag vorhanden und schränkt default-src ein',
    run: async () => {
      try {
        const res = await fetchWithTimeout(`${BASE_URL}/`, { redirect: 'follow' });
        const body = await res.text();
        const match = body.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i);
        if (!match) return { name: '', ok: false, detail: 'kein CSP meta-Tag im HTML gefunden' };
        const csp = match[1]!;
        const ok = /default-src[^;]*'self'/.test(csp) && /frame-ancestors/.test(csp);
        return { name: '', ok, detail: ok ? 'CSP mit default-src/frame-ancestors gesetzt' : `CSP zu offen: ${csp.slice(0, 120)}…` };
      } catch (e) {
        return { name: '', ok: false, detail: (e as Error).message };
      }
    },
  },
  {
    name: 'HTTP-Security-Header (HSTS, X-Frame-Options) auf /',
    run: async () => {
      try {
        const res = await fetchWithTimeout(`${BASE_URL}/`, { redirect: 'follow' });
        const hsts = res.headers.get('strict-transport-security');
        const xfo = res.headers.get('x-frame-options');
        const missing = [
          !hsts && 'Strict-Transport-Security',
          !xfo && 'X-Frame-Options',
        ].filter(Boolean);
        if (missing.length === 0) return { name: '', ok: true, detail: 'HSTS + X-Frame-Options gesetzt' };
        return { name: '', ok: false, detail: `fehlende Header: ${missing.join(', ')} (siehe public/_headers — wird nur von Cloudflare Pages ausgewertet, nicht von GitHub Pages)` };
      } catch (e) {
        return { name: '', ok: false, detail: (e as Error).message };
      }
    },
  },
  {
    name: 'cookie-scan · keine nicht-konformen Tracker ohne Consent-Manager',
    run: async () => {
      const url = `${SUPABASE_URL}/functions/v1/cookie-scan`;
      try {
        const res = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: BASE_URL }),
        });
        if (res.status !== 200) return { name: '', ok: false, detail: `cookie-scan HTTP ${res.status}` };
        const body = await res.json() as {
          trackers?: { id: string; name: string; consent_compliant: boolean }[];
          consent_manager_detected?: boolean;
          severity?: string;
        };
        const nonCompliant = (body.trackers ?? []).filter((t) => !t.consent_compliant);
        if (nonCompliant.length === 0) return { name: '', ok: true, detail: `0 nicht-konforme Tracker (severity=${body.severity})` };
        const names = nonCompliant.map((t) => t.name).join(', ');
        return {
          name: '', ok: false,
          detail: `${nonCompliant.length} Tracker ohne Consent-Gating: ${names} (consent_manager_detected=${body.consent_manager_detected})`,
        };
      } catch (e) {
        return { name: '', ok: false, detail: (e as Error).message };
      }
    },
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

async function fetchAndExpect(url: string, predicate: (body: string) => boolean): Promise<Result> {
  try {
    const res = await fetchWithTimeout(url, { redirect: 'follow', headers: { 'user-agent': 'RealSyncDynamicsAI-Governance-QA/1.0' } });
    const body = await res.text();
    const ok = res.ok && predicate(body);
    return { name: '', ok, detail: ok ? 'OK' : `HTTP ${res.status}, Inhalt nicht wie erwartet` };
  } catch (e) {
    return { name: '', ok: false, detail: (e as Error).message };
  }
}

async function main() {
  console.log(`\nQA Governance Check\n  BASE_URL=${BASE_URL}\n  SUPABASE_URL=${SUPABASE_URL}\n`);
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

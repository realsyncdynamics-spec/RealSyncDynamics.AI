#!/usr/bin/env -S node --experimental-strip-types
// QA Governance / Compliance Smoke Test — fetch-only probes for DSGVO,
// legal-page presence, consent-before-tracking, security headers, CSP/HSTS,
// EU AI Act disclosure, and third-party request inventory.
//
// Usage:
//   tsx scripts/qa-governance-test.ts
//   RSD_BASE_URL=https://realsyncdynamicsai.de tsx scripts/qa-governance-test.ts
//
// Exit code 1 if any probe FAILs.
//
// All checks are fetch-only (HEAD or GET against the production domain).
// No browser automation. No user tokens. No DB writes.

const BASE_URL   = process.env.RSD_BASE_URL ?? 'https://realsyncdynamicsai.de';
const TIMEOUT_MS = Number(process.env.RSD_GOV_TIMEOUT_MS) || 15_000;

interface Result {
  name: string;
  ok: boolean;
  status?: number;
  detail: string;
}

interface Probe {
  name: string;
  run: () => Promise<Omit<Result, 'name'>>;
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getPage(path: string): Promise<{ ok: boolean; status: number; headers: Headers; body: string }> {
  const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
    headers: { 'user-agent': 'RealSyncDynamicsAI-Governance-QA/1.0', 'accept': 'text/html' },
    redirect: 'follow',
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, headers: res.headers, body };
}

function bodyIncludes(body: string, ...needles: string[]): boolean {
  const lower = body.toLowerCase();
  return needles.every((n) => lower.includes(n.toLowerCase()));
}

// ─── probes ─────────────────────────────────────────────────────────────────

const probes: Probe[] = [

  // ── Legal pages reachability ──────────────────────────────────────────────

  {
    name: '/legal/impressum reachable (§5 TMG)',
    run: async () => {
      const p = await getPage('/legal/impressum');
      if (!p.ok) return { ok: false, status: p.status, detail: `HTTP ${p.status}` };
      const hasName  = bodyIncludes(p.body, 'Dominik Steiner', 'RealSync Dynamics');
      const hasAddr  = bodyIncludes(p.body, 'Schwarzburger', 'Neuhaus');
      if (!hasName)  return { ok: false, status: p.status, detail: 'Impressum missing operator name / company' };
      if (!hasAddr)  return { ok: false, status: p.status, detail: 'Impressum missing street address' };
      return { ok: true, status: p.status, detail: 'name + address present' };
    },
  },

  {
    name: '/legal/privacy reachable (DSGVO Art. 13)',
    run: async () => {
      const p = await getPage('/legal/privacy');
      if (!p.ok) return { ok: false, status: p.status, detail: `HTTP ${p.status}` };
      // Must mention controller identity and at least one data-subject right
      const hasController = bodyIncludes(p.body, 'Verantwortlicher', 'Verantwortliche');
      const hasRights     = bodyIncludes(p.body, 'Auskunft', 'Widerruf', 'Löschung');
      if (!hasController) return { ok: false, status: p.status, detail: 'missing Verantwortlicher section' };
      if (!hasRights)     return { ok: false, status: p.status, detail: 'missing data-subject rights' };
      return { ok: true, status: p.status, detail: 'controller + rights sections present' };
    },
  },

  {
    name: '/legal/terms reachable (AGB)',
    run: async () => {
      const p = await getPage('/legal/terms');
      if (!p.ok) return { ok: false, status: p.status, detail: `HTTP ${p.status}` };
      return { ok: true, status: p.status, detail: `HTTP ${p.status}` };
    },
  },

  // ── Cookie consent / DSGVO compliance ────────────────────────────────────

  {
    name: 'Homepage ships a cookie-consent signal (DSGVO / ePrivacy)',
    run: async () => {
      const p = await getPage('/');
      if (!p.ok) return { ok: false, status: p.status, detail: `HTTP ${p.status}` };
      // We look for common consent-UI markers in the served HTML. This probe
      // checks that the page at least declares some consent mechanism — not
      // that it is fully functional, which requires a browser.
      const hasConsentMarker = bodyIncludes(p.body, 'cookie', 'consent', 'datenschutz')
        || bodyIncludes(p.body, 'CookieBanner', 'ConsentBanner', 'cookieConsent');
      if (!hasConsentMarker) {
        return {
          ok: false,
          status: p.status,
          detail: 'no cookie/consent keyword in HTML — confirm CookieBanner is server-rendered or move check to E2E',
        };
      }
      return { ok: true, status: p.status, detail: 'consent marker found in HTML' };
    },
  },

  // ── Security headers ──────────────────────────────────────────────────────

  {
    name: 'Security header: X-Frame-Options present (clickjacking)',
    run: async () => {
      const p = await getPage('/');
      const val = p.headers.get('x-frame-options');
      if (!val) return { ok: false, status: p.status, detail: 'header absent' };
      return { ok: true, status: p.status, detail: val };
    },
  },

  {
    name: 'Security header: X-Content-Type-Options: nosniff',
    run: async () => {
      const p = await getPage('/');
      const val = p.headers.get('x-content-type-options');
      if (val?.toLowerCase() !== 'nosniff') {
        return { ok: false, status: p.status, detail: `got: ${val ?? '(absent)'}` };
      }
      return { ok: true, status: p.status, detail: val };
    },
  },

  {
    name: 'Security header: Referrer-Policy present',
    run: async () => {
      const p = await getPage('/');
      const val = p.headers.get('referrer-policy');
      if (!val) return { ok: false, status: p.status, detail: 'header absent' };
      return { ok: true, status: p.status, detail: val };
    },
  },

  // ── HSTS ─────────────────────────────────────────────────────────────────

  {
    name: 'HSTS header present (HTTPS enforcement)',
    run: async () => {
      const p = await getPage('/');
      const val = p.headers.get('strict-transport-security');
      if (!val) return { ok: false, status: p.status, detail: 'Strict-Transport-Security absent' };
      const maxAge = parseInt(val.match(/max-age=(\d+)/)?.[1] ?? '0', 10);
      if (maxAge < 15_768_000) {
        return { ok: false, status: p.status, detail: `max-age=${maxAge} < 15768000 (6 months)` };
      }
      return { ok: true, status: p.status, detail: val };
    },
  },

  // ── CSP ───────────────────────────────────────────────────────────────────

  {
    name: 'CSP present (Content-Security-Policy header or meta)',
    run: async () => {
      const p = await getPage('/');
      const headerCsp = p.headers.get('content-security-policy');
      const metaCsp   = bodyIncludes(p.body, 'content-security-policy');
      if (!headerCsp && !metaCsp) {
        return { ok: false, status: p.status, detail: 'no CSP header and no CSP meta tag found' };
      }
      const csp = headerCsp ?? '(meta tag)';
      // Minimal safety: no unsafe-eval in script-src
      if (headerCsp?.includes("'unsafe-eval'")) {
        return { ok: false, status: p.status, detail: "CSP contains 'unsafe-eval' — remove from script-src" };
      }
      return { ok: true, status: p.status, detail: csp.slice(0, 120) };
    },
  },

  // ── Kleinunternehmer §19 UStG — no VAT ID on Impressum ───────────────────

  {
    name: 'Impressum does NOT show a USt-IdNr. (§19 UStG Kleinunternehmer)',
    run: async () => {
      const p = await getPage('/legal/impressum');
      if (!p.ok) return { ok: false, status: p.status, detail: `HTTP ${p.status}` };
      const hasVatId = /USt\.?-?IdNr\.?\s*:?\s*DE\d{9}/i.test(p.body);
      if (hasVatId) {
        return {
          ok: false,
          status: p.status,
          detail: 'USt-IdNr. DE… found on Impressum — business is Kleinunternehmer (§19 UStG); remove or check status',
        };
      }
      return { ok: true, status: p.status, detail: 'no VAT ID present (correct for §19 UStG)' };
    },
  },

  // ── EU AI Act disclosure ──────────────────────────────────────────────────

  {
    name: 'EU AI Act mention present on site (transparency obligation)',
    run: async () => {
      // Check any one of: homepage, /legal/privacy, /legal/terms
      const pages = ['/', '/legal/privacy', '/legal/terms'];
      for (const path of pages) {
        try {
          const p = await getPage(path);
          if (p.ok && bodyIncludes(p.body, 'EU AI Act', 'AI Act', 'KI-Verordnung', 'KI-VO')) {
            return { ok: true, detail: `EU AI Act mention found on ${path}` };
          }
        } catch { /* skip network failures on individual pages */ }
      }
      return {
        ok: false,
        detail:
          'No EU AI Act / KI-VO mention found on /, /legal/privacy, or /legal/terms — add transparency note if AI features are user-facing',
      };
    },
  },

  // ── Third-party request inventory (HTML-level) ────────────────────────────

  {
    name: 'Third-party scripts: no plain http:// external src',
    run: async () => {
      const p = await getPage('/');
      const matches = [...p.body.matchAll(/src=["'](http:\/\/[^"']+)["']/gi)].map((m) => m[1]);
      if (matches.length > 0) {
        return { ok: false, status: p.status, detail: `insecure http:// script src: ${matches.slice(0, 3).join(', ')}` };
      }
      return { ok: true, status: p.status, detail: 'no insecure http:// script sources' };
    },
  },

  {
    name: 'Third-party domains in HTML: Google Analytics declared',
    run: async () => {
      const p = await getPage('/');
      const hasGA = bodyIncludes(p.body, 'google-analytics.com', 'googletagmanager.com', 'gtag');
      if (!hasGA) return { ok: true, detail: 'no Google Analytics markers in HTML (or script-loaded)' };
      // If present, privacy policy must also mention Google Analytics
      const pp = await getPage('/legal/privacy');
      const ppMentions = bodyIncludes(pp.body, 'Google Analytics', 'Google Tag Manager');
      if (!ppMentions) {
        return {
          ok: false,
          detail: 'Google Analytics found in HTML but not mentioned in Datenschutzerklärung (DSGVO Art. 13)',
        };
      }
      return { ok: true, detail: 'Google Analytics present + disclosed in Datenschutzerklärung' };
    },
  },

  {
    name: 'Third-party domains in HTML: Meta Pixel declared',
    run: async () => {
      const p = await getPage('/');
      const hasMeta = bodyIncludes(p.body, 'facebook.com', 'facebook.net', 'fbq(');
      if (!hasMeta) return { ok: true, detail: 'no Meta Pixel markers in HTML' };
      const pp = await getPage('/legal/privacy');
      const ppMentions = bodyIncludes(pp.body, 'Facebook', 'Meta Pixel', 'Meta-Pixel');
      if (!ppMentions) {
        return {
          ok: false,
          detail: 'Meta Pixel found in HTML but not disclosed in Datenschutzerklärung',
        };
      }
      return { ok: true, detail: 'Meta Pixel present + disclosed in Datenschutzerklärung' };
    },
  },

  {
    name: 'Third-party domains in HTML: TikTok Pixel declared',
    run: async () => {
      const p = await getPage('/');
      const hasTT = bodyIncludes(p.body, 'analytics.tiktok.com', 'tiktok.com/pixel', 'ttq.');
      if (!hasTT) return { ok: true, detail: 'no TikTok Pixel markers in HTML' };
      const pp = await getPage('/legal/privacy');
      const ppMentions = bodyIncludes(pp.body, 'TikTok', 'Tiktok-Pixel');
      if (!ppMentions) {
        return {
          ok: false,
          detail: 'TikTok Pixel found in HTML but not disclosed in Datenschutzerklärung',
        };
      }
      return { ok: true, detail: 'TikTok Pixel present + disclosed in Datenschutzerklärung' };
    },
  },

];

// ─── runner ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nQA Governance Test\n  BASE_URL=${BASE_URL}\n`);
  const results: Result[] = [];
  for (const p of probes) {
    let r: Result;
    try {
      const partial = await p.run();
      r = { name: p.name, ...partial };
    } catch (e) {
      r = { name: p.name, ok: false, detail: `probe threw: ${(e as Error).message}` };
    }
    results.push(r);
    const tag   = r.ok ? '✓' : '✗';
    const color = r.ok ? '\x1b[32m' : '\x1b[31m';
    const stat  = r.status != null ? ` [${r.status}]` : '';
    console.log(`${color}${tag}\x1b[0m  ${r.name}${stat} — ${r.detail}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    console.error('\nFailures:');
    for (const f of failed) console.error(`  ✗ ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main();

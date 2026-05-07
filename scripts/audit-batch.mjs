#!/usr/bin/env node
// Passive Web-Audit-Batch — scannt eine Liste öffentlicher Domains
// auf typische DSGVO/TTDSG-Befunde (Tracker, Fonts, Headers, Consent,
// Impressum/Datenschutz). Schreibt JSON + Markdown nach scans/.
//
// Usage: node scripts/audit-batch.mjs
//
// Rein passiv: ein GET pro Domain, Standard-User-Agent. Keine Probes,
// kein Active Scanning, keine Kontaktaufnahme. Output ist intern (scans/
// ist gitignored).

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'scans');

const DOMAINS = [
  'dachdecker-neuhaus.de',
  'zahnarztpraxis-heller-neuhaus.de',
  'zahnarztpraxis-klemp.de',
  'aerzte-neuhaus.de',
  'hotel-oberland-neuhaus.de',
  'hirsch-rennweg.de',
  'am-waldesrand-neuhaus.de',
  'stampferundgoetz.de',
];

const UA = 'RealSyncAuditBot/1.0 (+https://realsyncdynamicsai.de/audit; passive scan)';

const TRACKERS = [
  { name: 'Google Analytics (GA4)', re: /googletagmanager\.com\/gtag\/js|google-analytics\.com\/(g|ga|analytics)|gtag\(['"]config/i },
  { name: 'Google Tag Manager', re: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i },
  { name: 'Facebook Pixel', re: /connect\.facebook\.net.*fbevents|fbq\(['"](init|track)/i },
  { name: 'Hotjar', re: /static\.hotjar\.com|hjid:/i },
  { name: 'Matomo', re: /matomo\.(js|php)|piwik\.(js|php)/i },
  { name: 'LinkedIn Insight', re: /snap\.licdn\.com\/li\.lms-analytics/i },
  { name: 'TikTok Pixel', re: /analytics\.tiktok\.com/i },
  { name: 'Microsoft Clarity', re: /clarity\.ms\/tag/i },
  { name: 'Cloudflare Insights (zumindest analytics)', re: /static\.cloudflareinsights\.com/i },
];

const CONSENT_HINTS = [
  { name: 'Borlabs Cookie', re: /borlabs-cookie|BorlabsCookie/i },
  { name: 'Cookiebot', re: /cookiebot\.com|consent\.cookiebot/i },
  { name: 'Usercentrics', re: /usercentrics\.com|uc\.usercentrics/i },
  { name: 'Klaro', re: /klaro\.kiprotect|getklaro\.com|klaro-config/i },
  { name: 'OneTrust', re: /onetrust\.com|otCenterRound/i },
  { name: 'CookieYes', re: /cookieyes\.com|cky-/i },
  { name: 'Real Cookie Banner', re: /realcookiebanner|real-cookie-banner/i },
  { name: 'Generischer Consent (Heuristik)', re: /(cookie[- ]?(banner|consent|notice)|consent[- ]?manager|datenschutz[- ]?banner)/i },
];

const SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
];

const TIMEOUT_MS = 12_000;

async function fetchWithTimeout(url, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function auditDomain(domain) {
  const startedAt = Date.now();
  const result = {
    domain,
    scanned_at: new Date().toISOString(),
    https: { reachable: false, redirect_from_http: null, status: null, final_url: null, error: null },
    timing_ms: null,
    content_length: null,
    headers: {},
    security_headers: {},
    cookies_set_on_initial_get: [],
    third_party_hosts: [],
    google_fonts_remote: false,
    trackers: [],
    consent_managers: [],
    has_imprint_link: false,
    has_privacy_link: false,
    title: null,
    findings: [],
  };

  const httpsUrl = `https://${domain}/`;
  const httpUrl = `http://${domain}/`;

  // 1. HTTP → HTTPS Redirect-Check (separater HEAD/GET, no follow)
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(httpUrl, {
      method: 'GET', redirect: 'manual', signal: ctrl.signal,
      headers: { 'User-Agent': UA },
    });
    clearTimeout(t);
    const loc = res.headers.get('location') || '';
    if (res.status >= 300 && res.status < 400 && /^https:/i.test(loc)) {
      result.https.redirect_from_http = `redirect ${res.status} → ${loc}`;
    } else if (res.status === 200) {
      result.https.redirect_from_http = `WARN: HTTP serves 200 ohne Redirect zu HTTPS`;
      result.findings.push({ severity: 'high', code: 'no_https_redirect', msg: 'HTTP-URL liefert 200 statt Redirect zu HTTPS.' });
    } else {
      result.https.redirect_from_http = `status ${res.status}, location=${loc || '(none)'}`;
    }
  } catch (err) {
    result.https.redirect_from_http = `error: ${err.message}`;
  }

  // 2. Hauptanfrage über HTTPS
  let html = '';
  try {
    const res = await fetchWithTimeout(httpsUrl);
    result.https.reachable = res.ok;
    result.https.status = res.status;
    result.https.final_url = res.url;
    result.timing_ms = Date.now() - startedAt;

    // Headers
    const allHeaders = {};
    for (const [k, v] of res.headers) allHeaders[k.toLowerCase()] = v;
    result.headers = allHeaders;

    for (const h of SECURITY_HEADERS) {
      result.security_headers[h] = allHeaders[h] ?? null;
      if (!allHeaders[h]) {
        result.findings.push({
          severity: h === 'strict-transport-security' ? 'high' : 'medium',
          code: `missing_${h}`,
          msg: `Security-Header fehlt: ${h}`,
        });
      }
    }

    // Set-Cookie auf initialem GET (vor Consent = problematisch wenn Tracking)
    const rawSetCookie = res.headers.getSetCookie?.() ?? [];
    if (rawSetCookie.length === 0 && allHeaders['set-cookie']) {
      rawSetCookie.push(allHeaders['set-cookie']);
    }
    result.cookies_set_on_initial_get = rawSetCookie.map((c) => c.split(';')[0].trim());

    html = await res.text();
    result.content_length = html.length;
  } catch (err) {
    result.https.error = err.message;
    return result;
  }

  // 3. HTML-Analyse
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) result.title = titleMatch[1].trim().slice(0, 120);

  // Google Fonts (remote)
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(html)) {
    result.google_fonts_remote = true;
    result.findings.push({
      severity: 'high',
      code: 'google_fonts_remote',
      msg: 'Google Fonts werden remote eingebunden (LG München I, Az. 3 O 17493/20). Lokale Auslieferung erforderlich.',
    });
  }

  // Tracker
  for (const t of TRACKERS) {
    if (t.re.test(html)) {
      result.trackers.push(t.name);
      result.findings.push({
        severity: 'high',
        code: `tracker_${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        msg: `Tracker erkannt: ${t.name}. Setzt typischerweise nicht-essentielle Cookies/sendet Daten — Consent vor Ladezeit erforderlich.`,
      });
    }
  }

  // Consent-Manager
  for (const c of CONSENT_HINTS) {
    if (c.re.test(html)) result.consent_managers.push(c.name);
  }

  if (result.trackers.length > 0 && result.consent_managers.length === 0) {
    result.findings.push({
      severity: 'high',
      code: 'tracker_without_consent_manager',
      msg: `Tracker geladen, aber kein Consent-Manager erkannt. Verstoß gegen § 25 TTDSG sehr wahrscheinlich.`,
    });
  }

  // Imprint / Datenschutz Links
  const linkRe = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(linkRe)) {
    const href = m[1].toLowerCase();
    const text = m[2].toLowerCase().replace(/<[^>]+>/g, '');
    if (/impressum/i.test(href) || /impressum/i.test(text)) result.has_imprint_link = true;
    if (/datenschutz|privacy/i.test(href) || /datenschutz|privacy/i.test(text)) result.has_privacy_link = true;
  }

  if (!result.has_imprint_link) {
    result.findings.push({ severity: 'high', code: 'missing_imprint', msg: 'Kein Impressum-Link auf der Startseite gefunden (§ 5 TMG).' });
  }
  if (!result.has_privacy_link) {
    result.findings.push({ severity: 'high', code: 'missing_privacy', msg: 'Kein Datenschutzerklärung-Link auf der Startseite gefunden (Art. 13 DSGVO).' });
  }

  // Drittanbieter-Hosts (Heuristik: alle externen Skript-/Link-Hosts ≠ Domain)
  const hosts = new Set();
  const srcRe = /(?:src|href)\s*=\s*["']https?:\/\/([^/"'?#]+)/gi;
  for (const m of html.matchAll(srcRe)) {
    const host = m[1].toLowerCase();
    if (!host.endsWith(domain) && !host.endsWith(`.${domain}`)) hosts.add(host);
  }
  result.third_party_hosts = Array.from(hosts).sort();

  return result;
}

function severityIcon(sev) {
  return { high: '🔴', medium: '🟡', low: '🔵' }[sev] ?? '•';
}

function renderMarkdown(r) {
  const findingsHigh = r.findings.filter((f) => f.severity === 'high');
  const findingsMed = r.findings.filter((f) => f.severity === 'medium');
  const score = Math.max(0, 100 - findingsHigh.length * 12 - findingsMed.length * 4);

  const lines = [];
  lines.push(`# Web-Audit · ${r.domain}`);
  lines.push('');
  lines.push(`_Scan-Zeitpunkt: ${r.scanned_at}_  ·  _Score: **${score}/100**_  ·  _Findings: ${findingsHigh.length} hoch, ${findingsMed.length} mittel_`);
  lines.push('');

  if (r.https.error) {
    lines.push(`## ❌ Nicht erreichbar`);
    lines.push('');
    lines.push(`\`\`\``);
    lines.push(r.https.error);
    lines.push(`\`\`\``);
    return lines.join('\n');
  }

  lines.push(`## Übersicht`);
  lines.push('');
  lines.push(`- **Title:** ${r.title ?? '(none)'}`);
  lines.push(`- **HTTPS-Status:** ${r.https.status} · ${r.https.final_url}`);
  lines.push(`- **HTTP→HTTPS:** ${r.https.redirect_from_http ?? '(unbekannt)'}`);
  lines.push(`- **Antwortzeit:** ${r.timing_ms} ms · **Content-Size:** ${(r.content_length / 1024).toFixed(1)} KB`);
  lines.push(`- **Trackers:** ${r.trackers.length > 0 ? r.trackers.join(', ') : '(keine erkannt)'}`);
  lines.push(`- **Consent-Manager:** ${r.consent_managers.length > 0 ? r.consent_managers.join(', ') : '(keiner erkannt)'}`);
  lines.push(`- **Google Fonts remote:** ${r.google_fonts_remote ? '⚠️ ja' : 'nein'}`);
  lines.push(`- **Impressum-Link:** ${r.has_imprint_link ? '✅' : '❌'} · **Datenschutz-Link:** ${r.has_privacy_link ? '✅' : '❌'}`);
  lines.push(`- **Cookies bei initialem GET:** ${r.cookies_set_on_initial_get.length > 0 ? r.cookies_set_on_initial_get.join(', ') : '(keine)'}`);
  lines.push('');

  lines.push(`## Security-Headers`);
  lines.push('');
  lines.push('| Header | Wert |');
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(r.security_headers)) {
    lines.push(`| \`${k}\` | ${v ? `\`${String(v).slice(0, 90)}\`` : '❌ fehlt'} |`);
  }
  lines.push('');

  if (r.third_party_hosts.length > 0) {
    lines.push(`## Drittanbieter-Hosts (${r.third_party_hosts.length})`);
    lines.push('');
    for (const h of r.third_party_hosts) lines.push(`- \`${h}\``);
    lines.push('');
  }

  if (r.findings.length > 0) {
    lines.push(`## Findings`);
    lines.push('');
    for (const f of r.findings) {
      lines.push(`- ${severityIcon(f.severity)} **${f.code}** — ${f.msg}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function renderSummary(results) {
  const lines = [];
  lines.push(`# Audit-Batch · Neuhaus am Rennweg`);
  lines.push('');
  lines.push(`_${results.length} Domains · ${new Date().toISOString()}_`);
  lines.push('');
  lines.push('| Domain | Score | High | Med | Trackers | Consent | GFonts | Impr | DS |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    const high = r.findings.filter((f) => f.severity === 'high').length;
    const med = r.findings.filter((f) => f.severity === 'medium').length;
    const score = r.https.error ? '—' : Math.max(0, 100 - high * 12 - med * 4);
    lines.push(
      `| [${r.domain}](./${r.domain}.md) | ${score} | ${high} | ${med} | ${r.trackers.length} | ${r.consent_managers.length > 0 ? '✅' : '❌'} | ${r.google_fonts_remote ? '⚠️' : '✅'} | ${r.has_imprint_link ? '✅' : '❌'} | ${r.has_privacy_link ? '✅' : '❌'} |`,
    );
  }
  lines.push('');
  lines.push(`Legende: **High** = wahrscheinlicher DSGVO/TTDSG-Verstoß · **Med** = Best-Practice-Empfehlung · **GFonts** = Google Fonts lokal eingebunden · **Impr/DS** = Impressum/Datenschutz-Link auf Startseite`);
  return lines.join('\n');
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Scanne ${DOMAINS.length} Domains...`);

  const results = [];
  for (const d of DOMAINS) {
    process.stdout.write(`  ${d.padEnd(40)} `);
    try {
      const r = await auditDomain(d);
      results.push(r);
      const high = r.findings.filter((f) => f.severity === 'high').length;
      console.log(r.https.error ? `❌ ${r.https.error}` : `✓ ${high} High-Findings`);
      await writeFile(resolve(OUT_DIR, `${d}.json`), JSON.stringify(r, null, 2));
      await writeFile(resolve(OUT_DIR, `${d}.md`), renderMarkdown(r));
    } catch (err) {
      console.log(`❌ ${err.message}`);
      results.push({ domain: d, https: { error: err.message }, findings: [] });
    }
  }

  await writeFile(resolve(OUT_DIR, '_summary.md'), renderSummary(results));
  console.log(`\nFertig. Output in scans/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

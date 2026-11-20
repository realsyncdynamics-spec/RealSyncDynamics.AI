#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Domain-/Edge-Routing-Diagnose — RealSyncDynamics.AI
// ─────────────────────────────────────────────────────────────────────────────
// Tiefer als smoke-production-routing.mjs: prüft pro Base × Route je GET UND HEAD
// und dumpt die für eine Cloudflare-Edge-Diagnose relevanten Header:
//   Status · Final-URL (nach Redirects) · Content-Type · Content-Length ·
//   cf-cache-status · cf-ray · server · location · Body-Preview (≤300 Zeichen) bei Fehlern.
//
// Zweck: Split-Brain zwischen pages.dev und Custom Domain sichtbar machen
// (unterschiedliche Edge-Pfade, Worker-Routen, Cache-Artefakte, Trailing-Slash-Regeln).
//
// Nutzung:  node scripts/diagnose-domain-routing.mjs
//           npm run diagnose:domain
//
// Reiner Read-Only-Report. Kein Exit-Fail (Diagnose, kein Gate).
// ─────────────────────────────────────────────────────────────────────────────

import { classifyVoiceApiResponse, VOICE_ROUTES } from './voice-route-check.mjs';

const BASES = [
  { name: 'pages.dev', url: 'https://realsyncdynamics-ai.pages.dev' },
  { name: 'apex',      url: 'https://realsyncdynamicsai.de' },
  { name: 'www',       url: 'https://www.realsyncdynamicsai.de' },
];

const ROUTES = ['/', '/pricing', '/pricing/', '/audit', '/audit/', '/login', '/app', ...VOICE_ROUTES];
const METHODS = ['HEAD', 'GET'];
const TIMEOUT_MS = 15000;
const UA = 'rsd-diagnose/1';

const HEADERS_OF_INTEREST = [
  'content-type', 'content-length', 'cf-cache-status', 'cf-ray', 'server',
  'location', 'cache-control', 'x-served-by',
];

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA }, ...opts });
  } finally {
    clearTimeout(timer);
  }
}

function headerSnapshot(res) {
  const out = {};
  for (const h of HEADERS_OF_INTEREST) out[h] = res.headers.get(h);
  return out;
}

async function probe(baseUrl, route, method) {
  const url = baseUrl + route;
  const rec = {
    url, method, status: 0, finalUrl: url,
    headers: {}, bodyPreview: '', apiCheck: null, error: null,
  };
  try {
    // redirect: manual, um Redirect-Ziele und Trailing-Slash-Regeln zu sehen.
    const r = await fetchWithTimeout(url, { method, redirect: 'manual' });
    let checkedResponse = r;
    rec.status = r.status;
    rec.headers = headerSnapshot(r);
    rec.finalUrl = url;

    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      const target = new URL(r.headers.get('location'), url).toString();
      const rf = await fetchWithTimeout(target, { method, redirect: 'follow' });
      checkedResponse = rf;
      rec.status = rf.status;
      rec.finalUrl = rf.url;
      rec.headers = headerSnapshot(rf);
      if (method === 'GET' && rf.status >= 400 && !VOICE_ROUTES.includes(route)) {
        rec.bodyPreview = (await safeText(rf)).slice(0, 300);
      }
    } else if (method === 'GET' && r.status >= 400 && !VOICE_ROUTES.includes(route)) {
      rec.bodyPreview = (await safeText(r)).slice(0, 300);
    }
    if (VOICE_ROUTES.includes(route)) {
      rec.apiCheck = classifyVoiceApiResponse({
        route, method, status: rec.status, contentType: rec.headers['content-type'],
        body: method === 'GET' ? await checkedResponse.text() : '',
      });
    }
  } catch (e) {
    rec.error = e.code || e.name || e.message || 'unknown';
  }
  return rec;
}

async function safeText(res) {
  try { return (await res.text()).replace(/\s+/g, ' ').trim(); }
  catch { return '(Body nicht lesbar)'; }
}

function fmt(rec) {
  const h = rec.headers || {};
  const lines = [];
  const finalNote = rec.finalUrl !== rec.url ? `  → ${rec.finalUrl}` : '';
  lines.push(`  [${rec.method}] ${rec.url}${finalNote}`);
  if (rec.error) {
    lines.push(`        ERROR: ${rec.error}`);
    return lines.join('\n');
  }
  lines.push(
    `        status=${rec.status}` +
    `  ct=${h['content-type'] || '-'}` +
    `  len=${h['content-length'] || '-'}` +
    `  cf-cache=${h['cf-cache-status'] || '-'}` +
    `  server=${h['server'] || '-'}` +
    `  cf-ray=${h['cf-ray'] || '-'}`,
  );
  if (h['location']) lines.push(`        location=${h['location']}`);
  if (h['cache-control']) lines.push(`        cache-control=${h['cache-control']}`);
  if (rec.bodyPreview) lines.push(`        body[≤300]=${rec.bodyPreview}`);
  if (rec.apiCheck) {
    const verdict = rec.apiCheck.ok === true ? 'PASS' : rec.apiCheck.ok === false ? 'FAIL' : 'ADVISORY';
    lines.push(`        api=${rec.apiCheck.state} [${verdict}]`);
  }
  return lines.join('\n');
}

async function main() {
  console.log('Domain-/Edge-Routing-Diagnose — RealSyncDynamics.AI');
  console.log('Zeit:', new Date().toISOString());

  for (const base of BASES) {
    console.log(`\n══════════ ${base.name}  (${base.url}) ══════════`);
    for (const route of ROUTES) {
      console.log(`\n• ${route}`);
      for (const method of METHODS) {
        const rec = await probe(base.url, route, method);
        console.log(fmt(rec));
      }
    }
  }
  console.log('\nHinweis: Read-only. GET-API-PASS beweist nur das Routing, nicht Audio-End-to-End, KV oder Secrets. HEAD ist advisory.');
  console.log('Voice bleibt bis zur ausdruecklichen Produktionsfreigabe deaktiviert.');
}

main().catch((e) => { console.error(e); process.exit(1); });

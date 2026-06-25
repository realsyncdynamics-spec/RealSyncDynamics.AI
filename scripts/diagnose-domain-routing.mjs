#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Domain-/Edge-Routing-Diagnose — RealSyncDynamics.AI
// ─────────────────────────────────────────────────────────────────────────────
// Tiefer als smoke-production-routing.mjs: prüft pro Base × Route je GET UND HEAD
// und dumpt die für eine Cloudflare-Edge-Diagnose relevanten Header:
//   Status · Final-URL (nach Redirects) · Content-Type · Content-Length ·
//   cf-cache-status · cf-ray · server · location · Body-Preview (≤300 Zeichen) bei Fehlern.
//
// Zusätzlich: DNSSEC-/DS-Konsistenz-Audit (DoH, Google + Cloudflare) — erkennt die
// klassische `DNS_LOOKUP_FAILED`-Ursache (signierte Zone ohne/mit abweichendem DS
// beim Registrar → SERVFAIL bei validierenden Resolvern). Gibt OK/WARN/FAIL aus.
//
// Zweck: Split-Brain zwischen pages.dev und Custom Domain sichtbar machen
// (unterschiedliche Edge-Pfade, Worker-Routen, Cache-Artefakte, Trailing-Slash-Regeln).
//
// Nutzung:  node scripts/diagnose-domain-routing.mjs
//           npm run diagnose:domain
//
// Reiner Read-Only-Report. Kein Exit-Fail (Diagnose, kein Gate).
// ─────────────────────────────────────────────────────────────────────────────

const BASES = [
  { name: 'pages.dev', url: 'https://realsyncdynamics-ai.pages.dev' },
  { name: 'apex',      url: 'https://realsyncdynamicsai.de' },
];

// Zonen-Apex für den DNSSEC-/DS-Audit (Host der Custom Domain).
const APEX_DOMAIN = new URL(BASES.find((b) => b.name === 'apex').url).host;

const ROUTES = ['/', '/pricing', '/pricing/', '/audit', '/audit/', '/login', '/app'];
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
    headers: {}, bodyPreview: '', error: null,
  };
  try {
    // redirect: manual, um Redirect-Ziele und Trailing-Slash-Regeln zu sehen.
    const r = await fetchWithTimeout(url, { method, redirect: 'manual' });
    rec.status = r.status;
    rec.headers = headerSnapshot(r);
    rec.finalUrl = url;

    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      const target = new URL(r.headers.get('location'), url).toString();
      const rf = await fetchWithTimeout(target, { method, redirect: 'follow' });
      rec.status = rf.status;
      rec.finalUrl = rf.url;
      rec.headers = headerSnapshot(rf);
      if (method === 'GET' && rf.status >= 400) {
        rec.bodyPreview = (await safeText(rf)).slice(0, 300);
      }
    } else if (method === 'GET' && r.status >= 400) {
      rec.bodyPreview = (await safeText(r)).slice(0, 300);
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
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DNSSEC-/DS-Konsistenz-Audit (DoH, read-only)
// ─────────────────────────────────────────────────────────────────────────────
// Motiviert durch das Symptom `DNS_LOOKUP_FAILED`: Ein im Browser sichtbarer
// DNS-Auflösungsfehler ist KEIN HTTP-Status, sondern ein Resolver-Fehler. Die
// häufigste Ursache bei sonst gesunder Domain ist eine UNVOLLSTÄNDIGE/abweichende
// DNSSEC-Kette: Die Zone ist signiert (DNSKEY/RRSIG), aber beim Registrar (.de →
// DENIC) fehlt der passende DS-Record — oder ein abweichender DS erzeugt bei
// validierenden Resolvern `SERVFAIL`, was der Browser als `DNS_LOOKUP_FAILED` zeigt.
//
// Wir fragen über DNS-over-HTTPS (Google + Cloudflare, beide validierend) ab:
//   • DNSKEY (Zone signiert?)  • DS am Elternknoten (Kette beim Registrar?)
//   • A mit do=1/cd=0 (validiert) vs. do=1/cd=1 (Validierung umgangen)
// SERVFAIL nur bei cd=0 ⇒ DNSSEC-Validierung schlägt fehl (bogus).
const DOH_RESOLVERS = [
  { name: 'google',     url: 'https://dns.google/resolve',            headers: {} },
  { name: 'cloudflare', url: 'https://cloudflare-dns.com/dns-query',  headers: { accept: 'application/dns-json' } },
];

async function dohQuery(resolver, name, type, extra = '') {
  const url = `${resolver.url}?name=${encodeURIComponent(name)}&type=${type}${extra}`;
  const r = await fetchWithTimeout(url, { headers: resolver.headers });
  if (!r.ok) throw new Error(`DoH ${resolver.name} HTTP ${r.status}`);
  return r.json();
}

function answersOfType(json, type) {
  return (json.Answer || []).filter((a) => a.type === type);
}

async function dnssecAudit(domain) {
  console.log('\n══════════ DNSSEC-/DS-Konsistenz  (' + domain + ') ══════════');

  // Primär Google (liefert auch DS am Elternknoten zuverlässig), Cloudflare als Quervergleich.
  const resolver = DOH_RESOLVERS[0];
  let signed, dsPresent, dnskeyCount, dsCount, ns;
  try {
    const [dnskey, ds, nsRec] = await Promise.all([
      dohQuery(resolver, domain, 'DNSKEY'),
      dohQuery(resolver, domain, 'DS'),
      dohQuery(resolver, domain, 'NS'),
    ]);
    dnskeyCount = answersOfType(dnskey, 48).length; // 48 = DNSKEY
    dsCount = answersOfType(ds, 43).length;         // 43 = DS
    signed = dnskeyCount > 0;
    dsPresent = dsCount > 0;
    ns = answersOfType(nsRec, 2).map((a) => a.data).join(', ') || '-'; // 2 = NS
  } catch (e) {
    console.log(`  ⚠️  DNSSEC-Audit übersprungen — DoH nicht erreichbar (${resolver.name}): ${e.message}`);
    return;
  }

  // Validierungs-Probe je Resolver: A mit cd=0 (validiert) vs. cd=1 (Validierung aus).
  const probes = [];
  for (const res of DOH_RESOLVERS) {
    try {
      const [validate, bypass] = await Promise.all([
        dohQuery(res, domain, 'A', '&do=1&cd=0'),
        dohQuery(res, domain, 'A', '&do=1&cd=1'),
      ]);
      probes.push({
        resolver: res.name,
        validateStatus: validate.Status, ad: validate.AD === true,
        bypassStatus: bypass.Status,
        bogus: validate.Status === 2 && bypass.Status === 0, // SERVFAIL nur mit Validierung
      });
    } catch (e) {
      probes.push({ resolver: res.name, error: e.message });
    }
  }

  console.log(`  Nameserver:   ${ns}`);
  console.log(`  DNSKEY:       ${signed ? `vorhanden (${dnskeyCount}) → Zone ist signiert` : 'keine → Zone unsigniert'}`);
  console.log(`  DS @Registry: ${dsPresent ? `vorhanden (${dsCount})` : 'KEINER → Vertrauenskette beim Registrar nicht geschlossen'}`);
  for (const p of probes) {
    if (p.error) { console.log(`  Probe ${p.resolver.padEnd(10)} ERROR: ${p.error}`); continue; }
    console.log(
      `  Probe ${p.resolver.padEnd(10)} A(validate)=${dohStatus(p.validateStatus)}` +
      `  A(bypass)=${dohStatus(p.bypassStatus)}  AD=${p.ad}`,
    );
  }

  // ── Verdikt ────────────────────────────────────────────────────────────────
  const anyBogus = probes.some((p) => p.bogus);
  let verdict, level;
  if (anyBogus) {
    level = 'FAIL';
    verdict =
      'DNSSEC-Validierung schlägt fehl (SERVFAIL nur bei aktiver Validierung). ' +
      'Validierende Resolver liefern dann `DNS_LOOKUP_FAILED`. → DS beim Registrar an die ' +
      'aktuelle DNSKEY angleichen ODER DNSSEC in Cloudflare deaktivieren.';
  } else if (!signed && dsPresent) {
    level = 'FAIL';
    verdict =
      'DS am Elternknoten, aber Zone NICHT signiert → gebrochene Kette, SERVFAIL wahrscheinlich. ' +
      'Stale DS beim Registrar entfernen.';
  } else if (signed && !dsPresent) {
    level = 'WARN';
    verdict =
      'Zone signiert, aber KEIN DS beim Registrar (.de/DENIC). Auflösung erfolgt als „insecure" ' +
      '(funktioniert), die Kette ist aber offen — latent fragil bei Key-Rollover/abweichendem DS. ' +
      'Entweder DS bei Hostinger hinterlegen ODER DNSSEC in Cloudflare deaktivieren. Nicht halb-aktiviert lassen.';
  } else if (signed && dsPresent && !probes.some((p) => p.ad)) {
    level = 'WARN';
    verdict = 'DS vorhanden, aber kein Resolver meldet AD=true → möglicher Key-/Digest-Mismatch. Mit dnsviz.net prüfen.';
  } else if (signed && dsPresent) {
    level = 'OK';
    verdict = 'DNSSEC vollständig und validiert (AD=true).';
  } else {
    level = 'OK';
    verdict = 'Zone ohne DNSSEC (unsigniert, kein DS) — konsistent, keine DNSSEC-bedingten Auflösungsfehler.';
  }
  const icon = level === 'OK' ? '✅' : level === 'WARN' ? '⚠️ ' : '❌';
  console.log(`  ${icon} ${level}: ${verdict}`);
  console.log('  Tiefen-Check: https://dnsviz.net/d/' + domain + '/dnssec/');
}

function dohStatus(code) {
  // RFC-1035-RCODEs, die Google/Cloudflare-DoH als `Status` liefern.
  const map = { 0: 'NOERROR', 2: 'SERVFAIL', 3: 'NXDOMAIN' };
  return `${map[code] ?? code}`;
}

async function main() {
  console.log('Domain-/Edge-Routing-Diagnose — RealSyncDynamics.AI');
  console.log('Zeit:', new Date().toISOString());

  await dnssecAudit(APEX_DOMAIN);

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
  console.log('\nHinweis: Diagnose-Report (read-only). Edge-Befunde → REALSYNC_DOMAIN_EDGE_DIAGNOSIS.md');
}

main().catch((e) => { console.error(e); process.exit(1); });

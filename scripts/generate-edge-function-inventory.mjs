#!/usr/bin/env node
// Edge-Function-Inventar-Generator (PLAN_100 #15/#16).
//
// ## Warum dieses Skript existiert
//
// `docs/EDGE_FUNCTIONS_INVENTORY.md` war von Hand gepflegt und auf dem Stand
// „~84 Functions / Juni 2026" eingefroren — tatsaechlich laufen 200. Ein von
// Hand gepflegtes Inventar veraltet genau so lautlos wie die Prod-Liste, die
// der Drift-Guard deshalb misst statt herleitet. Dieses Skript erzeugt das
// Inventar aus denselben Quellen, die der Code ohnehin fuehrt, damit es nicht
// wieder driftet.
//
// ## Herkunftsnachweis (Quellen, keine Behauptung)
//
//   Grundwahrheit „in Produktion"   src/config/production-edge-functions.ts
//   Erreichbarkeit frontend          functions.invoke('<slug>') / functions/v1/<slug> in src/
//   Erreichbarkeit public/webhook    [functions.<slug>] verify_jwt=false in supabase/config.toml
//   Erreichbarkeit frontend-wrapper  postEdgeFunction/postFunction/edgeFunctionUrl/invoke('<slug>')
//                                    oder ueber eine Konstante in derselben Datei
//   Erreichbarkeit cron              functions/v1/<slug> oder dispatch_cron_function('<slug>') in
//                                    supabase/migrations/
//   Erreichbarkeit function-call     functions/v1/<slug> in supabase/functions/<anderer-slug>/
//
// Es loescht und deprecatet nichts. Es markiert nur „deployt, aber kein
// Code-Caller im Repo gefunden" als Pruef-Kandidat fuer #16 — die
// Entscheidung trifft ein Mensch pro Function.
//
// Lauf:   node scripts/generate-edge-function-inventory.mjs           (schreibt die Datei)
//         node scripts/generate-edge-function-inventory.mjs --check   (CI: faellt bei Drift)

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUNCTIONS_DIR = path.join(ROOT, 'supabase', 'functions');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const CONFIG_TOML = path.join(ROOT, 'supabase', 'config.toml');
const PROD_LIST_TS = path.join(ROOT, 'src', 'config', 'production-edge-functions.ts');
const SRC_DIR = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'docs', 'EDGE_FUNCTIONS_INVENTORY.md');

const CHECK = process.argv.includes('--check');

// --- Grundwahrheit: die in Produktion deployten Slugs + Messdatum ----------
function readProdList() {
  const ts = readFileSync(PROD_LIST_TS, 'utf8');
  const start = ts.indexOf('PRODUCTION_EDGE_FUNCTIONS: readonly string[] = [');
  if (start === -1) throw new Error('PRODUCTION_EDGE_FUNCTIONS nicht gefunden');
  const end = ts.indexOf('];', start);
  const slugs = [...ts.slice(start, end).matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
  const measured = (ts.match(/PRODUCTION_EDGE_FUNCTIONS_MEASURED_AT = '([^']+)'/) || [])[1] || 'unbekannt';
  return { prod: new Set(slugs), measured };
}

// --- Verzeichnisse unter supabase/functions (ohne _shared etc.) ------------
function readFunctionDirs() {
  if (!existsSync(FUNCTIONS_DIR)) return [];
  return readdirSync(FUNCTIONS_DIR)
    .filter((n) => !n.startsWith('_') && !n.startsWith('.'))
    .filter((n) => {
      try { return statSync(path.join(FUNCTIONS_DIR, n)).isDirectory(); } catch { return false; }
    })
    .sort();
}

// --- rekursiv Dateien einsammeln -------------------------------------------
function walk(dir, exts, skip = () => false) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      if (skip(full)) continue;
      out.push(...walk(full, exts, skip));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

function concatFiles(files) {
  let buf = '';
  for (const f of files) {
    try { buf += '\n' + readFileSync(f, 'utf8'); } catch { /* ignore */ }
  }
  return buf;
}

// Wortgrenzen-sichere Treffer: <slug> darf nicht Praefix eines laengeren
// Slugs sein (z. B. `audit` in `api-audit`).
const B = '(?![a-z0-9-])';

// Aufruf-Wrapper um functions.invoke / functions/v1, die einen Slug als erstes
// Argument nehmen; optional mit Typ-Argument (`postEdgeFunction<T>(`).
// `invoke` nur als freistehender Bezeichner, damit `functions.invoke` getrennt
// (frontend-invoke) gezaehlt wird.
const WRAPPER_CALL = '(?:\\bpostEdgeFunction|\\bpostFunction|\\bedgeFunctionUrl|(?<![.\\w])invoke)(?:<[^>()]*>)?';

function main() {
  const { prod, measured } = readProdList();
  const dirs = readFunctionDirs();
  const dirSet = new Set(dirs);

  // Referenz-Korpora einmal einlesen.
  const srcFiles = walk(SRC_DIR, ['.ts', '.tsx', '.js', '.jsx', '.mjs']);
  const srcBlob = concatFiles(srcFiles);
  // Je Datei getrennt: Konstanten-Aufloesung (`const X = '<slug>'` → `invoke(X)`)
  // darf nicht ueber Dateigrenzen hinweg gleichnamige Bezeichner verbinden.
  const srcTexts = srcFiles.map((f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } });
  const migBlob = concatFiles(walk(MIGRATIONS_DIR, ['.sql']));
  const config = existsSync(CONFIG_TOML) ? readFileSync(CONFIG_TOML, 'utf8') : '';

  // Sekundaer-Korpora: belegen keine Prod-Nutzung, helfen aber bei der
  // #16-Triage einzuordnen, warum eine Function ohne internen Caller existiert.
  const testBlob = concatFiles([
    ...walk(path.join(ROOT, 'test'), ['.ts', '.tsx', '.js', '.mjs']),
    ...walk(path.join(ROOT, 'e2e'), ['.ts', '.tsx', '.js', '.mjs']),
  ]);

  // Function-Korpus je Slug getrennt halten, damit ein Selbstbezug nicht als
  // „function-call" zaehlt.
  const fnBlobs = new Map();
  for (const slug of dirs) {
    fnBlobs.set(slug, concatFiles(walk(path.join(FUNCTIONS_DIR, slug), ['.ts', '.tsx', '.js', '.mjs'])));
  }

  const allSlugs = [...new Set([...dirs, ...prod])].sort();

  const rows = allSlugs.map((slug) => {
    const esc = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Auch Unterpfade (`'siteos/builder'`) und Query-Strings (`'<slug>?tenantId=…'`).
    const invokeRe = new RegExp(`functions\\.invoke\\(\\s*['"\`]${esc}['"\`?/]`);
    const v1Re = new RegExp(`functions/v1/${esc}${B}`);
    const configBlockRe = new RegExp(`\\[functions\\.${esc}\\]`);
    const publicRe = new RegExp(`\\[functions\\.${esc}\\][^\\[]*verify_jwt\\s*=\\s*false`);

    // Wrapper-Aufrufe (src/lib/edgeFunction.ts u. a.): postEdgeFunction<T>('<slug>', …),
    // postFunction('<slug>'), edgeFunctionUrl('<slug>'), invoke('<slug>');
    // erlaubt Typ-Argumente und Pfade mit Query-String (`'<slug>?tenantId=…'`).
    const wrapperRe = new RegExp(`${WRAPPER_CALL}\\(\\s*['"\`]${esc}(?:['"\`?/])`);
    // Konstante mit Slug-Literal (auch im Ternary), die in derselben Datei an
    // einen Wrapper, functions.invoke oder einen functions/v1/\${…}-Pfad geht.
    const constRe = new RegExp(`(?:const|let)\\s+(\\w+)\\s*(?::[^=\\n]+)?=[^;\\n]*['"\`]${esc}['"\`]`, 'g');
    const wrapperViaConst = srcTexts.some((text) => {
      for (const m of text.matchAll(constRe)) {
        const id = m[1];
        const useRe = new RegExp(
          `(?:${WRAPPER_CALL}|functions\\.invoke)\\(\\s*${id}\\b|functions/v1/\\$\\{\\s*${id}\\s*\\}`,
        );
        if (useRe.test(text)) return true;
      }
      return false;
    });
    // Cron ueber den Dispatcher (`dispatch_cron_function('<slug>', '<vault-key>')`).
    const dispatchRe = new RegExp(`dispatch_cron_function\\(\\s*'${esc}'`);

    const frontendInvoke = invokeRe.test(srcBlob);
    const frontendFetch = v1Re.test(srcBlob);
    const frontendWrapper = wrapperRe.test(srcBlob) || wrapperViaConst;
    const cron = v1Re.test(migBlob) || dispatchRe.test(migBlob);
    const declared = configBlockRe.test(config);
    const isPublic = publicRe.test(config);

    // function-call: /functions/v1/<slug> im Code *einer anderen* Function
    let functionCall = false;
    for (const [other, blob] of fnBlobs) {
      if (other === slug) continue;
      if (v1Re.test(blob)) { functionCall = true; break; }
    }

    const triggers = [];
    if (frontendInvoke) triggers.push('frontend-invoke');
    if (frontendFetch) triggers.push('frontend-fetch');
    if (frontendWrapper) triggers.push('frontend-wrapper');
    if (cron) triggers.push('cron');
    if (functionCall) triggers.push('function-call');
    if (isPublic) triggers.push('public/webhook');

    const inProd = prod.has(slug);
    const hasDir = dirSet.has(slug);

    let status;
    if (inProd && !hasDir) status = 'DRIFT: deployt ohne Quelle';
    else if (!inProd && hasDir) status = 'REPO-ONLY (nicht deployt)';
    else if (triggers.length > 0) status = 'AKTIV';
    else status = 'DEPLOYT-OHNE-CALLER';

    // Triage-Hinweis nur fuer No-Caller: woher kommt die einzige Spur?
    let hint = '';
    if (status === 'DEPLOYT-OHNE-CALLER') {
      const inConfig = configBlockRe.test(config);
      const inTests = v1Re.test(testBlob) || invokeRe.test(testBlob);
      if (inConfig) hint = 'in config.toml deklariert';
      else if (inTests) hint = 'nur Tests/e2e';
      else hint = 'kein interner Caller/Trigger';
    }

    return { slug, status, triggers, inProd, hasDir, isPublic, hint };
  });

  // --- Cluster-Zuordnung (Domaenen-Proxy, kein Personen-Owner) -------------
  const CLUSTERS = [
    ['AI-Act', /^ai-act-/],
    ['AI-Gateway/Invoke', /^ai-(gateway|invoke|os|proxy)|^local-ai|^classify-/],
    ['Agent/Runtime', /^agent-|^enterprise-ai-os-|^remediation-|^kodee|^governance-agent$/],
    ['Governance-OS', /^governance-/],
    ['Evidence', /^evidence-/],
    ['GDPR/DSR', /^gdpr-|^dsr-|^governance-dsr$/],
    ['Scanner/Audit', /^audit-|-audit$|^cookie-scan|^bulk-scan|^scan-|^.*-rescan$|^shopify-scan$/],
    ['Billing/Stripe', /^stripe-|^subscription-|^usage-|^checkout-/],
    ['Shopify', /^shopify-/],
    ['Auth/MFA/Tenant', /^mfa-|^tenant-|^add-auditor$|^provision-|^integration-/],
    ['Marketing/Lead/Mail', /^newsletter-|^welcome-|^sales-|^marketing-|^daily-digest$|-email$|^track-|^telemetry-/],
    ['Notify/Webhook', /^telegram-|-webhook$|-callback$|^automation-|^workflow-/],
    ['Report/PDF/Doc', /-pdf$|^generate-|-report$|^pitch-|^ceo-/],
    ['Health/Ops', /^health$|^smoke-|^api-gateway$|^market-scanner$|^business-metrics/],
    // Weitere Domaenen (angehaengt: fruehere Treffer gewinnen, nur „Sonstige" schrumpft).
    ['ISO 42001/Zertifizierung', /^iso42001-|^certification-|^policy-packs$/],
    ['Website/Betrieb', /^website-|^rebuild-website$|^maintenance-|^cloudflare-|^hostinger-/],
    ['Integrationen', /^microsoft365-|^integration-|^seed-integrations$|^oauth2-|^mcp-/],
    ['Legal/RAG/Provenance', /^legal-|^provenance$|^c2pa-/],
    ['Compliance/NIS2', /^compliance-|^nis2-|^security-signal-/],
    ['SEO/Analytics', /seo|^sync-ga-metrics$|^dashboard-|^share-dashboard$|forecast|^sync-stripe-metrics$/],
    ['Memory', /^memory-/],
    ['Bot/Voice', /^(?:bot-|.*voice)/],
    ['Social', /^social-|^linkedin-oauth$/],
    ['Scheduler/Jobs', /^schedule|^scheduler/],
    ['Webhook-Zustellung', /webhook|-deliver$|-dispatcher$/],
  ];
  const clusterOf = (slug) => (CLUSTERS.find(([, re]) => re.test(slug)) || ['Sonstige'])[0];
  for (const r of rows) r.cluster = clusterOf(r.slug);

  // --- Kennzahlen ----------------------------------------------------------
  const n = rows.length;
  const nActive = rows.filter((r) => r.status === 'AKTIV').length;
  const noCaller = rows.filter((r) => r.status === 'DEPLOYT-OHNE-CALLER');
  const repoOnly = rows.filter((r) => r.status === 'REPO-ONLY (nicht deployt)');
  const drift = rows.filter((r) => r.status.startsWith('DRIFT'));
  const publicNoCaller = noCaller.filter((r) => r.isPublic); // sollte leer sein (public => Trigger)

  // --- Markdown rendern ----------------------------------------------------
  const byCluster = new Map();
  for (const r of rows) {
    if (!byCluster.has(r.cluster)) byCluster.set(r.cluster, []);
    byCluster.get(r.cluster).push(r);
  }
  const clusterNames = [...byCluster.keys()].sort((a, b) => a.localeCompare(b, 'de'));

  let md = '';
  md += '# Edge-Function-Inventar\n\n';
  md += `> **Automatisch erzeugt** von \`scripts/generate-edge-function-inventory.mjs\` — nicht von Hand editieren.\n`;
  md += `> Neu erzeugen: \`node scripts/generate-edge-function-inventory.mjs\`. Grundlage: PLAN_100 #15/#16.\n>\n`;
  md += `> Grundwahrheit „in Produktion": \`src/config/production-edge-functions.ts\` (Messung ${measured}, vom Drift-Guard gehuetet).\n`;
  md += `> Erreichbarkeit: Referenz-Scan ueber \`src/\`, \`supabase/config.toml\`, \`supabase/migrations/\` und Function-zu-Function-Calls.\n`;
  md += `> **Scope:** statischer Repo-Scan, kein Laufzeit-Healthcheck. Produktiv verwaltete Runtime-Crons koennen ausserhalb der Migrationen liegen; aktueller Snapshot: [Runtime-Beobachtungen](./EDGE_FUNCTIONS_RUNTIME_OBSERVATIONS.md).\n\n`;

  md += '## Statusuebersicht\n\n';
  md += '| Status | Anzahl | Bedeutung |\n|---|---:|---|\n';
  md += `| AKTIV | ${nActive} | Deployt **und** mit mindestens einem Caller/Trigger im Repo (invoke/fetch/cron/function-call/public) |\n`;
  md += `| DEPLOYT-OHNE-CALLER | ${noCaller.length} | Deployt, aber kein Code-Caller im Repo gefunden → Pruef-Kandidat fuer #16 (nicht automatisch „tot") |\n`;
  md += `| REPO-ONLY (nicht deployt) | ${repoOnly.length} | Verzeichnis im Repo, aber nicht in der Prod-Liste |\n`;
  md += `| DRIFT: deployt ohne Quelle | ${drift.length} | In Prod-Liste, aber kein Verzeichnis (sollte 0 sein — sonst Drift-Guard) |\n`;
  md += `| **Summe** | **${n}** | Vereinigung aus Prod-Liste (${prod.size}) und Verzeichnissen (${dirs.length}) |\n\n`;

  md += '### Einordnung\n\n';
  if (drift.length === 0 && repoOnly.length === 0) {
    md += `- **Repo und Produktion sind deckungsgleich** (${dirs.length} Verzeichnisse = ${prod.size} deployte Slugs). `;
    md += `Es gibt derzeit **keine** „tot per Deployment"-Function: kein Verzeichnis ohne Deploy, kein Deploy ohne Quelle. Der Drift-Guard (\`npm run check:edge-functions\`) haelt das auf null.\n`;
  } else {
    md += `- ⚠️ Repo und Produktion weichen ab (${repoOnly.length} nur im Repo, ${drift.length} nur deployt) — siehe die jeweiligen Listen unten.\n`;
  }
  md += '- **Grenze der Repo-Sicht:** Cron-Jobs, die nur in der Produktions-DB angelegt wurden (nicht in `supabase/migrations/`), externe Webhook-Ziele und manuelle Aufrufe sind hier unsichtbar. Vor #16 deshalb `cron.job`, die Aufruf-Logs und die Webhook-Konfiguration der Anbieter gegenpruefen.\n';
  md += `- Das einzige verbleibende „tot?"-Signal ist **DEPLOYT-OHNE-CALLER** (${noCaller.length}): deployt, aber im Repo ruft nichts sie auf. Das ist die Arbeitsliste fuer #16 — **nicht** eine Loeschfreigabe. Vor jeder Deprecation gilt weiterhin: fetch- *und* invoke-bewusst gegenpruefen, Out-of-band-/Admin-Nutzung ausschliessen.\n`;
  if (publicNoCaller.length === 0) {
    md += `- Alle oeffentlichen Functions (\`verify_jwt=false\`, z. B. Webhooks von Stripe/Shopify/Telegram) tragen den Trigger \`public/webhook\` und zaehlen damit als AKTIV, auch ohne internen Caller.\n`;
  }
  md += '\n';

  if (noCaller.length > 0) {
    const hintCounts = {};
    for (const r of noCaller) hintCounts[r.hint] = (hintCounts[r.hint] || 0) + 1;
    md += `## #16 Pruef-Kandidaten — deployt, aber kein interner Caller (${noCaller.length})\n\n`;
    md += '> **Kein Loeschbefund.** „Kein Caller" heisst: im Repo (\`src/\`, \`config.toml\`, Migrationen, Function-zu-Function) ruft nichts diese Function auf. ';
    md += 'Extern erreichbare APIs (z. B. \`api-audit\`, OAuth-Endpunkte) und Out-of-band-/Admin-Tools (z. B. \`mfa-admin-reset\`) sind legitim ohne internen Caller. ';
    md += 'Pro Function verifizieren, bevor an Deprecation (#16) gedacht wird.\n\n';
    md += '**Aufschluesselung nach Spur:** ' + Object.entries(hintCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ') + '\n\n';
    md += '| Function | Cluster | Einzige Spur |\n|---|---|---|\n';
    for (const r of noCaller.sort(
      (a, b) => a.cluster.localeCompare(b.cluster, 'de') || a.slug.localeCompare(b.slug),
    )) {
      md += `| \`${r.slug}\` | ${r.cluster} | ${r.hint} |\n`;
    }
    md += '\n';
  }

  if (repoOnly.length > 0) {
    md += `## REPO-ONLY — im Repo, nicht in der Prod-Liste (${repoOnly.length})\n\n`;
    md += '| Function | Cluster | Erreichbarkeit |\n|---|---|---|\n';
    for (const r of repoOnly) md += `| \`${r.slug}\` | ${r.cluster} | ${r.triggers.join(', ') || '—'} |\n`;
    md += '\n';
  }

  md += '## Vollinventar nach Cluster\n\n';
  md += `> Spalte **Cluster** ist eine aus dem Slug abgeleitete Domaenen-Zuordnung, **kein** Personen-Owner — den fuehrt das Repo derzeit nicht (Folgeaufgabe: CODEOWNERS fuer \`supabase/functions/\`).\n\n`;
  for (const name of clusterNames) {
    const list = byCluster.get(name).sort((a, b) => a.slug.localeCompare(b.slug));
    md += `### ${name} (${list.length})\n\n`;
    md += '| Function | Status | Erreichbarkeit |\n|---|---|---|\n';
    for (const r of list) {
      md += `| \`${r.slug}\` | ${r.status} | ${r.triggers.join(', ') || '—'} |\n`;
    }
    md += '\n';
  }

  md += '---\n\n';
  md += `_Erzeugt am ${new Date().toISOString().slice(0, 10)} · ${n} Functions · ${nActive} AKTIV · ${noCaller.length} ohne Caller._\n`;

  if (CHECK) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    // Zeitstempel-Zeile beim Vergleich ignorieren (sonst waere der Check taeglich rot).
    const strip = (s) => s.replace(/_Erzeugt am \d{4}-\d{2}-\d{2} /, '_Erzeugt am <date> ');
    if (strip(current) !== strip(md)) {
      console.error('❌ docs/EDGE_FUNCTIONS_INVENTORY.md ist veraltet. Neu erzeugen: node scripts/generate-edge-function-inventory.mjs');
      process.exit(1);
    }
    console.log('✅ Edge-Function-Inventar aktuell.');
    return;
  }

  writeFileSync(OUT, md);
  console.log(`✅ ${OUT} geschrieben — ${n} Functions, ${nActive} AKTIV, ${noCaller.length} ohne Caller, ${repoOnly.length} repo-only, ${drift.length} drift.`);
}

main();

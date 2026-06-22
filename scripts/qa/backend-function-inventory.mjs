#!/usr/bin/env node
// QA: Backend-/Edge-Function-Inventar
// -----------------------------------------------------------------------------
// Statischer Scan über supabase/functions + supabase/config.toml.
// Erzeugt ein deterministisches Inventar aller Edge Functions mit:
//   - Name
//   - verify_jwt (aus config.toml; Default true)
//   - Kategorie (heuristisch aus Namen + Auth-Pattern)
//   - benötigte Secrets (Deno.env.get(...) Treffer)
//   - referenzierte Tabellen (.from('...') Treffer)
//   - Frontend-Anbindung (Aufruf via functions.invoke('name') / fetch im src/)
//
// Kein Netzwerkzugriff. Reiner Quelltext-Scan -> CI-tauglich.
//
// Usage:  node scripts/qa/backend-function-inventory.mjs [--json]
// Exit:   0 immer (reines Reporting). --strict -> 1 wenn UNUSED gefunden.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FUNCTIONS_DIR = join(ROOT, 'supabase', 'functions');
const CONFIG_TOML = join(ROOT, 'supabase', 'config.toml');
const SRC_DIR = join(ROOT, 'src');

const JSON_OUT = process.argv.includes('--json');
const STRICT = process.argv.includes('--strict');

// ---- verify_jwt aus config.toml lesen (Default true) -----------------------
function readVerifyJwt() {
  const map = {};
  if (!existsSync(CONFIG_TOML)) return map;
  const toml = readFileSync(CONFIG_TOML, 'utf8');
  const re = /\[functions\.([^\]]+)\]\s*\n(?:[^\[]*?\n)?verify_jwt\s*=\s*(true|false)/g;
  // Robust: blockweise parsen
  const blocks = toml.split(/\n(?=\[functions\.)/);
  for (const b of blocks) {
    const name = b.match(/\[functions\.([^\]]+)\]/);
    const vj = b.match(/verify_jwt\s*=\s*(true|false)/);
    if (name) map[name[1]] = vj ? vj[1] === 'true' : true;
  }
  void re;
  return map;
}

// ---- alle Quelltext-Dateien einer Function einlesen ------------------------
function readFnSource(fnPath) {
  let src = '';
  const walk = (p) => {
    for (const e of readdirSync(p)) {
      const fp = join(p, e);
      const st = statSync(fp);
      if (st.isDirectory()) walk(fp);
      else if (/\.(ts|tsx|js|mjs)$/.test(e)) src += '\n' + readFileSync(fp, 'utf8');
    }
  };
  walk(fnPath);
  return src;
}

function uniq(arr) { return [...new Set(arr)]; }

function extractSecrets(src) {
  return uniq([...src.matchAll(/Deno\.env\.get\(['"`]([A-Z0-9_]+)['"`]\)/g)].map((m) => m[1]));
}
function extractTables(src) {
  return uniq([...src.matchAll(/\.from\(['"`]([a-z0-9_]+)['"`]\)/g)].map((m) => m[1])).sort();
}

// ---- Kategorie-Heuristik ----------------------------------------------------
function categorize(name, src, verifyJwt) {
  const n = name.toLowerCase();
  if (name.startsWith('stripe-')) return 'STRIPE';
  if (/webhook|callback|-ingest$/.test(n) && !verifyJwt) return 'STRIPE_WEBHOOK/RECEIVER';
  if (/-cron$|cron|digest|sweeper|aggregator|recheck|runner/.test(n)) return 'CRON_ONLY';
  if (n.startsWith('gdpr-')) return 'GDPR';
  if (n.startsWith('ai-act')) return 'AI_ACT';
  if (/evidence/.test(n)) return 'EVIDENCE';
  if (n.startsWith('governance')) return 'GOVERNANCE';
  if (/^ai-(invoke|gateway)$/.test(n)) return 'AI_GATEWAY';
  if (/health|telemetry|track-pageview|metrics|monitor/.test(n)) return 'MONITORING';
  if (verifyJwt) return 'JWT_REQUIRED';
  return 'PUBLIC';
}

// ---- Frontend-Anbindung prüfen ---------------------------------------------
function buildFrontendIndex() {
  let blob = '';
  const walk = (p) => {
    if (!existsSync(p)) return;
    for (const e of readdirSync(p)) {
      const fp = join(p, e);
      const st = statSync(fp);
      if (st.isDirectory()) walk(fp);
      else if (/\.(ts|tsx|js|jsx)$/.test(e)) blob += '\n' + readFileSync(fp, 'utf8');
    }
  };
  walk(SRC_DIR);
  return blob;
}

function main() {
  const verifyMap = readVerifyJwt();
  const frontend = buildFrontendIndex();
  const names = readdirSync(FUNCTIONS_DIR).filter(
    (d) => d !== '_shared' && statSync(join(FUNCTIONS_DIR, d)).isDirectory(),
  );

  const rows = [];
  for (const name of names.sort()) {
    const src = readFnSource(join(FUNCTIONS_DIR, name));
    const verifyJwt = verifyMap[name] ?? true; // Supabase-Default
    const wired = new RegExp(`['"\`]${name}['"\`]`).test(frontend);
    const category = categorize(name, src, verifyJwt);
    rows.push({
      name,
      verify_jwt: verifyJwt,
      category: wired ? category : category === 'CRON_ONLY' || category.includes('WEBHOOK') ? category : `${category}`,
      frontend_wired: wired,
      secrets: extractSecrets(src),
      tables: extractTables(src),
      loc: src.split('\n').length,
    });
  }

  const unused = rows.filter(
    (r) => !r.frontend_wired && !/CRON|WEBHOOK|RECEIVER/.test(r.category),
  );

  if (JSON_OUT) {
    console.log(JSON.stringify({ generated_at: new Date().toISOString(), count: rows.length, rows }, null, 2));
  } else {
    console.log(`# Backend Function Inventory (${rows.length} Functions)\n`);
    console.log('| Function | verify_jwt | Kategorie | FE-wired | Secrets | Tabellen | LOC |');
    console.log('|---|---|---|---|---|---|---|');
    for (const r of rows) {
      console.log(
        `| ${r.name} | ${r.verify_jwt} | ${r.category} | ${r.frontend_wired ? '✅' : '—'} | ${r.secrets.join(', ') || '—'} | ${r.tables.slice(0, 6).join(', ') || '—'}${r.tables.length > 6 ? ' …' : ''} | ${r.loc} |`,
      );
    }
    console.log(`\n## Kategorien-Verteilung`);
    const byCat = {};
    for (const r of rows) byCat[r.category] = (byCat[r.category] || 0) + 1;
    for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) console.log(`- ${c}: ${n}`);
    console.log(`\n## Möglicherweise nicht im Frontend verdrahtet (manuelle Prüfung): ${unused.length}`);
    for (const r of unused) console.log(`- ${r.name} (${r.category})`);
  }

  if (STRICT && unused.length) process.exit(1);
}

main();

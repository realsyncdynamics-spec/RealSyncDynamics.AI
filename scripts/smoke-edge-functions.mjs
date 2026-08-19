#!/usr/bin/env node
// Smoke-Test fuer deployte Edge Functions: welche antworten ueberhaupt?
//
// Hintergrund: ein erfolgreicher `supabase functions deploy` sagt nichts
// darueber, ob eine Function auch startet. Fehlt ein Secret, das beim Import
// mit `!` erzwungen wird (`Deno.env.get('X')!`), faellt sie erst beim ersten
// Aufruf um — mit 500 statt 404. Genau diese Unterscheidung macht dieses
// Skript sichtbar, bevor jemand "deployt" mit "funktioniert" verwechselt.
//
// Nebenwirkungsfrei: es wird ausschliesslich OPTIONS geschickt (CORS-Preflight).
// Keine Business-Logik, keine Schreibzugriffe, keine Payloads.
//
//   SUPABASE_URL=https://<ref>.supabase.co node scripts/smoke-edge-functions.mjs
//   node scripts/smoke-edge-functions.mjs plans skills   # nur diese
//
// Exit 1, sobald eine Function 5xx liefert (= deployt, aber kaputt).

import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FUNCTIONS_DIR = 'supabase/functions';
const BASE = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const CONCURRENCY = 8;

if (!BASE) {
  console.error('SUPABASE_URL fehlt (z.B. https://<project-ref>.supabase.co)');
  process.exit(2);
}

function repoFunctions() {
  return readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)
    .filter((name) => existsSync(join(FUNCTIONS_DIR, name, 'index.ts')))
    .sort();
}

// 404 = nicht deployt · 401/403 = deployt, Auth-Tor greift · 5xx = kaputt
function classify(status) {
  if (status === 404) return 'FEHLT';
  if (status >= 500) return 'KAPUTT';
  if (status === 401 || status === 403) return 'AUTH';
  if (status < 400) return 'OK';
  return `HTTP ${status}`;
}

async function probe(name) {
  const url = `${BASE}/functions/v1/${name}`;
  try {
    const res = await fetch(url, { method: 'OPTIONS' });
    return { name, status: res.status, verdict: classify(res.status) };
  } catch (err) {
    return { name, status: 0, verdict: 'UNERREICHBAR', error: err.message };
  }
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : repoFunctions();
const results = [];

for (let i = 0; i < targets.length; i += CONCURRENCY) {
  results.push(...(await Promise.all(targets.slice(i, i + CONCURRENCY).map(probe))));
}

const byVerdict = new Map();
for (const r of results) {
  if (!byVerdict.has(r.verdict)) byVerdict.set(r.verdict, []);
  byVerdict.get(r.verdict).push(r.name);
}

for (const [verdict, names] of [...byVerdict].sort()) {
  console.log(`\n${verdict} (${names.length})`);
  for (const n of names) console.log(`  ${n}`);
}

const broken = byVerdict.get('KAPUTT') ?? [];
const missing = byVerdict.get('FEHLT') ?? [];
console.log(`\n${results.length} geprueft · ${missing.length} nicht deployt · ${broken.length} mit 5xx`);

if (broken.length) {
  console.error('\nDeployt, aber startet nicht — meist ein fehlendes Secret:');
  for (const n of broken) console.error(`  - ${n}`);
  process.exit(1);
}

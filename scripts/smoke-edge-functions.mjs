#!/usr/bin/env node
// Smoke-Test fuer deployte Edge Functions: wer antwortet, und wie?
//
// Hintergrund: ein erfolgreicher `supabase functions deploy` sagt nichts
// darueber, ob eine Function erreichbar ist. Fehlt ein Secret, das beim Import
// mit `!` erzwungen wird, faellt sie erst beim ersten Aufruf um — mit 500
// statt 404. Genau diese Unterscheidung macht dieses Skript sichtbar, bevor
// jemand "deployt" mit "funktioniert" verwechselt.
//
// Nebenwirkungsfrei: es wird ausschliesslich OPTIONS geschickt
// (CORS-Preflight). Keine Business-Logik, keine Schreibzugriffe, keine Payloads.
//
//   SUPABASE_URL=https://<ref>.supabase.co node scripts/smoke-edge-functions.mjs
//   node scripts/smoke-edge-functions.mjs plans siteos   # nur diese
//
// Exit 1, sobald eine Function PREFLIGHT-5XX liefert.
//
// ── Zwei Fallen, die eine reine Statuscode-Zaehlung falsch machen ──
//
// 1. Ein 404 belegt nicht, dass eine Function fehlt. Ein deployter Router ohne
//    Handler auf dem nackten Pfad — `siteos` etwa — antwortet selbst mit 404.
//    Unterschieden wird deshalb am Antwortkoerper: die Plattform meldet fuer
//    eine unbekannte Function woertlich "Requested function was not found",
//    jede Function-eigene Antwort sieht anders aus.
//
// 2. Ein 5xx auf OPTIONS belegt nicht, dass die Function kaputt ist. Es belegt,
//    dass ihr CORS-Preflight scheitert — meist weil sie OPTIONS nicht behandelt
//    und sofort `req.json()` auf einen leeren Koerper wirft. Server-zu-Server-
//    Aufrufe mit echtem Body sind davon unberuehrt; Browser-Aufrufe scheitern,
//    bevor der eigentliche Request rausgeht. Deshalb heisst das Urteil
//    PREFLIGHT-5XX und nicht "kaputt".

import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FUNCTIONS_DIR = 'supabase/functions';
const BASE = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const CONCURRENCY = 8;

// Wortlaut der Plattform-Antwort fuer eine nicht existierende Function.
const PLATFORM_NOT_FOUND = 'Requested function was not found';

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

function classify(status, body) {
  if (status === 404) {
    return body.includes(PLATFORM_NOT_FOUND) ? 'FEHLT' : 'ROUTET-404';
  }
  if (status >= 500) return 'PREFLIGHT-5XX';
  if (status === 401 || status === 403) return 'AUTH';
  if (status < 400) return 'OK';
  return `HTTP ${status}`;
}

async function probe(name) {
  const url = `${BASE}/functions/v1/${name}`;
  try {
    const res = await fetch(url, { method: 'OPTIONS' });
    // Nur bei 404 und 5xx noetig — sonst bleibt der Koerper ungelesen.
    const body = res.status === 404 || res.status >= 500 ? await res.text() : '';
    return { name, status: res.status, verdict: classify(res.status, body), body: body.slice(0, 120) };
  } catch (err) {
    return { name, status: 0, verdict: 'UNERREICHBAR', body: err.message };
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
  byVerdict.get(r.verdict).push(r);
}

for (const [verdict, entries] of [...byVerdict].sort()) {
  console.log(`\n${verdict} (${entries.length})`);
  for (const e of entries) console.log(`  ${e.name}`);
}

const broken = byVerdict.get('PREFLIGHT-5XX') ?? [];
const missing = byVerdict.get('FEHLT') ?? [];
const routed = byVerdict.get('ROUTET-404') ?? [];

console.log(
  `\n${results.length} geprueft · ${missing.length} nicht deployt · ` +
  `${routed.length} deployt ohne Handler auf dem Basispfad · ` +
  `${broken.length} mit Preflight-5xx`);

if (broken.length) {
  console.error('\nPreflight scheitert — aus dem Browser nicht aufrufbar:');
  for (const e of broken) console.error(`  - ${e.name}: ${e.status} ${e.body}`);
  process.exit(1);
}

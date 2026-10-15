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
// Exit 1, sobald eine Function PREFLIGHT-5XX, PREFLIGHT-CORS oder UNERREICHBAR
// liefert.
// Geschickt wird ein vollstaendiger Browser-Preflight (Origin, Request-Method,
// Request-Headers); SMOKE_ORIGIN ueberschreibt den Default-Origin.
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

// Ein echter Browser-Preflight, nicht ein nacktes OPTIONS: ohne Origin und
// Access-Control-Request-Method antworten manche Functions anders als auf den
// Request, den der Browser tatsaechlich schickt. Die Header-Liste entspricht
// dem, was supabase-js bei `functions.invoke` mitsendet.
const ORIGIN = process.env.SMOKE_ORIGIN || 'https://realsyncdynamicsai.de';
const REQUEST_HEADERS = ['authorization', 'x-client-info', 'apikey', 'content-type'];
const PREFLIGHT_HEADERS = {
  Origin: ORIGIN,
  'Access-Control-Request-Method': 'POST',
  'Access-Control-Request-Headers': REQUEST_HEADERS.join(', '),
};

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

// Ein 2xx auf den Preflight reicht dem Browser nicht: ohne passenden
// Access-Control-Allow-Origin verwirft er die Antwort, und ohne freigegebene
// Header scheitert der Folgeaufruf an `apikey` oder `x-client-info`.
//
// Zwei Faelle sind bewusst KEIN Fehler, weil eine naive Pruefung hier
// Fehlalarme liefert:
// - Gar kein CORS-Header: Webhooks und Crons (telegram-webhook,
//   whatsapp-webhook, ...) werden nie aus dem Browser gerufen. Das Urteil heisst
//   KEIN-CORS und ist ein Hinweis, kein Abbruch.
// - Allow-Methods ohne POST: eine Function, die nur GET deklariert, beschreibt
//   sich selbst korrekt. Die Methode wird deshalb nicht geprueft.
//
// Als Fehler gilt nur, was erkennbar auf Browser-Zugriff angelegt ist und
// trotzdem scheitert: Allow-Origin gesetzt, aber falsch, oder Header aus dem
// Satz `authorization, x-client-info, apikey, content-type` fehlen. Das ist
// genau der Satz, den supabase-js bei `functions.invoke` sendet und den
// `_shared/gateway.ts` als Standard setzt.
function corsGap(headers) {
  const origin = headers.get('access-control-allow-origin');
  if (!origin) return { verdict: 'KEIN-CORS', detail: 'keine CORS-Header (Server-zu-Server?)' };
  if (origin !== '*' && origin !== ORIGIN) {
    return { verdict: 'PREFLIGHT-CORS', detail: `Access-Control-Allow-Origin ist "${origin}"` };
  }
  // Ein `*` in Allow-Headers deckt laut Fetch-Spec alles ab — ausser
  // `authorization`. Das muss immer ausdruecklich genannt sein.
  const list = (headers.get('access-control-allow-headers') || '').toLowerCase().split(/\s*,\s*/);
  const wildcard = list.includes('*');
  const missing = REQUEST_HEADERS.filter(
    (h) => !list.includes(h) && (h === 'authorization' || !wildcard),
  );
  if (missing.length) {
    return { verdict: 'PREFLIGHT-CORS', detail: `Access-Control-Allow-Headers ohne ${missing.join(', ')}` };
  }
  return null;
}

function classify(status, body, gap) {
  if (status === 404) {
    return body.includes(PLATFORM_NOT_FOUND) ? 'FEHLT' : 'ROUTET-404';
  }
  if (status >= 500) return 'PREFLIGHT-5XX';
  if (status === 401 || status === 403) return 'AUTH';
  if (status < 400) return gap ? gap.verdict : 'OK';
  return `HTTP ${status}`;
}

async function probe(name) {
  const url = `${BASE}/functions/v1/${name}`;
  try {
    const res = await fetch(url, { method: 'OPTIONS', headers: PREFLIGHT_HEADERS });
    // Nur bei 404 und 5xx noetig — sonst bleibt der Koerper ungelesen.
    const body = res.status === 404 || res.status >= 500 ? await res.text() : '';
    const gap = res.status < 400 ? corsGap(res.headers) : null;
    const verdict = classify(res.status, body, gap);
    return { name, status: res.status, verdict, body: (gap?.detail ?? body).slice(0, 120) };
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

// UNERREICHBAR zaehlt mit: ein Netz- oder DNS-Fehler darf nicht als gruen
// durchgehen, sonst meldet ein Lauf ohne jede Antwort Erfolg.
const broken = [
  ...(byVerdict.get('PREFLIGHT-5XX') ?? []),
  ...(byVerdict.get('PREFLIGHT-CORS') ?? []),
  ...(byVerdict.get('UNERREICHBAR') ?? []),
];
const missing = byVerdict.get('FEHLT') ?? [];
const routed = byVerdict.get('ROUTET-404') ?? [];

console.log(
  `\n${results.length} geprueft · ${missing.length} nicht deployt · ` +
  `${routed.length} deployt ohne Handler auf dem Basispfad · ` +
  `${(byVerdict.get('PREFLIGHT-5XX') ?? []).length} mit Preflight-5xx · ` +
  `${(byVerdict.get('PREFLIGHT-CORS') ?? []).length} mit unvollstaendigen CORS-Headern · ` +
  `${(byVerdict.get('KEIN-CORS') ?? []).length} ohne CORS (Hinweis) · ` +
  `${(byVerdict.get('UNERREICHBAR') ?? []).length} unerreichbar`);

if (broken.length) {
  console.error('\nPreflight scheitert oder keine Antwort — aus dem Browser nicht aufrufbar:');
  for (const e of broken) console.error(`  - ${e.name}: ${e.status} ${e.body}`);
  process.exit(1);
}

#!/usr/bin/env node
// Migrations-Drift-Guard.
//
// Verhindert die Wiederholung des Vorfalls vom 2026-05-28
// (docs/runtime/SYSTEMCHECK-2026-05-28.md): Migrationen, die direkt auf die
// Prod-DB gepusht, aber nie ins Repo committet wurden ("remote migration
// versions not found in local migrations directory" → blockiert db push).
//
// Vergleicht die REMOTE-Migrations-History (`supabase migration list --linked`)
// mit den Repo-Dateien und FAILT, sobald eine Remote-Version keine Repo-Datei
// hat (ausser den bewusst gepflegten Legacy-Bootstrap-Dateien).
//
// RICHTUNG 2 (ergaenzt 2026-08-02): der umgekehrte Fall — Repo-Migration, die
// nie auf der Prod-DB angewendet wurde. Genau der blieb bisher unsichtbar:
// 118 von 243 Migrationen hatten die Produktion nie erreicht, weil `db push`
// an Richtung 1 abbrach, und dieser Guard schaute nur in Richtung 1.
// Siehe DEBUG_ROOT_CAUSE_2026-08-02.md.
//
// Richtung 2 ist ALTERSBASIERT und dadurch PR-sicher: eine frisch im PR
// hinzugefuegte Migration ist naturgemaess noch nicht angewendet und wird
// nicht bemaengelt. Erst wenn eine Migration seit MAX_UNAPPLIED_AGE_DAYS im
// Repo liegt und immer noch fehlt, ist das echter Drift.
//
// Ohne SUPABASE_ACCESS_TOKEN/PROJECT_ID (z. B. Fork-PRs) wird sauber
// uebersprungen (Exit 0). CLI-/Infra-Fehler failen NICHT hart (≠ Drift).

import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Bewusste Bootstrap-Migrationen mit Legacy-Namensschema — Quelle der Wahrheit:
// scripts/pre-deploy-lint.mjs (LEGACY_FILENAME_ALLOWLIST).
const LEGACY_VERSIONS = new Set(['00001', '20260510']);

// Karenzzeit fuer Richtung 2. Deckt normale Review-/Merge-Zyklen ab, ohne
// monatelangen Drift durchgehen zu lassen.
const MAX_UNAPPLIED_AGE_DAYS = Number(process.env.MAX_UNAPPLIED_AGE_DAYS ?? 7);

if (!process.env.SUPABASE_ACCESS_TOKEN || !process.env.SUPABASE_PROJECT_ID) {
  console.log('ℹ️  Migrations-Drift-Check uebersprungen (keine Supabase-Secrets).');
  process.exit(0);
}

let out = '';
try {
  out = execSync('supabase migration list --linked', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  // Infra-/CLI-Problem ist kein Drift → nicht hart failen, nur melden.
  console.error('⚠️  `supabase migration list` nicht ausfuehrbar:', e.message);
  process.exit(0);
}
console.log(out);

// Tabellen-Output: "LOCAL | REMOTE | TIME". Remote-only = LOCAL leer, REMOTE gesetzt.
const remoteOnly = [];
for (const line of out.split('\n')) {
  if (!line.includes('|')) continue;
  const cols = line.split('|').map((c) => c.trim());
  if (cols.length < 2) continue;
  const local = cols[0];
  const remote = cols[1];
  if (/^local$/i.test(local) || /^-+$/.test(local)) continue; // Header/Separator
  if (!local && /^[0-9]+$/.test(remote) && !LEGACY_VERSIONS.has(remote)) {
    remoteOnly.push(remote);
  }
}

// ── Richtung 2: Repo-Migrationen, die die Prod-DB nie erreicht haben ──
// Die Remote-Spalte des CLI-Outputs ist die Menge der tatsaechlich
// angewendeten Versionen. Alles im Repo, was dort fehlt, ist offen.
const remoteApplied = new Set();
for (const line of out.split('\n')) {
  if (!line.includes('|')) continue;
  const cols = line.split('|').map((c) => c.trim());
  if (cols.length < 2) continue;
  if (/^local$/i.test(cols[0]) || /^-+$/.test(cols[0])) continue;
  if (/^[0-9]+$/.test(cols[1])) remoteApplied.add(cols[1]);
}

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'supabase',
  'migrations',
);

/** `20260723000000_foo.sql` → Date. Nur 14-stellige Zeitstempel sind datierbar. */
function versionToDate(version) {
  if (!/^\d{14}$/.test(version)) return null;
  const [y, mo, d, h, mi, s] = [
    version.slice(0, 4), version.slice(4, 6), version.slice(6, 8),
    version.slice(8, 10), version.slice(10, 12), version.slice(12, 14),
  ].map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const now = Date.now();
const staleUnapplied = [];
let unappliedRecent = 0;

for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
  if (!file.endsWith('.sql')) continue;
  const version = file.split('_')[0].replace(/\.sql$/, '');
  if (remoteApplied.has(version) || LEGACY_VERSIONS.has(version)) continue;

  const dt = versionToDate(version);
  // Nicht datierbare Versionen konservativ als „frisch" behandeln — lieber
  // still als ein Fehlalarm, der die Pipeline blockiert.
  if (!dt) { unappliedRecent++; continue; }

  const ageDays = (now - dt.getTime()) / 86_400_000;
  if (ageDays > MAX_UNAPPLIED_AGE_DAYS) {
    staleUnapplied.push({ version, file, ageDays: Math.floor(ageDays) });
  } else {
    unappliedRecent++;
  }
}

let failed = false;

if (remoteOnly.length > 0) {
  failed = true;
  console.error('\n❌ Migrations-Drift (Richtung 1): Remote-Versionen OHNE Repo-Datei:');
  for (const v of remoteOnly) console.error(`   - ${v}`);
  console.error(
    '\nUrsache: jemand hat direkt auf die DB gepusht, ohne die Migration zu committen.\n' +
    'Fix: Quelle ins Repo committen ODER bewusst `supabase migration repair --status reverted <version>`.\n' +
    'Achtung: solange das offen ist, bricht `supabase db push` komplett ab — dann\n' +
    'erreicht AUCH KEINE andere Migration mehr die Produktion.',
  );
}

if (staleUnapplied.length > 0) {
  failed = true;
  console.error(
    `\n❌ Migrations-Drift (Richtung 2): ${staleUnapplied.length} Repo-Migration(en) seit mehr als ` +
    `${MAX_UNAPPLIED_AGE_DAYS} Tagen NICHT auf der Prod-DB angewendet:`,
  );
  for (const m of staleUnapplied.slice(0, 20)) {
    console.error(`   - ${m.file}  (${m.ageDays} Tage offen)`);
  }
  if (staleUnapplied.length > 20) {
    console.error(`   … und ${staleUnapplied.length - 20} weitere.`);
  }
  console.error(
    '\nUrsache: der Deploy-Pfad laeuft nicht durch (haeufig Richtung-1-Drift oben,\n' +
    'oder ein fehlgeschlagener `Deploy`-Workflow). Die Tabellen dieser Migrationen\n' +
    'existieren in Produktion NICHT — Frontend-Queries darauf liefern HTTP 404\n' +
    '(PostgREST `PGRST205`), die UI bleibt still leer.\n' +
    'Fix: Deploy-Workflow reparieren und `supabase db push` sauber durchlaufen lassen.',
  );
}

if (failed) process.exit(1);

if (unappliedRecent > 0) {
  console.log(
    `ℹ️  ${unappliedRecent} Repo-Migration(en) noch nicht angewendet, aber juenger als ` +
    `${MAX_UNAPPLIED_AGE_DAYS} Tage — im Rahmen (frisch gemergt/in Review).`,
  );
}
console.log('✅ Kein Migrations-Drift in beide Richtungen.');

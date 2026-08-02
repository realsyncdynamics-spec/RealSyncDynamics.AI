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
// Ohne SUPABASE_ACCESS_TOKEN/PROJECT_ID (z. B. Fork-PRs) wird sauber
// uebersprungen (Exit 0). CLI-/Infra-Fehler failen NICHT hart (≠ Drift).

import { execSync } from 'node:child_process';

// Bewusste Bootstrap-Migrationen mit Legacy-Namensschema — Quelle der Wahrheit:
// scripts/pre-deploy-lint.mjs (LEGACY_FILENAME_ALLOWLIST).
const LEGACY_VERSIONS = new Set(['00001', '20260510']);

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
//
// ACHTUNG (Fix 2026-08-02): die CLI rahmt jede Zelle in Backticks —
//     ` `              | `20260720123711` | `2026-07-20 12:37:11`
// Die vorherige Fassung hat nur getrimmt. Dadurch war cols[0] die Zeichenkette
// "` `" (also truthy statt leer) und cols[1] "`20260720123711`" (scheitert an
// /^[0-9]+$/). Beide Bedingungen konnten nie gleichzeitig zutreffen, der Guard
// hat also IMMER gruen gemeldet — auch am 2026-08-01, als echter Drift in
// seiner eigenen Ausgabe stand. Zellen daher erst entkleiden, dann pruefen.
const strip = (c) => c.replace(/`/g, '').trim();

const remoteOnly = [];
for (const line of out.split('\n')) {
  if (!line.includes('|')) continue;
  const cols = line.split('|').map(strip);
  if (cols.length < 2) continue;
  const local = cols[0];
  const remote = cols[1];
  if (/^local$/i.test(local) || /^-+$/.test(local)) continue; // Header/Separator
  if (!local && /^[0-9]+$/.test(remote) && !LEGACY_VERSIONS.has(remote)) {
    remoteOnly.push(remote);
  }
}

// Wenn keine einzige Datenzeile geparst wurde, hat sich das Ausgabeformat
// vermutlich erneut geaendert. Still gruen zu melden waere genau der Fehler
// von oben — deshalb hart failen statt so zu tun, als sei alles geprueft.
const parsedRows = out
  .split('\n')
  .filter((l) => l.includes('|'))
  .map((l) => l.split('|').map(strip))
  .filter((c) => c.length >= 2 && (/^[0-9]+$/.test(c[0]) || /^[0-9]+$/.test(c[1])));

if (parsedRows.length === 0) {
  console.error(
    '\n❌ Migrations-Drift-Check: keine einzige Versionszeile erkannt.\n' +
    'Das Ausgabeformat von `supabase migration list` hat sich vermutlich geaendert.\n' +
    'Nicht als "kein Drift" werten — Parser in scripts/check-migration-drift.mjs pruefen.',
  );
  process.exit(1);
}

if (remoteOnly.length > 0) {
  console.error('\n❌ Migrations-Drift: Remote-Versionen OHNE Repo-Datei:');
  for (const v of remoteOnly) console.error(`   - ${v}`);
  console.error(
    '\nUrsache: jemand hat direkt auf die DB gepusht, ohne die Migration zu committen.\n' +
    'Fix: Quelle ins Repo committen ODER bewusst `supabase migration repair --status reverted <version>`.',
  );
  process.exit(1);
}
console.log('✅ Kein Migrations-Drift — alle Remote-Versionen haben eine Repo-Datei (oder sind Legacy-allowlisted).');

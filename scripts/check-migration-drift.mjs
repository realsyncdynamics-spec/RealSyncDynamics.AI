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

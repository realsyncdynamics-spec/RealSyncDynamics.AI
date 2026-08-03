#!/usr/bin/env node
/**
 * Erzeugt den Deno-Zwilling der Pricing-SSoT für Supabase Edge Functions.
 *
 * Warum ein generiertes Duplikat statt eines Imports?
 *   `supabase functions deploy` bündelt ausschließlich den Inhalt von
 *   `supabase/functions/`. Ein relativer Import nach `../../shared/` würde
 *   lokal funktionieren, aber im Deploy fehlschlagen. Statt das Risiko
 *   einzugehen, wird die Datei generiert — und ein Drift-Test erzwingt,
 *   dass sie byte-identisch zur Quelle bleibt.
 *
 * Voraussetzung dafür ist, dass `shared/pricing.ts` KEINE Imports und keine
 * plattformspezifischen Globals enthält. Dieses Skript prüft das mit.
 *
 * Aufruf:  npm run sync:pricing
 * Prüfung: npm run sync:pricing -- --check   (exit 1 bei Drift)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SOURCE = join(ROOT, 'shared', 'pricing.ts');
const TARGET = join(ROOT, 'supabase', 'functions', '_shared', 'pricing.generated.ts');

export const BANNER = `// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  AUTOMATISCH GENERIERT — NICHT BEARBEITEN                             ║
// ║                                                                       ║
// ║  Quelle:    shared/pricing.ts                                         ║
// ║  Generator: scripts/sync-shared-pricing.mjs  (npm run sync:pricing)   ║
// ║                                                                       ║
// ║  Änderungen ausschließlich in shared/pricing.ts vornehmen und danach  ║
// ║  \`npm run sync:pricing\` ausführen. Der Drift-Test in                  ║
// ║  test/config/pricing-ssot.test.ts schlägt sonst fehl.                 ║
// ╚═══════════════════════════════════════════════════════════════════════╝

`;

/**
 * Entfernt Block- und Zeilenkommentare, damit die Portabilitätsprüfung
 * echten Code bewertet und nicht die Doku, die genau diese Verbote
 * beschreibt.
 */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Stellt sicher, dass die Quelle Deno-tauglich ist: keine Imports, keine
 * Node-/Browser-Globals. Sonst bricht der Edge-Function-Deploy erst zur
 * Laufzeit — hier bricht er sofort.
 */
export function assertPortable(rawSource) {
  const source = stripComments(rawSource);
  const problems = [];

  const importLine = source.match(/^\s*import\s.+$/m);
  if (importLine) problems.push(`Import gefunden: ${importLine[0].trim()}`);

  const requireCall = source.match(/\brequire\s*\(/);
  if (requireCall) problems.push('CommonJS require() gefunden');

  for (const forbidden of ['import.meta.env', 'process.env', 'window.', 'document.', 'localStorage']) {
    if (source.includes(forbidden)) problems.push(`Plattform-Global gefunden: ${forbidden}`);
  }

  if (problems.length > 0) {
    throw new Error(
      `shared/pricing.ts ist nicht portabel:\n  - ${problems.join('\n  - ')}\n` +
      'Die SSoT muss in Browser, Node und Deno unverändert laufen.',
    );
  }
}

export function buildGenerated(source) {
  assertPortable(source);
  return BANNER + source;
}

function main() {
  const check = process.argv.includes('--check');
  const source = readFileSync(SOURCE, 'utf8');
  const expected = buildGenerated(source);

  if (check) {
    let actual = '';
    try {
      actual = readFileSync(TARGET, 'utf8');
    } catch {
      console.error('✗ pricing.generated.ts fehlt — `npm run sync:pricing` ausführen.');
      process.exit(1);
    }
    if (actual !== expected) {
      console.error('✗ pricing.generated.ts weicht von shared/pricing.ts ab — `npm run sync:pricing` ausführen.');
      process.exit(1);
    }
    console.log('✓ pricing.generated.ts ist synchron mit shared/pricing.ts');
    return;
  }

  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, expected, 'utf8');
  console.log(`✓ ${TARGET.replace(ROOT + '/', '')} aus shared/pricing.ts erzeugt`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

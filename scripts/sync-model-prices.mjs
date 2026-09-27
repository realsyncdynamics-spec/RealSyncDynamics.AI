#!/usr/bin/env node
/**
 * Erzeugt den Deno-Zwilling der Einkaufspreis-SSoT für Supabase Edge Functions.
 *
 *   npm run sync:model-prices
 *   npm run check:model-prices   (exit 1 bei Drift)
 *
 * Gleiches Verfahren wie `scripts/sync-shared-pricing.mjs` für die
 * Verkaufspreise — bewusst dasselbe Muster statt eines zweiten. Die
 * Portabilitätsprüfung wird von dort importiert, damit es nur eine Definition
 * davon gibt, was „Deno-tauglich" heißt.
 *
 * Warum überhaupt ein generiertes Duplikat: `supabase functions deploy`
 * bündelt ausschließlich den Inhalt von `supabase/functions/`. Ein relativer
 * Import nach `../../shared/` funktioniert lokal und bricht im Deploy.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './sync-shared-pricing.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SOURCE = join(ROOT, 'shared', 'model-prices.ts');
const TARGET = join(ROOT, 'supabase', 'functions', '_shared', 'modelPrices.generated.ts');

export const BANNER = `// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  AUTOMATISCH GENERIERT — NICHT BEARBEITEN                             ║
// ║                                                                       ║
// ║  Quelle:    shared/model-prices.ts                                    ║
// ║  Generator: scripts/sync-model-prices.mjs (npm run sync:model-prices) ║
// ║                                                                       ║
// ║  Änderungen ausschließlich in shared/model-prices.ts vornehmen und    ║
// ║  danach \`npm run sync:model-prices\` ausführen. Der Drift-Test in      ║
// ║  test/config/model-prices-ssot.test.ts schlägt sonst fehl.            ║
// ╚═══════════════════════════════════════════════════════════════════════╝

`;

/**
 * Wie `assertPortable` in sync-shared-pricing.mjs, aber mit dem richtigen
 * Dateinamen in der Fehlermeldung — eine falsche Datei in einer Fehlermeldung
 * kostet beim Debuggen mehr, als diese acht Zeilen wert sind.
 */
export function assertPortable(rawSource) {
  const source = stripComments(rawSource);
  const problems = [];

  const importLine = source.match(/^\s*import\s.+$/m);
  if (importLine) problems.push(`Import gefunden: ${importLine[0].trim()}`);

  if (/\brequire\s*\(/.test(source)) problems.push('CommonJS require() gefunden');

  for (const forbidden of ['import.meta.env', 'process.env', 'window.', 'document.', 'localStorage']) {
    if (source.includes(forbidden)) problems.push(`Plattform-Global gefunden: ${forbidden}`);
  }

  if (problems.length > 0) {
    throw new Error(
      `shared/model-prices.ts ist nicht portabel:\n  - ${problems.join('\n  - ')}\n` +
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
      console.error('✗ modelPrices.generated.ts fehlt — `npm run sync:model-prices` ausführen.');
      process.exit(1);
    }
    if (actual !== expected) {
      console.error('✗ modelPrices.generated.ts weicht von shared/model-prices.ts ab — `npm run sync:model-prices` ausführen.');
      process.exit(1);
    }
    console.log('✓ modelPrices.generated.ts ist synchron mit shared/model-prices.ts');
    return;
  }

  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, expected, 'utf8');
  console.log(`✓ ${TARGET.replace(ROOT + '/', '')} aus shared/model-prices.ts erzeugt`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

#!/usr/bin/env tsx
/**
 * Erzeugt den SQL-Seed von `public.ai_model_prices` aus der Einkaufspreis-SSoT.
 *
 * Dasselbe Verfahren wie `generate-plan-catalog-sql.ts` für die Verkaufspreise,
 * bewusst kein zweites Muster:
 *
 *   Migrationen sind unveränderlich, sobald sie deployt sind. Die Tabelle muss
 *   aber exakt `shared/model-prices.ts` entsprechen. Dieses Skript erzeugt den
 *   Seed-Block, und die NEUESTE Migration auf `*_canonical_model_prices.sql` muss ihn
 *   wortgleich enthalten. Ändert sich ein Preis, ist eine neue Migration mit
 *   demselben Suffix fällig — eine bestehende wird nie editiert.
 *
 * Verwendung:
 *   npx tsx scripts/generate-model-prices-sql.ts          → nach stdout
 *   npx tsx scripts/generate-model-prices-sql.ts --check  → vergleicht gegen
 *       die neueste *_canonical_model_prices.sql (wird selbst gefunden)
 *
 * Ein Unterschied zum Plan-Katalog ist Absicht: der Katalog überschreibt per
 * ON CONFLICT DO UPDATE, dieser Block tut das NICHT. Ein Einkaufspreis hat eine
 * Geltungsdauer — ein bereits verbuchter Lauf muss zu dem Preis bewertbar
 * bleiben, der damals galt. Deshalb wird eine geänderte Zeile geschlossen
 * (`valid_to`) und eine neue eröffnet, statt die alte zu überschreiben.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL_PRICES, type ModelPrice } from '../shared/model-prices';

const BEGIN = '-- >>> GENERATED MODEL PRICES (scripts/generate-model-prices-sql.ts) >>>';
const END = '-- <<< GENERATED MODEL PRICES <<<';

/** Suffix der Migrationen, die diesen Block tragen. */
export const MIGRATION_SUFFIX = '_canonical_model_prices.sql';

/** Spaltenliste für jsonb_to_recordset — einmal definiert, zweimal benutzt. */
const RECORD_COLUMNS =
  'provider text, model_id text, input_per_million_usd numeric, output_per_million_usd numeric, ' +
  'cache_write_per_million_usd numeric, cache_read_per_million_usd numeric, source text';

/**
 * Preis als numeric(10,4)-Literal. `toFixed` statt String(), damit 10 und
 * 10.0 nicht als zwei verschiedene Blöcke gelten.
 */
function price(value: number | null, label: string): string {
  if (value === null) return 'null';
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label}: ungültiger Preis ${value}`);
  }
  return value.toFixed(4);
}

function row(p: ModelPrice): string {
  const label = `${p.provider}/${p.modelId}`;
  // Handgebautes JSON statt JSON.stringify, damit die Preise als numerische
  // Literale mit fester Stellenzahl im Block stehen und lesbar bleiben.
  return (
    '    {' +
    `"provider": ${JSON.stringify(p.provider)}, ` +
    `"model_id": ${JSON.stringify(p.modelId)}, ` +
    `"input_per_million_usd": ${price(p.inputPerMillionUsd, label)}, ` +
    `"output_per_million_usd": ${price(p.outputPerMillionUsd, label)}, ` +
    `"cache_write_per_million_usd": ${price(p.cacheWritePerMillionUsd, label)}, ` +
    `"cache_read_per_million_usd": ${price(p.cacheReadPerMillionUsd, label)}, ` +
    `"source": ${JSON.stringify(p.source)}` +
    '}'
  );
}

export function buildModelPricesSql(prices: readonly ModelPrice[] = MODEL_PRICES): string {
  const data = prices.map(row).join(',\n');
  // Der Block steht in $$…$$ und die Daten in $json$…$json$. Ein Dollar-Tag in
  // einem Wert würde das Quoting sprengen — lieber hier laut scheitern.
  if (data.includes('$')) {
    throw new Error('shared/model-prices.ts enthält ein "$" in einem Wert — im Seed-Block nicht zulässig.');
  }

  const lines: string[] = [];
  lines.push(BEGIN);
  lines.push('-- NICHT VON HAND BEARBEITEN. Quelle: shared/model-prices.ts');
  lines.push('--');
  lines.push('-- Historie statt Überschreiben: eine offene Zeile, deren Preis nicht mehr');
  lines.push('-- der Quelle entspricht (oder deren Modell aus der Quelle verschwunden ist),');
  lines.push('-- wird geschlossen; danach wird für jedes Modell ohne offene Zeile eine');
  lines.push('-- neue eröffnet. Unveränderte Zeilen bleiben unberührt — der Block ist');
  lines.push('-- wiederholbar.');
  lines.push('--');
  lines.push('-- Ein DO-Block statt zweier loser Anweisungen, damit Schließen und Eröffnen');
  lines.push('-- auch ohne umschließende Transaktion atomar sind: dazwischen verlangt der');
  lines.push('-- Index ai_model_prices_one_current höchstens eine offene Zeile je Modell.');
  lines.push('-- `ts` ist clock_timestamp(), nicht now(): so bleiben valid_to des alten und');
  lines.push('-- valid_from des neuen Preises lückenlos gleich, und zwei Seed-Migrationen');
  lines.push('-- in derselben Transaktion bekommen trotzdem verschiedene Zeitpunkte.');
  lines.push('DO $$');
  lines.push('DECLARE');
  lines.push('  ts  CONSTANT timestamptz := clock_timestamp();');
  lines.push('  src CONSTANT jsonb := $json$[');
  lines.push(data);
  lines.push('  ]$json$;');
  lines.push('BEGIN');
  lines.push('  UPDATE public.ai_model_prices p');
  lines.push('     SET valid_to = ts, updated_at = ts');
  lines.push('   WHERE p.valid_to IS NULL');
  lines.push('     AND NOT EXISTS (');
  lines.push(`       SELECT 1 FROM jsonb_to_recordset(src) AS s(${RECORD_COLUMNS})`);
  lines.push('        WHERE s.provider = p.provider');
  lines.push('          AND s.model_id = p.model_id');
  lines.push('          AND s.input_per_million_usd  = p.input_per_million_usd');
  lines.push('          AND s.output_per_million_usd = p.output_per_million_usd');
  lines.push('          AND s.cache_write_per_million_usd IS NOT DISTINCT FROM p.cache_write_per_million_usd');
  lines.push('          AND s.cache_read_per_million_usd  IS NOT DISTINCT FROM p.cache_read_per_million_usd');
  lines.push('          AND s.source = p.source);');
  lines.push('');
  lines.push('  INSERT INTO public.ai_model_prices (');
  lines.push('    provider, model_id, input_per_million_usd, output_per_million_usd,');
  lines.push('    cache_write_per_million_usd, cache_read_per_million_usd, source, valid_from, updated_at');
  lines.push('  )');
  lines.push('  SELECT s.provider, s.model_id, s.input_per_million_usd, s.output_per_million_usd,');
  lines.push('         s.cache_write_per_million_usd, s.cache_read_per_million_usd, s.source, ts, ts');
  lines.push(`    FROM jsonb_to_recordset(src) AS s(${RECORD_COLUMNS})`);
  lines.push('   WHERE NOT EXISTS (');
  lines.push('     SELECT 1 FROM public.ai_model_prices p');
  lines.push('      WHERE p.provider = s.provider AND p.model_id = s.model_id AND p.valid_to IS NULL);');
  lines.push('END');
  lines.push('$$;');
  lines.push(END);
  return lines.join('\n');
}

/**
 * Findet die aktuelle Seed-Migration. Bei mehreren gewinnt die mit dem höchsten
 * Zeitstempel — die zuletzt erzeugte ist die, die den gültigen Stand trägt.
 */
export function findModelPricesMigration(): string | null {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
  const match = readdirSync(dir)
    .filter((f) => f.endsWith(MIGRATION_SUFFIX))
    .sort()
    .pop();
  return match ? join(dir, match) : null;
}

function main() {
  const sql = buildModelPricesSql();

  if (process.argv.includes('--check')) {
    const file = findModelPricesMigration();
    if (!file) {
      console.error(`✗ Keine *${MIGRATION_SUFFIX} unter supabase/migrations gefunden.`);
      process.exit(2);
    }
    if (!readFileSync(file, 'utf8').includes(sql)) {
      console.error(`✗ ${file} entspricht nicht mehr shared/model-prices.ts — neue *${MIGRATION_SUFFIX} erzeugen.`);
      process.exit(1);
    }
    console.log(`✓ ${file} ist synchron mit shared/model-prices.ts`);
    return;
  }

  process.stdout.write(sql + '\n');
}

if (process.argv[1]?.endsWith('generate-model-prices-sql.ts')) {
  main();
}

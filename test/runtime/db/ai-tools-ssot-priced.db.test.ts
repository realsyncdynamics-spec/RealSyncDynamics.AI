/**
 * Einkaufspreis-SSoT, Schritt D (Migration *_retire_ai_tools_cost_columns.sql).
 *
 * runAiTool fällt nicht mehr auf ai_tools.cost_* zurück: ohne Preis in
 * shared/model-prices.ts wirft es MODEL_PRICE_MISSING und das Tool läuft
 * nicht. Dieser Test hält deshalb jede ai_tools-Zeile, die das voll migrierte
 * Schema trägt, gegen die Autorenquelle — eine Migration, die ein Tool auf
 * ein Modell ohne SSoT-Preis setzt, wird hier rot statt erst in Produktion.
 *
 * Läuft nur mit gesetztem TEST_DB_URL; in CI setzt der db-Job die Variable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';
import { priceFor } from '../../../shared/model-prices';

const dbUrl = getDbUrl();
const mussLaufen = process.env.REQUIRE_DB_TESTS === '1';

if (!dbUrl && mussLaufen) {
  describe('ai_tools: SSoT-Preis je Tool', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}

const d = dbUrl ? describe : describe.skip;

d('ai_tools: SSoT-Preis je Tool', () => {
  let ctx: DbCtx | null = null;

  beforeEach(async () => {
    ctx = await openDb();
  });

  afterEach(async () => {
    if (ctx) await closeDb(ctx);
    ctx = null;
  });

  it('jedes Cloud-Tool hat einen Einkaufspreis in shared/model-prices.ts', async () => {
    // Auch deaktivierte Tools: ein UPDATE auf enabled = true darf kein Tool
    // freischalten, das dann mit MODEL_PRICE_MISSING scheitert.
    const { rows } = await ctx!.client.query<{ key: string; model_provider: string; model_id: string }>(
      `SELECT key, model_provider, model_id FROM public.ai_tools
        WHERE model_provider <> 'ollama' ORDER BY key`,
    );
    expect(rows.length).toBeGreaterThan(0);
    const ohnePreis = rows
      .filter((r) => priceFor(r.model_provider, r.model_id) === null)
      .map((r) => `${r.key}: ${r.model_provider}/${r.model_id}`);
    expect(ohnePreis).toEqual([]);
  });

  it('markiert beide Preisspalten als veraltet, ohne sie zu entfernen', async () => {
    const { rows } = await ctx!.client.query<{ column_name: string; is_nullable: string; comment: string | null }>(
      `SELECT c.column_name, c.is_nullable,
              col_description('public.ai_tools'::regclass, c.ordinal_position::int) AS comment
         FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'ai_tools'
          AND c.column_name IN ('cost_input_per_million_usd', 'cost_output_per_million_usd')
        ORDER BY c.column_name`,
    );
    expect(rows.map((r) => r.column_name)).toEqual([
      'cost_input_per_million_usd',
      'cost_output_per_million_usd',
    ]);
    for (const r of rows) {
      expect(r.comment, r.column_name).toMatch(/^VERALTET \(Schritt D\)/);
      // Bestehende INSERTs ohne die Spalten laufen weiter über den Default.
      expect(r.is_nullable, r.column_name).toBe('NO');
    }
  });
});

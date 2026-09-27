/**
 * Einkaufspreis-SSoT, Schritt B (Migration *_canonical_model_prices.sql).
 *
 * Geprüft wird gegen das voll migrierte Schema:
 *
 *   - Die Tabelle trägt genau die Preise aus shared/model-prices.ts — hier
 *     wird die Autorenquelle direkt gegen die Datenbank gehalten, nicht nur
 *     gegen den generierten Text.
 *   - Der generierte Seed-Block ist wiederholbar und bewahrt Historie: ein
 *     geänderter Preis schließt die alte Zeile und eröffnet lückenlos eine neue.
 *   - RLS: anon liest nichts und erreicht die View nicht, Eingeloggte lesen
 *     nur, schreiben kann nur service_role.
 *   - Schattenvergleich: keine ai_tools-Zeile widerspricht dem SSoT-Preis.
 *
 * Läuft nur mit gesetztem TEST_DB_URL; in CI setzt der db-Job die Variable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';
import { MODEL_PRICES } from '../../../shared/model-prices';
import { buildModelPricesSql } from '../../../scripts/generate-model-prices-sql';

const dbUrl = getDbUrl();
const mussLaufen = process.env.REQUIRE_DB_TESTS === '1';

if (!dbUrl && mussLaufen) {
  describe('ai_model_prices', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}

const d = dbUrl ? describe : describe.skip;

type Actor = 'anon' | 'authenticated' | 'service_role';
type Outcome = { kind: 'rows'; count: number } | { kind: 'deny' };

interface PriceRow extends Record<string, unknown> {
  provider: string;
  model_id: string;
  input_per_million_usd: string;
  output_per_million_usd: string;
  cache_write_per_million_usd: string | null;
  cache_read_per_million_usd: string | null;
  source: string;
  valid_from: Date;
  valid_to: Date | null;
}

d('ai_model_prices', () => {
  let ctx: DbCtx | null = null;

  async function q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return ctx!.client.query<T>(sql, params);
  }

  /**
   * Führt `sql` als `actor` in einem Savepoint aus und rollt zurück.
   * RLS-/Rechtefehler → deny; alles andere soll den Test rot machen.
   */
  async function attempt(actor: Actor, sql: string, params: unknown[] = []): Promise<Outcome> {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await q(`SAVEPOINT ${sp}`);
    try {
      const claims = actor === 'authenticated'
        ? { role: actor, sub: '00000000-0000-0000-0000-00000000a001' }
        : { role: actor };
      await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
      await q(`SET LOCAL ROLE ${actor}`);
      const res = await q(sql, params);
      return { kind: 'rows', count: res.rowCount ?? 0 };
    } catch (err) {
      if (/row-level security|permission denied/i.test(String((err as Error).message))) return { kind: 'deny' };
      throw err;
    } finally {
      await q(`ROLLBACK TO SAVEPOINT ${sp}`);
      await q(`RESET ROLE`);
    }
  }

  beforeEach(async () => {
    ctx = await openDb();
  });

  afterEach(async () => {
    if (ctx) await closeDb(ctx);
    ctx = null;
  });

  it('trägt für jedes Modell der Quelle genau eine gültige Zeile mit identischen Preisen', async () => {
    const { rows } = await q<PriceRow>(`SELECT * FROM public.ai_model_prices WHERE valid_to IS NULL`);
    expect(rows).toHaveLength(MODEL_PRICES.length);

    const nullable = (v: string | null) => (v === null ? null : Number(v));
    for (const p of MODEL_PRICES) {
      const row = rows.find((r) => r.provider === p.provider && r.model_id === p.modelId);
      expect(row, `${p.provider}/${p.modelId} fehlt`).toBeDefined();
      expect(Number(row!.input_per_million_usd), p.modelId).toBe(p.inputPerMillionUsd);
      expect(Number(row!.output_per_million_usd), p.modelId).toBe(p.outputPerMillionUsd);
      expect(nullable(row!.cache_write_per_million_usd), p.modelId).toBe(p.cacheWritePerMillionUsd);
      expect(nullable(row!.cache_read_per_million_usd), p.modelId).toBe(p.cacheReadPerMillionUsd);
      expect(row!.source, p.modelId).toBe(p.source);
    }
  });

  it('der Seed-Block ist wiederholbar: ein zweiter Lauf ändert nichts', async () => {
    const before = await q<{ n: string }>(`SELECT count(*) AS n FROM public.ai_model_prices`);
    await q(buildModelPricesSql());
    const after = await q<{ n: string; open: string }>(
      `SELECT count(*) AS n, count(*) FILTER (WHERE valid_to IS NULL) AS open FROM public.ai_model_prices`,
    );
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
    expect(Number(after.rows[0]!.open)).toBe(MODEL_PRICES.length);
  });

  it('ein geänderter Preis schließt die alte Zeile und eröffnet lückenlos eine neue', async () => {
    // Spätere Quelle: das erste Modell wird teurer, das letzte fällt heraus.
    // Aus der Quelle gewählt statt fest verdrahtet, damit eine echte
    // Preisänderung an einem der beiden diesen Test nicht bricht.
    expect(MODEL_PRICES.length).toBeGreaterThanOrEqual(2);
    const changed = MODEL_PRICES[0]!;
    const dropped = MODEL_PRICES[MODEL_PRICES.length - 1]!;

    const openBefore = async (m: (typeof MODEL_PRICES)[number]) =>
      (await q<PriceRow>(
        `SELECT * FROM public.ai_model_prices WHERE provider = $1 AND model_id = $2 AND valid_to IS NULL`,
        [m.provider, m.modelId],
      )).rows[0]!;
    const changedBefore = await openBefore(changed);
    const droppedBefore = await openBefore(dropped);

    const next = MODEL_PRICES
      .filter((p) => p !== dropped)
      .map((p) => (p === changed
        ? { ...p, inputPerMillionUsd: p.inputPerMillionUsd + 1, source: 'db-test' }
        : p));
    await q(buildModelPricesSql(next));

    // Nur die Zeilen ab dem bisher gültigen Preis — ältere Historie bleibt außen vor.
    const chain = await q<PriceRow>(
      `SELECT * FROM public.ai_model_prices
        WHERE provider = $1 AND model_id = $2 AND valid_from >= $3
        ORDER BY valid_from`,
      [changed.provider, changed.modelId, changedBefore.valid_from],
    );
    expect(chain.rows).toHaveLength(2);
    const [alt, neu] = chain.rows;
    expect(Number(alt!.input_per_million_usd)).toBe(changed.inputPerMillionUsd);
    expect(alt!.valid_to).not.toBeNull();
    expect(Number(neu!.input_per_million_usd)).toBe(changed.inputPerMillionUsd + 1);
    expect(neu!.source).toBe('db-test');
    expect(neu!.valid_to).toBeNull();
    // Halboffene Intervalle: das Ende des alten Preises ist exakt der Beginn
    // des neuen — keine Lücke, in der ein Lauf ohne Preis bliebe.
    expect(alt!.valid_to!.getTime()).toBe(neu!.valid_from.getTime());

    // Das entfernte Modell wird geschlossen, nicht gelöscht, und bekommt keinen Nachfolger.
    const droppedAfter = await q<PriceRow>(
      `SELECT * FROM public.ai_model_prices WHERE provider = $1 AND model_id = $2 AND valid_from >= $3`,
      [dropped.provider, dropped.modelId, droppedBefore.valid_from],
    );
    expect(droppedAfter.rows).toHaveLength(1);
    expect(droppedAfter.rows[0]!.valid_to).not.toBeNull();
  });

  it('erzwingt höchstens eine gültige Zeile je Modell', async () => {
    const p = MODEL_PRICES[0]!;
    await expect(q(
      `INSERT INTO public.ai_model_prices (provider, model_id, input_per_million_usd, output_per_million_usd, source)
       VALUES ($1, $2, 9, 9, 'db-test')`,
      [p.provider, p.modelId],
    )).rejects.toThrow(/ai_model_prices_one_current/);
  });

  describe('RLS', () => {
    const p = MODEL_PRICES[0]!;
    const insert = `INSERT INTO public.ai_model_prices (provider, model_id, input_per_million_usd, output_per_million_usd, source)
                    VALUES ('anthropic', 'x-db-test', 1, 1, 'db-test')`;
    const update = `UPDATE public.ai_model_prices SET input_per_million_usd = 0
                     WHERE provider = $1 AND model_id = $2 AND valid_to IS NULL`;
    const updateParams = [p.provider, p.modelId];
    // Gültige Zeilen, nicht alle: nach der ersten echten Preisänderung gibt
    // es mehr Zeilen als Modelle.
    const readCurrent = `SELECT 1 FROM public.ai_model_prices WHERE valid_to IS NULL`;

    it('anon liest keine Preise und erreicht die Vergleichs-View nicht', async () => {
      expect(await attempt('anon', readCurrent)).toEqual({ kind: 'rows', count: 0 });
      expect(await attempt('anon', `SELECT 1 FROM public.ai_tool_price_drift`)).toEqual({ kind: 'deny' });
      expect(await attempt('anon', insert)).toEqual({ kind: 'deny' });
    });

    it('Eingeloggte lesen, schreiben aber nicht', async () => {
      expect(await attempt('authenticated', readCurrent))
        .toEqual({ kind: 'rows', count: MODEL_PRICES.length });
      expect(await attempt('authenticated', insert)).toEqual({ kind: 'deny' });
      expect(await attempt('authenticated', update, updateParams)).toEqual({ kind: 'rows', count: 0 });
    });

    it('service_role schreibt', async () => {
      expect(await attempt('service_role', insert)).toEqual({ kind: 'rows', count: 1 });
      expect(await attempt('service_role', update, updateParams)).toEqual({ kind: 'rows', count: 1 });
    });
  });

  it('Schattenvergleich: keine ai_tools-Zeile widerspricht dem SSoT-Preis', async () => {
    const { rows } = await q<{ tool_key: string; model_id: string; status: string }>(
      `SELECT tool_key, model_id, status FROM public.ai_tool_price_drift ORDER BY tool_key`,
    );
    // Nicht leer vergleichen: bräche der Join, stünde alles auf no_ssot_price
    // und „kein mismatch" wäre trivial wahr.
    expect(rows.some((r) => r.status === 'match')).toBe(true);
    // no_ssot_price ist zulässig (etwa ein Tool eines Anbieters ohne SSoT-Zeile);
    // ein Widerspruch ist es nicht — genau so stand vps_status bis 20260919170000.
    expect(rows.filter((r) => r.status === 'mismatch')).toEqual([]);
  });
});

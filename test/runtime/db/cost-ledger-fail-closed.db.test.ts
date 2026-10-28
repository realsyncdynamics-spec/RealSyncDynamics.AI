/**
 * PR A2 — Altledger (tenant_cost_ledger) gibt Budget nicht ohne Nachweis frei.
 *
 * Migration: supabase/migrations/20261028170000_cost_ledger_fail_closed.sql
 *
 *   Abnahme 21  Abgelaufene Reservierungen werden geschätzt verbucht, nicht gelöscht.
 *   Abnahme 35  Token-Metering zählt denselben gemessenen Verbrauch wie vorher.
 *   Abnahme 36  Geschätzter Verbrauch erreicht das Stripe-Metering nicht.
 *   Test 9      Mandant ohne tenant_cost_caps verhält sich wie vor A2.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDb,
  createTenantWithMember,
  openDb,
  requireDbOrFail,
  type DbCtx,
} from './db-helpers';

const run = requireDbOrFail('cost-ledger-fail-closed');
const d = run ? describe : describe.skip;

const MIGRATIONS = join(__dirname, '../../../supabase/migrations');

/**
 * count_ai_tokens_by_tenant exakt aus der Migration laden, die
 * stripe-token-meter-sync speist — nicht nachbauen. Im minimalen Harnisch
 * fehlt sie, im voll migrierten Schema ist sie bereits vorhanden.
 */
async function ensureMeteringFn(ctx: DbCtx): Promise<void> {
  const exists = await ctx.client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'count_ai_tokens_by_tenant'`,
  );
  if (exists.rows[0]!.n > 0) return;
  const src = readFileSync(join(MIGRATIONS, '20260705100000_enable_ai_token_metering.sql'), 'utf8');
  const start = src.indexOf('CREATE OR REPLACE FUNCTION public.count_ai_tokens_by_tenant');
  const end = src.indexOf('LANGUAGE plpgsql IMMUTABLE;', start) + 'LANGUAGE plpgsql IMMUTABLE;'.length;
  await ctx.client.query(src.slice(start, end));
}

async function setCaps(ctx: DbCtx, tenantId: string, llmUsdMonthly: number): Promise<void> {
  await ctx.client.query(
    `INSERT INTO public.tenant_cost_caps (tenant_id, llm_usd_monthly, warn_threshold)
     VALUES ($1, $2, 0.8)
     ON CONFLICT (tenant_id) DO UPDATE SET llm_usd_monthly = EXCLUDED.llm_usd_monthly`,
    [tenantId, llmUsdMonthly],
  );
}

function svc<T>(ctx: DbCtx, fn: () => Promise<T>): Promise<T> {
  return ctx.withClaims({ role: 'service_role' }, fn);
}

async function reserve(ctx: DbCtx, tenantId: string, usd: number) {
  return svc(ctx, async () => (await ctx.client.query<{
    decision: string; reservation_id: string | null;
  }>(
    `SELECT * FROM public.cost_check_and_reserve(
        $1::uuid, 'llm_input', 1, $2::numeric,
        jsonb_build_object('agent_ref', 'a2-test'))`,
    [tenantId, usd],
  )).rows[0]!);
}

async function settle(ctx: DbCtx, rid: string, tokens: number, pricePerToken: number) {
  return svc(ctx, async () => (await ctx.client.query<{ id: string }>(
    `SELECT public.cost_writer_settle($1::uuid, 'llm_input', $2, $3) AS id`,
    [rid, tokens, pricePerToken],
  )).rows[0]!.id);
}

async function sweep(ctx: DbCtx): Promise<number> {
  return svc(ctx, async () => (await ctx.client.query<{ n: number }>(
    `SELECT public.cost_sweep_expired_reservations()::int AS n`,
  )).rows[0]!.n);
}

/** Eine abgelaufene, offene Reservierung über cost_check_and_reserve anlegen. */
async function expiredReservation(ctx: DbCtx, tenantId: string, usd: number): Promise<string> {
  const r = await reserve(ctx, tenantId, usd);
  expect(r.reservation_id).not.toBeNull();
  await ctx.client.query(
    `UPDATE public.tenant_cost_ledger SET expires_at = now() - INTERVAL '1 minute'
      WHERE reservation_id = $1`,
    [r.reservation_id],
  );
  return r.reservation_id!;
}

async function meteredTokens(ctx: DbCtx, tenantId: string): Promise<number> {
  const r = await ctx.client.query<{ n: string }>(
    `SELECT public.count_ai_tokens_by_tenant($1, to_char(date_trunc('month', now()), 'YYYY-MM-DD')) AS n`,
    [tenantId],
  );
  return Number(r.rows[0]!.n);
}

d('PR A2 / Sweep verbucht statt löscht (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); await ensureMeteringFn(ctx); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('abgelaufene Reservierung → llm_estimate/geschaetzt zum Höchstbetrag, nicht gelöscht', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const rid = await expiredReservation(ctx!, tenantId, 0.42);

    expect(await sweep(ctx!)).toBeGreaterThanOrEqual(1);

    const rows = await ctx!.client.query<{
      cost_kind: string; value_basis: string; settled: boolean; amount_usd: string;
    }>(
      `SELECT cost_kind, value_basis, settled, amount_usd
         FROM public.tenant_cost_ledger WHERE reservation_id = $1`,
      [rid],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]!.cost_kind).toBe('llm_estimate');
    expect(rows.rows[0]!.value_basis).toBe('geschaetzt');
    expect(rows.rows[0]!.settled).toBe(true);
    expect(Number(rows.rows[0]!.amount_usd)).toBeCloseTo(0.42, 6);

    const ev = await ctx!.client.query<{ booked_as: string }>(
      `SELECT payload->>'booked_as' AS booked_as FROM public.runtime_events
        WHERE tenant_id = $1 AND type = 'cost.reservation_expired'
          AND (payload->>'reservation_id')::uuid = $2`,
      [tenantId, rid],
    );
    expect(ev.rows[0]!.booked_as).toBe('geschaetzt');
  });

  it('Sweep zweimal → keine Doppelverbuchung', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const rid = await expiredReservation(ctx!, tenantId, 0.3);
    await sweep(ctx!);
    const second = await sweep(ctx!);
    expect(second).toBe(0);
    const sum = await ctx!.client.query<{ n: number; s: string }>(
      `SELECT count(*)::int AS n, sum(amount_usd) AS s
         FROM public.tenant_cost_ledger WHERE reservation_id = $1`,
      [rid],
    );
    expect(sum.rows[0]!.n).toBe(1);
    expect(Number(sum.rows[0]!.s)).toBeCloseTo(0.3, 6);
  });

  it('nicht abgelaufene offene Reservierung bleibt unberührt', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const r = await reserve(ctx!, tenantId, 0.1);
    await sweep(ctx!);
    const row = await ctx!.client.query<{ cost_kind: string; settled: boolean }>(
      `SELECT cost_kind, settled FROM public.tenant_cost_ledger WHERE reservation_id = $1`,
      [r.reservation_id],
    );
    expect(row.rows[0]!.cost_kind).toBe('reservation');
    expect(row.rows[0]!.settled).toBe(false);
  });

  it('geschätzter Betrag zählt gegen den LLM-Deckel', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await setCaps(ctx!, tenantId, 1);
    await expiredReservation(ctx!, tenantId, 0.9);
    await sweep(ctx!);
    const r = await reserve(ctx!, tenantId, 0.2);
    expect(r.decision).toBe('throttle');
  });
});

d('PR A2 / Korrektur nach geschätzter Verbuchung (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); await ensureMeteringFn(ctx); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('späte Abrechnung → Storno + gemessener Eintrag (korrigiert), Summe = gemessen', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const rid = await expiredReservation(ctx!, tenantId, 0.5);
    await sweep(ctx!);

    // gemessen: 8000 Tokens × 0.000003 USD = 0.024 USD
    await settle(ctx!, rid, 8000, 0.000003);

    const rows = await ctx!.client.query<{
      cost_kind: string; value_basis: string; units: string; amount_usd: string; corrects_id: string | null; id: string;
    }>(
      `SELECT id, cost_kind, value_basis, units, amount_usd, corrects_id
         FROM public.tenant_cost_ledger WHERE reservation_id = $1 ORDER BY id`,
      [rid],
    );
    expect(rows.rows).toHaveLength(3);
    const [est, storno, measured] = rows.rows;
    expect(est!.value_basis).toBe('geschaetzt');
    expect(storno!.cost_kind).toBe('llm_estimate');
    expect(storno!.value_basis).toBe('korrigiert');
    expect(storno!.corrects_id).toBe(est!.id);
    expect(measured!.cost_kind).toBe('llm_input');
    expect(measured!.value_basis).toBe('korrigiert');
    expect(measured!.corrects_id).toBe(est!.id);

    const total = rows.rows.reduce((s, r) => s + Number(r.amount_usd), 0);
    expect(total).toBeCloseTo(0.024, 6);
    expect(await meteredTokens(ctx!, tenantId)).toBe(8000);
  });

  it('zweite späte Abrechnung derselben Reservierung schlägt fehl', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const rid = await expiredReservation(ctx!, tenantId, 0.5);
    await sweep(ctx!);
    await settle(ctx!, rid, 100, 0.000001);
    await expect(settle(ctx!, rid, 100, 0.000001)).rejects.toThrow(/not found or already settled/);
  });

  it('normale Abrechnung vor Ablauf → gemessen, eine Zeile', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const r = await reserve(ctx!, tenantId, 0.05);
    await settle(ctx!, r.reservation_id!, 1000, 0.00001);
    const rows = await ctx!.client.query<{ value_basis: string; cost_kind: string }>(
      `SELECT value_basis, cost_kind FROM public.tenant_cost_ledger WHERE reservation_id = $1`,
      [r.reservation_id],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]!.value_basis).toBe('gemessen');
    expect(rows.rows[0]!.cost_kind).toBe('llm_input');
  });
});

d('PR A2 / Stripe-Token-Metering (Abnahme 35/36) (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); await ensureMeteringFn(ctx); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('identische Aufrufserie → Metering = Summe der gemessenen Tokens; Schätzungen zählen nicht', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);

    // Serie: drei normal abgerechnete Aufrufe …
    for (const tokens of [1200, 800, 3000]) {
      const r = await reserve(ctx!, tenantId, 0.05);
      await settle(ctx!, r.reservation_id!, tokens, 0.000003);
    }
    // … und zwei Aufrufe mit unklarem Ausgang, die der Sweep schätzt.
    await expiredReservation(ctx!, tenantId, 0.7);
    await expiredReservation(ctx!, tenantId, 0.7);
    await sweep(ctx!);

    expect(await meteredTokens(ctx!, tenantId)).toBe(5000);

    const est = await ctx!.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.tenant_cost_ledger
        WHERE tenant_id = $1 AND value_basis = 'geschaetzt'
          AND cost_kind IN ('llm_input','llm_output')`,
      [tenantId],
    );
    expect(est.rows[0]!.n).toBe(0);
  });
});

d('PR A2 / Mandant ohne Budgetkonfiguration (Test 9) (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('ohne tenant_cost_caps-Zeile → Vorgabedeckel 250 USD wie vor A2', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const r = await svc(ctx!, async () => (await ctx!.client.query<{ decision: string; cap_total: string }>(
      `SELECT decision, cap_total FROM public.cost_check_and_reserve(
          $1::uuid, 'llm_input', 1, 0.01, jsonb_build_object('agent_ref', 'a2-test'))`,
      [tenantId],
    )).rows[0]!);
    expect(r.decision).toBe('allow');
    expect(Number(r.cap_total)).toBe(250);
  });
});

describe('PR A2 / Migration ist additiv (statisch)', () => {
  const sql = readFileSync(join(MIGRATIONS, '20261028170000_cost_ledger_fail_closed.sql'), 'utf8');
  // Funktionsrümpfe ausblenden; geprüft wird nur, was die Migration selbst ausführt.
  const topLevel = sql.replace(/AS \$\$[\s\S]*?\$\$;/g, '');

  it('schreibt keine bestehenden Zeilen um und löscht nichts', () => {
    expect(topLevel).not.toMatch(/^\s*(UPDATE|DELETE|TRUNCATE)\b/im);
    expect(topLevel).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });

  it('neue Spalten ohne Default (Bestandszeilen bleiben NULL)', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS value_basis TEXT,/);
    expect(sql).not.toMatch(/value_basis TEXT[^,\n]*DEFAULT/i);
  });

  it('Metering-Funktion und stripe-token-meter-sync bleiben unberührt', () => {
    expect(sql).not.toMatch(/FUNCTION\s+public\.count_ai_tokens_by_tenant/i);
  });
});

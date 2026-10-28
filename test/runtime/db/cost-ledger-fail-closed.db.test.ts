/**
 * PR A2 fix/cost-ledger-fail-closed — Altledger (tenant_cost_ledger)
 *
 * Auftrag A2 §3:
 *   Test 1  Abgelaufene Reservierung ohne Abrechnung → 'geschaetzt' zum
 *           Höchstbetrag verbucht, nicht gelöscht.
 *   Test 2  Spätere Abrechnung → Einträge 'korrigiert' mit Bezug; Summe =
 *           gemessener Wert, keine Doppelzählung; zweites Settle scheitert.
 *   Test 3  Sweep zweimal → keine Doppelverbuchung.
 *   Test 6  Bestehende Zeilen bleiben bei (erneuter) Anwendung der Migration
 *           unverändert; die Migration schreibt keine Bestandszeile um.
 *   Test 7  Metering: count_ai_tokens_by_tenant (Leser von
 *           stripe-token-meter-sync) zählt nur gemessene Tokens, nie Schätzungen.
 *   Test 9  Mandant ohne tenant_cost_caps → Verhalten wie vor A2 (Default-Deckel).
 * Zusätzlich: offene Reservierungen und Schätzungen belasten den Deckel.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyMigration,
  closeDb,
  createTenantWithMember,
  getDbUrl,
  openDb,
  type DbCtx,
} from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
const MIGRATION = '20261028170000_cost_ledger_fail_closed.sql';

type Row = {
  id: string; cost_kind: string; consumption_status: string; settled: boolean;
  units: string; amount_usd: string; corrects_id: string | null;
};

async function reserve(ctx: DbCtx, tenantId: string, usd: number) {
  return ctx.withClaims({ role: 'service_role' }, async () => {
    const r = await ctx.client.query<{
      decision: string; reservation_id: string | null; cap_used: string; cap_total: string;
    }>(
      `SELECT * FROM public.cost_check_and_reserve(
          $1::uuid, 'llm_input', 1, $2::numeric,
          jsonb_build_object('agent_ref', 'a2-test'))`,
      [tenantId, usd],
    );
    return r.rows[0]!;
  });
}

async function settle(ctx: DbCtx, rid: string, tokens: number, unitPrice: number) {
  return ctx.withClaims({ role: 'service_role' }, async () => {
    const r = await ctx.client.query<{ id: string }>(
      `SELECT public.cost_writer_settle($1::uuid, 'llm_input', $2::numeric, $3::numeric) AS id`,
      [rid, tokens, unitPrice],
    );
    return r.rows[0]!.id;
  });
}

async function sweep(ctx: DbCtx): Promise<number> {
  return ctx.withClaims({ role: 'service_role' }, async () => {
    const r = await ctx.client.query<{ n: number }>(
      `SELECT public.cost_sweep_expired_reservations()::int AS n`,
    );
    return r.rows[0]!.n;
  });
}

async function expire(ctx: DbCtx, rid: string) {
  await ctx.client.query(
    `UPDATE public.tenant_cost_ledger SET expires_at = now() - INTERVAL '1 minute'
      WHERE reservation_id = $1 AND settled = false`,
    [rid],
  );
}

async function rows(ctx: DbCtx, rid: string): Promise<Row[]> {
  return (await ctx.client.query<Row>(
    `SELECT id::text, cost_kind, consumption_status, settled, units, amount_usd, corrects_id::text
       FROM public.tenant_cost_ledger WHERE reservation_id = $1 ORDER BY id`,
    [rid],
  )).rows;
}

async function meteredTokens(ctx: DbCtx, tenantId: string): Promise<number> {
  const r = await ctx.client.query<{ n: string }>(
    `SELECT public.count_ai_tokens_by_tenant($1::uuid, to_char(date_trunc('month', now()), 'YYYY-MM-DD')) AS n`,
    [tenantId],
  );
  return Number(r.rows[0]!.n);
}

d('PR A2 / Altledger fail-closed (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('Test 1: abgelaufene Reservierung → geschaetzt zum Höchstbetrag, nicht gelöscht', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const r = await reserve(ctx!, tenantId, 0.5);
    expect(r.decision).toBe('allow');
    await expire(ctx!, r.reservation_id!);

    expect(await sweep(ctx!)).toBe(1);

    const rs = await rows(ctx!, r.reservation_id!);
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ cost_kind: 'llm_estimated', consumption_status: 'geschaetzt', settled: true });
    expect(Number(rs[0]!.amount_usd)).toBeCloseTo(0.5, 6);
  });

  it('Test 3: Sweep zweimal → keine Doppelverbuchung', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const r = await reserve(ctx!, tenantId, 0.25);
    await expire(ctx!, r.reservation_id!);
    expect(await sweep(ctx!)).toBe(1);
    expect(await sweep(ctx!)).toBe(0);
    const rs = await rows(ctx!, r.reservation_id!);
    expect(rs).toHaveLength(1);
    const sum = await ctx!.client.query<{ s: string }>(
      `SELECT sum(amount_usd) s FROM public.tenant_cost_ledger WHERE tenant_id = $1`, [tenantId],
    );
    expect(Number(sum.rows[0]!.s)).toBeCloseTo(0.25, 6);
  });

  it('Test 2: Abrechnung nach Sweep → korrigiert mit Bezug, Summe = gemessen, zweites Settle scheitert', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const r = await reserve(ctx!, tenantId, 0.5);
    await expire(ctx!, r.reservation_id!);
    await sweep(ctx!);

    // Gemessen: 1.000 Tokens zu 0,00002 USD = 0,02 USD
    await settle(ctx!, r.reservation_id!, 1000, 0.00002);

    const rs = await rows(ctx!, r.reservation_id!);
    expect(rs).toHaveLength(3);
    const [est, reversal, measured] = rs;
    // Die Schätzung bleibt unverändert stehen.
    expect(est).toMatchObject({ cost_kind: 'llm_estimated', consumption_status: 'geschaetzt', corrects_id: null });
    expect(reversal).toMatchObject({ cost_kind: 'llm_estimated', consumption_status: 'korrigiert', corrects_id: est!.id });
    expect(measured).toMatchObject({ cost_kind: 'llm_input', consumption_status: 'korrigiert', corrects_id: est!.id });
    expect(Number(measured!.units)).toBe(1000);

    const total = rs.reduce((s, x) => s + Number(x.amount_usd), 0);
    expect(total).toBeCloseTo(0.02, 6);

    await expect(settle(ctx!, r.reservation_id!, 1000, 0.00002)).rejects.toThrow(/not found or already settled/);
    expect(await rows(ctx!, r.reservation_id!)).toHaveLength(3);
  });

  it('Regelfall unverändert: Settle vor Ablauf → eine Zeile, gemessen', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const r = await reserve(ctx!, tenantId, 0.5);
    await settle(ctx!, r.reservation_id!, 1000, 0.00002);
    const rs = await rows(ctx!, r.reservation_id!);
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ cost_kind: 'llm_input', consumption_status: 'gemessen', settled: true });
    expect(await sweep(ctx!)).toBe(0);
  });

  it('Test 7: Metering zählt nur gemessene Tokens — Schätzungen erreichen Stripe nie', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);

    // Identische Aufrufserie wie vor A2: reservieren → gemessen abrechnen.
    const a = await reserve(ctx!, tenantId, 0.5);
    await settle(ctx!, a.reservation_id!, 1200, 0.00002);
    expect(await meteredTokens(ctx!, tenantId)).toBe(1200);

    // Unklarer Ausgang: geschätzt verbucht → Meter unverändert.
    const b = await reserve(ctx!, tenantId, 0.5);
    await expire(ctx!, b.reservation_id!);
    await sweep(ctx!);
    expect(await meteredTokens(ctx!, tenantId)).toBe(1200);

    // Offene Reservierung → Meter unverändert.
    await reserve(ctx!, tenantId, 0.5);
    expect(await meteredTokens(ctx!, tenantId)).toBe(1200);

    // Spätere gemessene Korrektur → genau die gemessenen Tokens kommen hinzu.
    await settle(ctx!, b.reservation_id!, 300, 0.00002);
    expect(await meteredTokens(ctx!, tenantId)).toBe(1500);
  });

  it('Deckel: offene Reservierungen und Schätzungen belasten das Budget', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await ctx!.client.query(
      `INSERT INTO public.tenant_cost_caps (tenant_id, llm_usd_monthly, warn_threshold)
       VALUES ($1, 1, 0.9)`, [tenantId],
    );
    const a = await reserve(ctx!, tenantId, 0.4);          // offen
    const b = await reserve(ctx!, tenantId, 0.4);          // wird geschätzt
    expect(Number(b.cap_used)).toBeCloseTo(0.4, 6);        // a zählt bereits
    await expire(ctx!, b.reservation_id!);
    await sweep(ctx!);

    const c = await reserve(ctx!, tenantId, 0.4);          // 0.4 + 0.4 + 0.4 > 1
    expect(c.decision).toBe('throttle');
    expect(c.reservation_id).toBeNull();
    expect(Number(c.cap_used)).toBeCloseTo(0.8, 6);

    // Nach gemessener Abrechnung der offenen Reservierung sinkt die Belastung.
    await settle(ctx!, a.reservation_id!, 1000, 0.00002);  // 0.02
    const e = await reserve(ctx!, tenantId, 0.4);
    expect(e.decision).toBe('allow');
    expect(Number(e.cap_used)).toBeCloseTo(0.42, 6);
  });

  it('Test 9: Mandant ohne tenant_cost_caps → Default-Deckel wie vor A2', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const r = await reserve(ctx!, tenantId, 0.5);
    expect(r.decision).toBe('allow');
    expect(Number(r.cap_total)).toBe(250);
    expect(Number(r.cap_used)).toBe(0);
  });

  it('Test 6: erneute Anwendung lässt bestehende Zeilen unverändert', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const a = await reserve(ctx!, tenantId, 0.5);
    await settle(ctx!, a.reservation_id!, 1000, 0.00002);
    const open = await reserve(ctx!, tenantId, 0.3);
    const snap = async () => (await ctx!.client.query(
      `SELECT to_jsonb(l) j FROM public.tenant_cost_ledger l WHERE tenant_id = $1 ORDER BY id`, [tenantId],
    )).rows.map((x) => x.j);

    const before = await snap();
    await applyMigration(ctx!, MIGRATIONS_DIR, MIGRATION);
    expect(await snap()).toEqual(before);
    expect(before).toHaveLength(2);
    expect(open.decision).toBe('allow');
  });

  it('Test 6b: die Migration enthält außerhalb von Funktionskörpern kein UPDATE/DELETE', () => {
    const sql = readFileSync(join(MIGRATIONS_DIR, MIGRATION), 'utf8')
      .replace(/--.*$/gm, '')
      .replace(/\$\$[\s\S]*?\$\$/g, '');
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|TRUNCATE)\b/i);
  });

  it('Korrektur ohne Bezug bzw. Bezug ohne Korrektur wird abgelehnt', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await expect(ctx!.client.query(
      `INSERT INTO public.tenant_cost_ledger
         (tenant_id, cost_kind, units, unit_price_usd, agent_ref, consumption_status)
       VALUES ($1, 'llm_input', 1, 0.1, 'a2-test', 'korrigiert')`, [tenantId],
    )).rejects.toThrow(/correction_ref_check/);
  });
});

/**
 * Bot-Kostenbremsen am Abo-Lebenszyklus (Migration 20261030120000).
 *
 * Abnahmekriterien
 *   L1  Bezahlt (active): Profil 28.10.; Tagesdeckel = Monat/10;
 *       ai_usd_monthly = cost_eur / eur_per_usd (INSERT und UPDATE gleich)
 *   L2  Trial: 25 % des bezahlten Profils (nicht 0)
 *   L3  Doppeltes Webhook-Event: identischer Endzustand, kein zweiter Alarm
 *   L4  Kündigung / past_due → Budget 0
 *   L5  Mandant ohne Profil (free_audit) → 0, kein Alarm
 *   L6  Enterprise ohne Profil → Alarm (Tabelle), nicht still; manuelle
 *       Konfiguration wird nie überschrieben
 *   L7  Abgleich findet Abweichungen und korrigiert nichts
 *   L8  Rechte: nur service_role
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTenantWithMember, closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

interface PgError extends Error { code?: string }
const SERVER = { role: 'service_role' } as const;

async function sqlState(p: Promise<unknown>): Promise<string> {
  try { await p; return 'OK'; } catch (e) { return (e as PgError).code ?? (e as Error).message; }
}

d('Bot-Limits Lebenszyklus', () => {
  let ctx: DbCtx;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); });

  const asServer = <T>(fn: () => Promise<T>) => ctx.withClaims(SERVER, fn);

  async function tenantWith(plan: string, status: string): Promise<string> {
    const t = (await createTenantWithMember(ctx)).tenantId;
    await setSub(t, plan, status);
    return t;
  }
  async function setSub(t: string, plan: string, status: string): Promise<void> {
    await ctx.client.query(
      `UPDATE public.subscriptions SET plan_key = $2, status = $3, updated_at = now() WHERE tenant_id = $1`,
      [t, plan, status],
    );
  }
  async function sync(t: string, source = 'stripe:evt_1'): Promise<string> {
    return asServer(async () => (await ctx.client.query(
      `SELECT public.bot_usage_sync_from_subscription($1, $2) AS r`, [t, source],
    )).rows[0].r as string);
  }
  async function row(t: string): Promise<Record<string, string>> {
    return (await ctx.client.query(`SELECT * FROM public.bot_usage_limits WHERE tenant_id = $1`, [t])).rows[0];
  }
  const nums = (r: Record<string, string>) => ({
    sec: Number(r.voice_seconds_monthly), eur: Number(r.cost_eur_monthly),
    usdM: Number(r.ai_usd_monthly), usdD: Number(r.ai_usd_daily),
  });
  async function alarms(t: string): Promise<number> {
    return (await ctx.client.query(
      `SELECT count(*)::int AS n FROM public.bot_usage_limit_alarms WHERE tenant_id = $1 AND resolved_at IS NULL`, [t],
    )).rows[0].n;
  }

  it('L1 bezahlt: Profilwerte, Tag = Monat/10, einheitliche Umrechnung', async () => {
    const t = await tenantWith('starter', 'active');
    expect(await sync(t)).toBe('paid');
    expect(nums(await row(t))).toEqual({ sec: 3600, eur: 8, usdM: 8, usdD: 0.8 });

    // UPDATE-Pfad mit abweichendem Kurs: gleiche Formel wie INSERT.
    await ctx.client.query(`UPDATE public.bot_usage_limits SET eur_per_usd = 0.8 WHERE tenant_id = $1`, [t]);
    await setSub(t, 'agency', 'active');
    expect(await sync(t, 'stripe:evt_2')).toBe('paid');
    expect(nums(await row(t))).toEqual({ sec: 45000, eur: 90, usdM: 112.5, usdD: 11.25 });
    expect((await row(t)).config_source).toBe('stripe:evt_2:agency:active');
  });

  it('L2 Trial erhält 25 % statt 0', async () => {
    const t = await tenantWith('growth', 'trialing');
    expect(await sync(t)).toBe('trial');
    expect(nums(await row(t))).toEqual({ sec: 3750, eur: 7.5, usdM: 7.5, usdD: 0.75 });
  });

  it('L3 doppeltes Event: gleicher Endzustand', async () => {
    const t = await tenantWith('growth', 'active');
    await sync(t, 'stripe:evt_dup');
    const first = nums(await row(t));
    await sync(t, 'stripe:evt_dup');
    expect(nums(await row(t))).toEqual(first);
    expect(first).toEqual({ sec: 15000, eur: 30, usdM: 30, usdD: 3 });
  });

  it('L4 Kündigung und past_due → 0', async () => {
    const t = await tenantWith('agency', 'active');
    await sync(t);
    for (const st of ['past_due', 'canceled']) {
      await setSub(t, 'agency', st);
      expect(await sync(t, `stripe:${st}`)).toBe('zero');
      expect(nums(await row(t))).toEqual({ sec: 0, eur: 0, usdM: 0, usdD: 0 });
    }
  });

  it('L5 Tarif ohne Profil (free_audit) → 0 ohne Alarm', async () => {
    const t = await tenantWith('free_audit', 'active');
    expect(await sync(t)).toBe('zero');
    expect(nums(await row(t))).toEqual({ sec: 0, eur: 0, usdM: 0, usdD: 0 });
    expect(await alarms(t)).toBe(0);
  });

  it('L6 Enterprise ohne Profil → Alarm, nicht still; manuell bleibt', async () => {
    const t = await tenantWith('enterprise', 'active');
    expect(await sync(t)).toBe('alarm_missing_profile');
    expect(await sync(t, 'stripe:evt_retry')).toBe('alarm_missing_profile');
    expect(await alarms(t)).toBe(1);
    expect((await row(t)).config_source).toMatch(/:alarm$/);

    // Direkter Profilaufruf bleibt ein harter Fehler.
    const code = await sqlState(asServer(() => ctx.client.query(
      `SELECT public.bot_usage_apply_plan_profile($1, 'enterprise', 'x')`, [t])));
    expect(code).toBe('22023');

    // Manuelles Onboarding wird nie überschrieben.
    await ctx.client.query(
      `UPDATE public.bot_usage_limits SET voice_seconds_monthly = 99, config_source = 'manual:onboarding' WHERE tenant_id = $1`, [t],
    );
    expect(await sync(t, 'stripe:evt_3')).toBe('manual_kept');
    expect(Number((await row(t)).voice_seconds_monthly)).toBe(99);
  });

  it('L7 Abgleich meldet nur, korrigiert nicht', async () => {
    const t = await tenantWith('growth', 'active');
    await sync(t);
    await ctx.client.query(`UPDATE public.bot_usage_limits SET ai_usd_daily = ai_usd_monthly WHERE tenant_id = $1`, [t]);
    const res = await asServer(async () => (await ctx.client.query(
      `SELECT * FROM public.bot_usage_find_limit_mismatches() WHERE tenant_id = $1`, [t],
    )).rows);
    expect(res.map((r) => r.issue)).toEqual(['daily_not_tenth']);
    expect(nums(await row(t)).usdD).toBe(30);

    const missing = await tenantWith('starter', 'active');
    await ctx.client.query(`DELETE FROM public.bot_usage_limits WHERE tenant_id = $1`, [missing]);
    const res2 = await asServer(async () => (await ctx.client.query(
      `SELECT issue FROM public.bot_usage_find_limit_mismatches() WHERE tenant_id = $1`, [missing],
    )).rows);
    expect(res2.map((r) => r.issue)).toEqual(['missing_row']);
  });

  it('L8 nur service_role', async () => {
    const t = await tenantWith('starter', 'active');
    const code = await sqlState(ctx.withClaims({ role: 'authenticated' }, () => ctx.client.query(
      `SELECT public.bot_usage_sync_from_subscription($1, 'evil')`, [t])));
    expect(code).toBe('42501');
  });
});

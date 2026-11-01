/**
 * Migration 20261030130000_bot_usage_plan_profile_wiring.sql (GO-Fix 30.10.2026)
 *
 *   W1  Doppeltes Stripe-Ereignis wirkt genau einmal ('duplicate')
 *   W2  Kündigung / past_due → Budget 0
 *   W3  Mandant ohne Abo → 'no_subscription', keine Zeile erfunden
 *   W4  Enterprise ohne Profil → Alarm, kein stilles 0, Zeile unverändert
 *   W5  Einheitliche EUR→USD-Umrechnung, Tageslimit = Monat / 10
 *   W6  Trial erhält reduziertes Profil (verbindlich 15 Min / 2 €)
 *   W8  Backfill-Logik: Nullzeile aktiver/Trial-Abos → Profil, idempotent
 *   W7  Reconcile meldet nur, korrigiert nicht
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTenantWithMember, closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;
const SERVER = { role: 'service_role' } as const;

d('bot_usage plan profile wiring', () => {
  let ctx: DbCtx;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); });

  const asServer = <T>(fn: () => Promise<T>) => ctx.withClaims(SERVER, fn);
  const row = async (t: string) =>
    (await ctx.client.query(`SELECT * FROM public.bot_usage_limits WHERE tenant_id = $1`, [t])).rows[0];
  const setSub = (t: string, plan: string, status: string) => ctx.client.query(
    `UPDATE public.subscriptions SET plan_key = $2, status = $3, updated_at = now() WHERE tenant_id = $1`,
    [t, plan, status],
  );
  const sync = (t: string, src: string) => asServer(async () => (await ctx.client.query<{ r: string }>(
    `SELECT public.bot_usage_sync_plan_from_subscription($1, $2) AS r`, [t, src],
  )).rows[0]!.r);

  it('W1/W5 doppeltes Ereignis: einmal angewendet, Tag = Monat/10, EUR→USD', async () => {
    const t = (await createTenantWithMember(ctx)).tenantId;
    await setSub(t, 'growth', 'active');
    expect(await sync(t, 'stripe:evt_dup')).toBe('applied:growth');
    await ctx.client.query(`UPDATE public.bot_usage_limits SET eur_per_usd = 0.5 WHERE tenant_id = $1`, [t]);
    expect(await sync(t, 'stripe:evt_dup')).toBe('duplicate');
    let r = (await row(t))!;
    expect([Number(r.voice_seconds_monthly), Number(r.cost_eur_monthly)]).toEqual([15000, 30]);
    expect([Number(r.ai_usd_monthly), Number(r.ai_usd_daily)]).toEqual([30, 3]);
    // Neues Ereignis mit geändertem Kurs: Insert- und Update-Pfad rechnen gleich.
    expect(await sync(t, 'stripe:evt_next')).toBe('applied:growth');
    r = (await row(t))!;
    expect([Number(r.ai_usd_monthly), Number(r.ai_usd_daily)]).toEqual([60, 6]);
  });

  it('W2 Kündigung und past_due → Budget 0', async () => {
    const t = (await createTenantWithMember(ctx)).tenantId;
    await setSub(t, 'starter', 'active');
    expect(await sync(t, 'stripe:a')).toBe('applied:starter');
    for (const [status, src] of [['past_due', 'stripe:b'], ['canceled', 'stripe:c']] as const) {
      await setSub(t, 'starter', 'active');
      await sync(t, `${src}-re`);
      await setSub(t, 'starter', status);
      expect(await sync(t, src)).toBe(`zeroed:${status}`);
      const r = (await row(t))!;
      expect([Number(r.voice_seconds_monthly), Number(r.cost_eur_monthly), Number(r.ai_usd_monthly), Number(r.ai_usd_daily)])
        .toEqual([0, 0, 0, 0]);
    }
  });

  it('W3 Mandant ohne Abo: kein Profil, keine Zeile erfunden', async () => {
    const t = (await createTenantWithMember(ctx)).tenantId;
    await ctx.client.query(`DELETE FROM public.subscriptions WHERE tenant_id = $1`, [t]);
    await ctx.client.query(`DELETE FROM public.bot_usage_limits WHERE tenant_id = $1`, [t]);
    expect(await sync(t, 'stripe:none')).toBe('no_subscription');
    expect(await row(t)).toBeUndefined();
  });

  it('W4 Enterprise ohne Profil: Alarm, kein stilles 0, manuelle Zeile bleibt', async () => {
    const t = (await createTenantWithMember(ctx)).tenantId;
    await setSub(t, 'enterprise', 'active');
    await ctx.client.query(`DELETE FROM public.bot_usage_limits WHERE tenant_id = $1`, [t]);
    await ctx.client.query(
      `INSERT INTO public.bot_usage_limits (tenant_id, ai_usd_daily, ai_usd_monthly, voice_seconds_monthly, cost_eur_monthly, config_source)
       VALUES ($1, 20, 200, 120000, 200, 'manual:onboarding')`, [t]);
    expect(await sync(t, 'stripe:ent')).toBe('alert:no_profile:enterprise');
    const r = (await row(t))!;
    expect([Number(r.cost_eur_monthly), r.config_source]).toEqual([200, 'manual:onboarding']);
    const alerts = await ctx.client.query(
      `SELECT kind FROM public.bot_usage_plan_alerts WHERE tenant_id = $1`, [t]);
    expect(alerts.rows.map((a) => a.kind)).toEqual(['no_profile']);
    // Direktaufruf mit 'enterprise' bleibt ein Fehler.
    const err = await asServer(() => ctx.client.query(
      `SELECT public.bot_usage_apply_plan_profile($1, 'enterprise', 'x')`, [t])).then(() => 'OK', (e) => e.code);
    expect(err).toBe('22023');
  });

  it('W6 Trial → reduziertes Profil', async () => {
    const t = (await createTenantWithMember(ctx)).tenantId;
    await setSub(t, 'growth', 'trialing');
    expect(await sync(t, 'stripe:trial')).toBe('applied:trial');
    const r = (await row(t))!;
    expect([Number(r.voice_seconds_monthly), Number(r.cost_eur_monthly), Number(r.ai_usd_daily)]).toEqual([900, 2, 0.2]);
  });

  it('W7 Reconcile meldet Abweichung, korrigiert nicht', async () => {
    const t = (await createTenantWithMember(ctx)).tenantId;
    await setSub(t, 'agency', 'active');
    await sync(t, 'stripe:ag');
    await ctx.client.query(`UPDATE public.bot_usage_limits SET cost_eur_monthly = 1 WHERE tenant_id = $1`, [t]);
    const rep = await asServer(async () => (await ctx.client.query(
      `SELECT issue FROM public.bot_usage_plan_reconcile_report() WHERE tenant_id = $1`, [t])).rows);
    expect(rep).toEqual([{ issue: 'mismatch' }]);
    await asServer(() => ctx.client.query(`SELECT public.bot_usage_plan_reconcile_log()`));
    expect(Number((await row(t))!.cost_eur_monthly)).toBe(1);
  });

  it('Rechte: nur service_role', async () => {
    const t = (await createTenantWithMember(ctx)).tenantId;
    const code = await ctx.withClaims({ role: 'authenticated' }, () => ctx.client.query(
      `SELECT public.bot_usage_sync_plan_from_subscription($1, 'x')`, [t])).then(() => 'OK', (e) => e.code);
    expect(code).toBe('42501');
  });

  it('W6b Trial-Profil verbindlich 15 Min / 2 €', async () => {
    const p = (await ctx.client.query(
      `SELECT voice_minutes_monthly, cost_eur_monthly FROM public.bot_usage_plan_profiles WHERE plan_key = 'trial'`)).rows[0];
    expect([p.voice_minutes_monthly, Number(p.cost_eur_monthly)]).toEqual([15, 2]);
  });

  it('W8 Backfill: Nullzeile → Profil, idempotent, manuelle Zeile unberührt', async () => {
    const a = (await createTenantWithMember(ctx)).tenantId;
    const tr = (await createTenantWithMember(ctx)).tenantId;
    await setSub(a, 'starter', 'active');
    await setSub(tr, 'growth', 'trialing');
    for (const t of [a, tr]) {
      await ctx.client.query(`DELETE FROM public.bot_usage_limits WHERE tenant_id = $1`, [t]);
      await ctx.client.query(
        `INSERT INTO public.bot_usage_limits (tenant_id, ai_usd_daily, ai_usd_monthly, voice_seconds_monthly, cost_eur_monthly, config_source)
         VALUES ($1, 0, 0, 0, 0, 'seed:20261028100000')`, [t]);
    }
    for (const t of [a, tr]) {
      expect(await sync(t, `backfill:20261030130000:${t}`)).toMatch(/^applied:/);
      expect(await sync(t, `backfill:20261030130000:${t}`)).toBe('duplicate');
    }
    expect([Number((await row(a))!.voice_seconds_monthly), Number((await row(a))!.cost_eur_monthly)]).toEqual([3600, 8]);
    expect([Number((await row(tr))!.voice_seconds_monthly), Number((await row(tr))!.cost_eur_monthly)]).toEqual([900, 2]);
  });
});

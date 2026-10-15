/**
 * WP-3 — Beta-Abo über den bestehenden Entitlement-Pfad (beta-enroll).
 *
 * Prüft gegen echtes Postgres, was die Edge Function voraussetzt:
 *  - `subscriptions.source` und `beta_enrollments` existieren
 *    (20261013090000_beta_enrollments.sql);
 *  - ein Beta-Abo (`growth`, `trialing`, `trial_end` = Beta-Ende,
 *    `source = 'beta'`) liefert denselben Satz wie ein aktives Growth-Abo;
 *  - nach dem Beta-Ende fällt der Mandant ohne Job auf den Free-Satz zurück
 *    (Regel aus 20260928160000, hier nur für die Beta-Zeile belegt).
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTenantWithMember, closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

const TAG = 86_400_000;

async function alsServer(ctx: DbCtx): Promise<void> {
  await ctx.client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ role: 'service_role' })]);
}

/** Dieselbe Zeile, die `beta-enroll` schreibt — mit wählbarem Ende. */
async function betaAbo(ctx: DbCtx, tenantId: string, endsAt: string): Promise<void> {
  await ctx.client.query(
    `INSERT INTO public.subscriptions
       (tenant_id, plan_key, status, billing_interval, trial_start, trial_end, trial_ends_at, current_period_end, source)
     VALUES ($1, 'growth', 'trialing', 'month', now(), $2, $2, $2, 'beta')
     ON CONFLICT (tenant_id) DO UPDATE
       SET plan_key = 'growth', status = 'trialing', billing_interval = 'month',
           trial_start = now(), trial_end = EXCLUDED.trial_end, trial_ends_at = EXCLUDED.trial_ends_at,
           current_period_end = EXCLUDED.current_period_end, source = 'beta',
           stripe_price_id = NULL, past_due_since = NULL, updated_at = now()`,
    [tenantId, endsAt],
  );
}

/** Growth-Abo ohne Beta in den gewünschten Status (Vergleichssätze wie trial-expiry.db.test.ts). */
async function growth(ctx: DbCtx, tenantId: string, status: 'active' | 'canceled'): Promise<void> {
  await ctx.client.query(
    `INSERT INTO public.subscriptions (tenant_id, plan_key, status)
     VALUES ($1, 'growth', $2)
     ON CONFLICT (tenant_id) DO UPDATE
       SET plan_key = 'growth', status = EXCLUDED.status, trial_end = NULL, trial_ends_at = NULL,
           stripe_price_id = NULL, past_due_since = NULL, source = NULL, updated_at = now()`,
    [tenantId, status],
  );
}

async function entitlements(ctx: DbCtx, tenantId: string): Promise<[string, number][]> {
  const res = await ctx.client.query<{ key: string; value: number }>(
    'SELECT key, value FROM public.tenant_entitlements($1::uuid) ORDER BY key',
    [tenantId],
  );
  return res.rows.map((r) => [r.key, Number(r.value)]);
}

d('beta-enroll — Beta-Abo im Entitlement-Pfad (WP-3)', () => {
  let ctx: DbCtx;
  let tenantId: string;
  let frei: [string, number][];
  let aktiv: [string, number][];

  beforeEach(async () => {
    ctx = await openDb();
    ({ tenantId } = await createTenantWithMember(ctx));
    await alsServer(ctx);
    await growth(ctx, tenantId, 'active');
    aktiv = await entitlements(ctx, tenantId);
    await growth(ctx, tenantId, 'canceled');
    frei = await entitlements(ctx, tenantId);
    expect(aktiv, 'Vorbedingung: Growth unterscheidet sich vom Free-Satz').not.toEqual(frei);
  });

  afterEach(async () => {
    await closeDb(ctx);
  });

  it('gewährt während der Beta den Growth-Satz', async () => {
    await betaAbo(ctx, tenantId, new Date(Date.now() + 90 * TAG).toISOString());
    expect(await entitlements(ctx, tenantId)).toEqual(aktiv);
  });

  it('fällt nach dem Beta-Ende ohne Job auf den Free-Satz zurück', async () => {
    await betaAbo(ctx, tenantId, new Date(Date.now() - 1 * TAG).toISOString());
    expect(await entitlements(ctx, tenantId)).toEqual(frei);
  });

  it('hält den Vorzustand in beta_enrollments fest (ein Eintrag je Mandant)', async () => {
    const ends = new Date(Date.now() + 90 * TAG).toISOString();
    const insert = `INSERT INTO public.beta_enrollments (tenant_id, plan_key, ends_at, previous_plan_key, previous_status)
                    VALUES ($1, 'growth', $2, $3, 'active')
                    ON CONFLICT (tenant_id) DO NOTHING`;
    await ctx.client.query(insert, [tenantId, ends, 'free_tier']);
    await ctx.client.query(insert, [tenantId, ends, 'growth']);
    const res = await ctx.client.query<{ previous_plan_key: string; source: string }>(
      'SELECT previous_plan_key, source FROM public.beta_enrollments WHERE tenant_id = $1',
      [tenantId],
    );
    expect(res.rows).toEqual([{ previous_plan_key: 'free_tier', source: 'beta' }]);
  });
});

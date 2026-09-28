/**
 * WP2a — Testphasen laufen ab (Blocker B11 in .claude/os-funnel/PLAN.md).
 *
 * ## Warum gegen echtes Postgres
 *
 * Die Regel steht in SQL (`20260928160000_wp2a_trial_end_expiry.sql`,
 * CTE `abo_wirksam` in `tenant_entitlements_resolve`). Vorher zählte jedes
 * `trialing`-Abo unbegrenzt — kartenlose Testphasen aus
 * `create-trial-subscription` liefen nie ab. Ein Mock würde genau das nicht
 * prüfen: dass der Auflöser `trial_end` liest, `trial_ends_at` als Ersatz
 * nimmt und eine Testphase ohne gespeichertes Ende (Stripe beendet sie per
 * Status) weiterlaufen lässt.
 *
 * Die Erwartungen vergleichen Ergebnismengen statt Katalogwerte: Eine
 * laufende Testphase liefert dasselbe wie ein aktives Growth-Abo, eine
 * abgelaufene dasselbe wie ein gekündigtes. So bleibt der Test stabil, wenn
 * sich Kontingente im Katalog ändern.
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTenantWithMember, closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

const TAG = 86_400_000;

async function alsServer(ctx: DbCtx): Promise<void> {
  await ctx.client.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
  await ctx.client.query(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`);
}

/** Growth-Abo des Mandanten in den gewünschten Zustand setzen (der tenants-Trigger hat bereits ein Free-Abo angelegt). */
async function abo(
  ctx: DbCtx,
  tenantId: string,
  status: string,
  enden: { trialEnd?: string | null; trialEndsAt?: string | null } = {},
): Promise<void> {
  await ctx.client.query(
    `INSERT INTO public.subscriptions (tenant_id, plan_key, status, trial_end, trial_ends_at)
     VALUES ($1, 'growth', $2, $3, $4)
     ON CONFLICT (tenant_id) DO UPDATE
       SET plan_key = 'growth',
           status = EXCLUDED.status,
           trial_end = EXCLUDED.trial_end,
           trial_ends_at = EXCLUDED.trial_ends_at,
           stripe_price_id = NULL,
           past_due_since = NULL,
           updated_at = now()`,
    [tenantId, status, enden.trialEnd ?? null, enden.trialEndsAt ?? null],
  );
}

async function entitlements(ctx: DbCtx, tenantId: string): Promise<[string, number][]> {
  const res = await ctx.client.query<{ key: string; value: number }>(
    'SELECT key, value FROM public.tenant_entitlements($1::uuid) ORDER BY key',
    [tenantId],
  );
  return res.rows.map((r) => [r.key, Number(r.value)]);
}

d('tenant_entitlements — Testphase läuft ab (WP2a)', () => {
  let ctx: DbCtx;
  let tenantId: string;
  let aktiv: [string, number][];
  let frei: [string, number][];

  beforeEach(async () => {
    ctx = await openDb();
    ({ tenantId } = await createTenantWithMember(ctx));
    await alsServer(ctx);
    await abo(ctx, tenantId, 'active');
    aktiv = await entitlements(ctx, tenantId);
    await abo(ctx, tenantId, 'canceled');
    frei = await entitlements(ctx, tenantId);
    // Ohne Unterschied zwischen aktiv und frei wären die Erwartungen unten leer.
    expect(aktiv, 'Vorbedingung: Growth unterscheidet sich vom Free-Satz').not.toEqual(frei);
  });

  afterEach(async () => {
    await closeDb(ctx);
  });

  it('zählt eine laufende Testphase wie ein aktives Abo', async () => {
    await abo(ctx, tenantId, 'trialing', { trialEnd: new Date(Date.now() + 14 * TAG).toISOString() });
    expect(await entitlements(ctx, tenantId)).toEqual(aktiv);
  });

  it('lässt eine abgelaufene Testphase auf den Free-Satz zurückfallen', async () => {
    await abo(ctx, tenantId, 'trialing', { trialEnd: new Date(Date.now() - 1 * TAG).toISOString() });
    expect(await entitlements(ctx, tenantId)).toEqual(frei);
  });

  it('liest trial_ends_at, wenn trial_end fehlt', async () => {
    await abo(ctx, tenantId, 'trialing', { trialEndsAt: new Date(Date.now() - 1 * TAG).toISOString() });
    expect(await entitlements(ctx, tenantId)).toEqual(frei);

    await abo(ctx, tenantId, 'trialing', { trialEndsAt: new Date(Date.now() + 3 * TAG).toISOString() });
    expect(await entitlements(ctx, tenantId)).toEqual(aktiv);
  });

  it('lässt eine Testphase ohne gespeichertes Ende laufen (Stripe beendet sie per Status)', async () => {
    await abo(ctx, tenantId, 'trialing');
    expect(await entitlements(ctx, tenantId)).toEqual(aktiv);
  });

  it('gibt trial_end den Vorrang vor trial_ends_at', async () => {
    await abo(ctx, tenantId, 'trialing', {
      trialEnd: new Date(Date.now() - 1 * TAG).toISOString(),
      trialEndsAt: new Date(Date.now() + 30 * TAG).toISOString(),
    });
    expect(await entitlements(ctx, tenantId)).toEqual(frei);
  });
});

/**
 * entitlement_grants — Einmalkäufe ergänzen die Subscription, statt sie zu
 * ersetzen.
 *
 * Warum diese Tests gegen echtes Postgres laufen:
 *   Die gesamte Logik steckt in SQL (`tenant_entitlements()`, CHECK- und
 *   UNIQUE-Constraints). Ein Mock würde genau die Eigenschaften nicht prüfen,
 *   auf die es ankommt — Konfliktauflösung per MAX(), Idempotenz über einen
 *   Unique-Index und die Frage, ob `subscriptions` unberührt bleibt.
 *
 * Der Aufbau bildet bewusst den PRODUKTIONSZUSTAND ab (gelesen am 2026-08-08):
 * Produkt `free` vorhanden, `free_tier` NICHT. Ein Test gegen den Repo-Stand
 * hätte die Regression übersehen, dass ein hart auf `free_tier` gesetzter
 * Fallback in Produktion jedem Tenant ohne Abo alle Rechte entzieht.
 *
 * Ohne TEST_DB_URL werden die Tests übersprungen (Muster der übrigen
 * *.db.test.ts in diesem Verzeichnis).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDbUrl, openDb, closeDb, type DbCtx } from './db-helpers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'supabase', 'migrations');

const MIGRATIONS = [
  '20260808100000_entitlement_grants.sql',
  '20260808110000_governance_launch_entitlements.sql',
  '20260808120000_tenant_entitlements_with_grants.sql',
];

const GROWTH = '11111111-1111-1111-1111-111111111111';
const FREE = '22222222-2222-2222-2222-222222222222';

/**
 * Der Teil des Billing-Schemas, den die Migrationen voraussetzen und den
 * bootstrap.sql nicht mitbringt. Entspricht der Produktionsdefinition —
 * insbesondere OHNE UNIQUE(tenant_id) auf subscriptions, weil diese
 * Constraint in Produktion (noch) nicht existiert.
 */
const BILLING_SCHEMA = `
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  plan_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_price_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  default_for_plan_key TEXT UNIQUE
);
CREATE TABLE public.entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'limit' CHECK (kind IN ('boolean','limit'))
);
CREATE TABLE public.product_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  entitlement_id UUID NOT NULL REFERENCES public.entitlements(id) ON DELETE CASCADE,
  value INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, entitlement_id)
);

-- Katalog-Ausschnitt wie in Produktion.
INSERT INTO public.entitlements (key, kind) VALUES
  ('limit.domains','limit'), ('limit.team_seats','limit'),
  ('limit.compliance_exports_monthly','limit'), ('compliance.export','boolean'),
  ('dse.generator','boolean'), ('api.access','boolean'),
  ('limit.active_assets','limit'), ('bots.enabled','boolean'),
  ('limit.bots','limit'), ('limit.bot_messages_monthly','limit'),
  ('asset.verify','boolean');

-- 'free' existiert, 'free_tier' NICHT — exakt wie in Produktion.
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key) VALUES
  ('internal_default_free','Free (default)','free'),
  ('price_growth_live','RealSync Growth','growth');

INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, v.val FROM (VALUES
  ('free','limit.active_assets',10), ('free','limit.team_seats',1), ('free','asset.verify',1),
  ('growth','limit.domains',3), ('growth','limit.team_seats',5),
  ('growth','limit.compliance_exports_monthly',20), ('growth','api.access',1)
) AS v(plan_key, ent_key, val)
JOIN public.products p ON p.default_for_plan_key = v.plan_key
JOIN public.entitlements e ON e.key = v.ent_key;
`;

async function entitlements(ctx: DbCtx, tenantId: string): Promise<Map<string, number>> {
  const res = await ctx.client.query<{ key: string; value: number }>(
    'SELECT key, value FROM public.tenant_entitlements($1::uuid)',
    [tenantId],
  );
  return new Map(res.rows.map((r) => [r.key, Number(r.value)]));
}

/** Schreibt einen Grant so, wie es der Stripe-Webhook tut (inkl. Upsert-Regel). */
async function grantGovernanceLaunch(
  ctx: DbCtx,
  tenantId: string,
  sessionId: string,
): Promise<void> {
  await ctx.client.query(
    `INSERT INTO public.entitlement_grants
       (tenant_id, product_id, plan_key, source, purchase_reference,
        stripe_checkout_session_id, amount_total_cents, currency, status)
     SELECT $1, p.id, 'governance_launch', 'one_time_purchase', $2, $2, 34900, 'eur', 'active'
     FROM public.products p WHERE p.default_for_plan_key = 'governance_launch'
     ON CONFLICT (source, purchase_reference)
       DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
    [tenantId, sessionId],
  );
}

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

d('entitlement_grants — Einmalkäufe neben der Subscription', () => {
  let ctx: DbCtx;

  beforeEach(async () => {
    ctx = await openDb();
    await ctx.client.query(BILLING_SCHEMA);
    for (const file of MIGRATIONS) {
      await ctx.client.query(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    }
    await ctx.client.query(
      `INSERT INTO public.tenants (id, name) VALUES ($1,'growth-kunde'), ($2,'free-ohne-abo')
       ON CONFLICT (id) DO NOTHING`,
      [GROWTH, FREE],
    );
    // Nur der eine Tenant hat ein Abo; der andere bleibt bewusst ohne Zeile.
    await ctx.client.query(
      `INSERT INTO public.subscriptions (tenant_id, stripe_customer_id, stripe_price_id, plan_key, status)
       VALUES ($1,'cus_growth','price_growth_live','growth','active')`,
      [GROWTH],
    );
  });

  afterEach(async () => {
    await closeDb(ctx);
  });

  it('Free-Tenant ohne Abo behält den free-Fallback', async () => {
    // Regressionsschutz: ein hart auf 'free_tier' gesetzter Fallback lieferte
    // in Produktion ein LEERES Ergebnis, weil es dort kein free_tier-Produkt gibt.
    const before = await entitlements(ctx, FREE);
    expect(before.get('limit.active_assets')).toBe(10);
    expect(before.get('limit.team_seats')).toBe(1);
  });

  it('Free + Governance Launch: Rechte kommen hinzu, Free bleibt erhalten', async () => {
    await grantGovernanceLaunch(ctx, FREE, 'cs_free_1');
    const after = await entitlements(ctx, FREE);

    expect(after.get('evidence.basic_vault')).toBe(1);
    expect(after.get('policy.packs')).toBe(1);
    expect(after.get('limit.evidence_storage_gb')).toBe(5);
    expect(after.get('limit.domains')).toBe(1);
    // Der höhere Wert gewinnt: Governance Launch hebt die Sitze von 1 auf 3.
    expect(after.get('limit.team_seats')).toBe(3);
    // Free-Rechte bleiben bestehen.
    expect(after.get('limit.active_assets')).toBe(10);
  });

  it('Growth + Governance Launch: das Abo verliert nichts', async () => {
    const before = await entitlements(ctx, GROWTH);
    await grantGovernanceLaunch(ctx, GROWTH, 'cs_growth_1');
    const after = await entitlements(ctx, GROWTH);

    // Wo Growth höher liegt, gewinnt Growth.
    expect(after.get('limit.domains')).toBe(3);
    expect(after.get('limit.team_seats')).toBe(5);
    expect(after.get('limit.compliance_exports_monthly')).toBe(20);
    expect(after.get('api.access')).toBe(1);

    // Kein bestehender Wert darf sinken.
    for (const [key, value] of before) {
      expect(after.get(key), `${key} gesunken`).toBeGreaterThanOrEqual(value);
    }

    // Und der Governance-Umfang kommt hinzu.
    expect(after.get('evidence.basic_vault')).toBe(1);
    expect(after.get('limit.evidence_storage_gb')).toBe(5);
  });

  it('lässt die bestehende Subscription unangetastet', async () => {
    await grantGovernanceLaunch(ctx, GROWTH, 'cs_growth_1');
    const res = await ctx.client.query<{ plan_key: string; anzahl: string }>(
      `SELECT plan_key, count(*) OVER ()::text AS anzahl
         FROM public.subscriptions WHERE tenant_id = $1`,
      [GROWTH],
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].plan_key).toBe('growth');
  });

  it('ist idempotent gegenüber doppelt zugestellten Stripe-Webhooks', async () => {
    await grantGovernanceLaunch(ctx, GROWTH, 'cs_growth_1');
    await grantGovernanceLaunch(ctx, GROWTH, 'cs_growth_1');
    await grantGovernanceLaunch(ctx, GROWTH, 'cs_growth_1');

    const res = await ctx.client.query<{ count: string }>(
      'SELECT count(*)::text FROM public.entitlement_grants WHERE tenant_id = $1',
      [GROWTH],
    );
    expect(res.rows[0].count).toBe('1');
  });

  it('verhindert, dass dieselbe Session zwei Tenants gutgeschrieben wird', async () => {
    await grantGovernanceLaunch(ctx, GROWTH, 'cs_shared');
    await expect(
      ctx.client.query(
        `INSERT INTO public.entitlement_grants (tenant_id, product_id, plan_key, source, purchase_reference)
         SELECT $1, p.id, 'governance_launch', 'one_time_purchase', 'cs_shared'
         FROM public.products p WHERE p.default_for_plan_key = 'governance_launch'`,
        [FREE],
      ),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it('entzieht die Rechte nach einer Erstattung, behält aber den Prüfpfad', async () => {
    await grantGovernanceLaunch(ctx, FREE, 'cs_free_1');
    expect((await entitlements(ctx, FREE)).get('evidence.basic_vault')).toBe(1);

    await ctx.client.query(
      `UPDATE public.entitlement_grants
          SET status='revoked', revoked_at=now(), revoked_reason='refund'
        WHERE purchase_reference='cs_free_1'`,
    );

    const after = await entitlements(ctx, FREE);
    expect(after.has('evidence.basic_vault')).toBe(false);
    // Free-Rechte bleiben, der Tenant fällt nicht ins Leere.
    expect(after.get('limit.active_assets')).toBe(10);

    const rows = await ctx.client.query<{ count: string }>(
      `SELECT count(*)::text FROM public.entitlement_grants WHERE purchase_reference='cs_free_1'`,
    );
    expect(rows.rows[0].count).toBe('1');
  });

  it('lässt einen abgelaufenen Grant nichts mehr gewähren', async () => {
    await grantGovernanceLaunch(ctx, FREE, 'cs_free_1');
    await ctx.client.query(
      `UPDATE public.entitlement_grants SET expires_at = now() - interval '1 day'
        WHERE purchase_reference='cs_free_1'`,
    );
    expect((await entitlements(ctx, FREE)).has('evidence.basic_vault')).toBe(false);
  });

  it('erzwingt konsistente Widerrufsdaten', async () => {
    await grantGovernanceLaunch(ctx, FREE, 'cs_free_1');
    // status='revoked' ohne revoked_at wäre im Prüfpfad nicht auswertbar.
    await expect(
      ctx.client.query(
        `UPDATE public.entitlement_grants SET status='revoked'
          WHERE purchase_reference='cs_free_1'`,
      ),
    ).rejects.toThrow(/entitlement_grants_revocation_consistent|check constraint/i);
  });
});

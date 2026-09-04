/**
 * Add-on-Grants im Auflöser: Kontingente addieren sich, Booleans vereinigen
 * sich, und nichts davon zählt ohne wirksames Abo.
 *
 * ## Warum gegen echtes Postgres
 *
 * Die Regel steht in SQL (`20260904000000_addon_booking_schema.sql`). Ein
 * Mock würde genau das nicht prüfen, worauf es ankommt: dass ein Response
 * Pack auf Growth 7.000 ergibt und nicht 5.000 (MAX) — der Kunde bezahlt
 * sonst für ein Kontingent, das er nur zum Teil bekommt —, dass ein
 * Einmalkauf weiterhin per MAX vereinigt wird, dass die Grace Period auch
 * für Add-ons gilt und dass die Mitgliedschaftsprüfung unverändert ist.
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDbUrl, openDb, closeDb, type DbCtx } from './db-helpers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
const MIGRATION = '20260904000000_addon_booking_schema.sql';

const MANDANT = '44444444-4444-4444-4444-444444444444';
const MITGLIED = '99999999-9999-9999-9999-999999999999';
const FREMDER = '88888888-8888-8888-8888-888888888888';

/**
 * Produktionsnaher Schema-Ausschnitt: alle Tabellen, die die Migration
 * anfasst, mit den Constraints, auf die sie sich verlässt (der unbenannte
 * CHECK auf `entitlement_grants.source` heißt in Postgres
 * `entitlement_grants_source_check` — genau den ersetzt die Migration).
 */
const SCHEMA = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE
AS $$SELECT nullif(current_setting('request.jwt.claim.role', true), '')::text$$;

CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);
CREATE TABLE IF NOT EXISTS public.tenants (id UUID PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner'
);
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  stripe_price_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  past_due_since TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_price_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  default_for_plan_key TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS public.entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'limit' CHECK (kind IN ('boolean','limit'))
);
CREATE TABLE IF NOT EXISTS public.product_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  entitlement_id UUID NOT NULL REFERENCES public.entitlements(id) ON DELETE CASCADE,
  value INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, entitlement_id)
);
CREATE TABLE IF NOT EXISTS public.entitlement_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  plan_key TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('one_time_purchase', 'manual', 'promotion', 'migration')),
  purchase_reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entitlement_grants_idempotency UNIQUE (source, purchase_reference),
  CONSTRAINT entitlement_grants_revocation_consistent CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS public.plan_addons (
  addon_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_eur NUMERIC(10,2) NOT NULL,
  price_note TEXT NOT NULL DEFAULT '',
  interval TEXT NOT NULL DEFAULT 'month',
  available_for JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  addon_key TEXT NOT NULL,
  stripe_item_id TEXT UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.entitlements (key, kind) VALUES
  ('bots.enabled','boolean'), ('bots.voice','boolean'), ('policy.packs','boolean'),
  ('limit.bot_messages_monthly','limit'), ('limit.bot_voice_minutes_monthly','limit')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.products (stripe_price_id, name, default_for_plan_key) VALUES
  ('price_growth','RealSync Growth','growth'),
  ('price_enterprise','RealSync Enterprise','enterprise'),
  ('internal_default_free','Free Audit','free_audit'),
  ('internal_addon_response_pack','Add-on: Response Pack',NULL),
  ('internal_addon_voice','Add-on: Voice',NULL),
  ('internal_default_governance_launch','Governance Launch','governance_launch')
ON CONFLICT (stripe_price_id) DO NOTHING;

INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, v.val FROM (VALUES
  ('price_growth','bots.enabled',1),
  ('price_growth','limit.bot_messages_monthly',2000),
  ('price_growth','policy.packs',1),
  ('price_enterprise','bots.enabled',1),
  ('price_enterprise','limit.bot_messages_monthly',-1),
  ('internal_default_free','policy.packs',0),
  ('internal_addon_response_pack','limit.bot_messages_monthly',5000),
  ('internal_addon_voice','bots.voice',1),
  ('internal_addon_voice','bots.enabled',1),
  ('internal_addon_voice','limit.bot_voice_minutes_monthly',500),
  ('internal_default_governance_launch','limit.bot_messages_monthly',1000),
  ('internal_default_governance_launch','policy.packs',1)
) AS v(price, ent_key, val)
JOIN public.products p ON p.stripe_price_id = v.price
JOIN public.entitlements e ON e.key = v.ent_key
ON CONFLICT DO NOTHING;
`;

/** Migration ohne ihre eigene Transaktionsklammer — der Test hält die Klammer. */
function migrationSql(): string {
  return readFileSync(join(MIGRATIONS_DIR, MIGRATION), 'utf8')
    .replace(/^BEGIN;\s*$/m, '')
    .replace(/^COMMIT;\s*$/m, '');
}

async function alsAufrufer(ctx: DbCtx, sub: string, role: string): Promise<void> {
  await ctx.client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [sub]);
  await ctx.client.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}

async function entitlements(ctx: DbCtx, tenantId: string): Promise<Map<string, number>> {
  const res = await ctx.client.query<{ key: string; value: number }>(
    'SELECT key, value FROM public.tenant_entitlements($1::uuid)',
    [tenantId],
  );
  return new Map(res.rows.map((r) => [r.key, Number(r.value)]));
}

async function produktId(ctx: DbCtx, price: string): Promise<string> {
  const res = await ctx.client.query<{ id: string }>(
    'SELECT id FROM public.products WHERE stripe_price_id = $1', [price]);
  return res.rows[0].id;
}

async function addonGrant(
  ctx: DbCtx,
  price: string,
  opts: { quantity?: number; status?: 'active' | 'revoked'; ref?: string } = {},
): Promise<void> {
  const status = opts.status ?? 'active';
  await ctx.client.query(
    `INSERT INTO public.entitlement_grants
       (tenant_id, product_id, plan_key, source, purchase_reference, quantity, status, revoked_at, addon_id)
     VALUES ($1, $2, 'growth', 'addon_subscription', $3, $4, $5, $6, $7)`,
    [MANDANT, await produktId(ctx, price), opts.ref ?? `si_${price}`, opts.quantity ?? 1, status,
      status === 'revoked' ? new Date().toISOString() : null, price.replace('internal_addon_', '')],
  );
}

async function aboStatus(ctx: DbCtx, status: string, pastDueSince: string | null = null): Promise<void> {
  await ctx.client.query(
    `UPDATE public.subscriptions SET status = $2, past_due_since = $3, updated_at = now() WHERE tenant_id = $1`,
    [MANDANT, status, pastDueSince],
  );
}

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

d('tenant_entitlements — Add-on-Grants', () => {
  let ctx: DbCtx;

  beforeEach(async () => {
    ctx = await openDb();
    await ctx.client.query(SCHEMA);
    await ctx.client.query(migrationSql());
    await ctx.client.query(
      `INSERT INTO public.tenants (id, name) VALUES ($1, 'growth-kunde') ON CONFLICT (id) DO NOTHING`,
      [MANDANT],
    );
    await ctx.client.query(
      `INSERT INTO public.subscriptions (tenant_id, plan_key, status, stripe_subscription_id)
       VALUES ($1, 'growth', 'active', 'sub_test')`,
      [MANDANT],
    );
    // bootstrap.sql bindet memberships.user_id an auth.users — der Nutzer
    // muss deshalb existieren, bevor er Mitglied werden kann.
    await ctx.client.query(
      `INSERT INTO auth.users (id) VALUES ($1), ($2) ON CONFLICT (id) DO NOTHING`,
      [MITGLIED, FREMDER],
    );
    await ctx.client.query(
      `INSERT INTO public.memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [MANDANT, MITGLIED],
    );
    await alsAufrufer(ctx, '', 'service_role');
  });

  afterEach(async () => {
    await closeDb(ctx);
  });

  it('addiert ein Kontingent aus dem Add-on auf den Planwert', async () => {
    await addonGrant(ctx, 'internal_addon_response_pack');
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.get('limit.bot_messages_monthly'), '2.000 aus Growth + 5.000 aus dem Pack').toBe(7000);
  });

  it('multipliziert das Kontingent mit der gebuchten Menge', async () => {
    await addonGrant(ctx, 'internal_addon_response_pack', { quantity: 2 });
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.get('limit.bot_messages_monthly')).toBe(12000);
  });

  it('vereinigt boolesche Keys und bringt neue Kontingente mit', async () => {
    await addonGrant(ctx, 'internal_addon_voice');
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.get('bots.voice')).toBe(1);
    expect(ent.get('bots.enabled'), 'bleibt 1, wird nicht 2').toBe(1);
    expect(ent.get('limit.bot_voice_minutes_monthly'), 'Growth hatte den Key nicht').toBe(500);
    expect(ent.get('limit.bot_messages_monthly'), 'unberührt').toBe(2000);
  });

  it('vereinigt Einmalkäufe weiterhin per MAX, nicht additiv', async () => {
    // Governance Launch trägt 1.000 Antworten. Ein Einmalkauf ist kein
    // Zuschlag auf das Abo — das Verhalten aus 20260808120000 bleibt.
    await ctx.client.query(
      `INSERT INTO public.entitlement_grants
         (tenant_id, product_id, plan_key, source, purchase_reference)
       VALUES ($1, $2, 'governance_launch', 'one_time_purchase', 'cs_test')`,
      [MANDANT, await produktId(ctx, 'internal_default_governance_launch')],
    );
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.get('limit.bot_messages_monthly')).toBe(2000);
  });

  it('lässt -1 alles schlagen — auch einen Add-on-Zuschlag', async () => {
    await ctx.client.query(`UPDATE public.subscriptions SET plan_key = 'enterprise' WHERE tenant_id = $1`, [MANDANT]);
    await addonGrant(ctx, 'internal_addon_response_pack');
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.get('limit.bot_messages_monthly')).toBe(-1);
  });

  it('zählt einen widerrufenen Add-on-Grant nicht', async () => {
    await addonGrant(ctx, 'internal_addon_response_pack', { status: 'revoked' });
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.get('limit.bot_messages_monthly')).toBe(2000);
  });

  it('lässt Add-ons in der Grace Period weiterlaufen', async () => {
    await addonGrant(ctx, 'internal_addon_voice');
    await aboStatus(ctx, 'past_due', new Date(Date.now() - 6 * 86_400_000).toISOString());
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.get('bots.voice')).toBe(1);
  });

  it('ruht mit dem Abo, wenn die Grace Period abgelaufen ist', async () => {
    await addonGrant(ctx, 'internal_addon_voice');
    await aboStatus(ctx, 'past_due', new Date(Date.now() - 8 * 86_400_000).toISOString());
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.has('bots.voice'), 'Add-on ist Position des Abos').toBe(false);
    expect(ent.get('policy.packs'), 'Free-Satz').toBe(0);
  });

  it('ruht mit dem Abo, wenn es gekündigt ist', async () => {
    await addonGrant(ctx, 'internal_addon_response_pack');
    await aboStatus(ctx, 'canceled');
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.has('limit.bot_messages_monthly')).toBe(false);
  });

  it('gibt einem fremden Nutzer weiterhin nichts', async () => {
    await addonGrant(ctx, 'internal_addon_voice');
    await alsAufrufer(ctx, FREMDER, 'authenticated');
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.size).toBe(0);
  });

  it('gibt dem Mitglied im Browser dasselbe wie dem Server', async () => {
    await addonGrant(ctx, 'internal_addon_response_pack');
    await alsAufrufer(ctx, MITGLIED, 'authenticated');
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.get('limit.bot_messages_monthly')).toBe(7000);
  });

  it('weist eine unbekannte Grant-Quelle weiterhin ab', async () => {
    await ctx.client.query('SAVEPOINT quelle');
    await expect(
      ctx.client.query(
        `INSERT INTO public.entitlement_grants (tenant_id, product_id, plan_key, source, purchase_reference)
         VALUES ($1, $2, 'growth', 'bogus', 'x')`,
        [MANDANT, await produktId(ctx, 'internal_addon_voice')],
      ),
    ).rejects.toThrow(/entitlement_grants_source_check/);
    await ctx.client.query('ROLLBACK TO SAVEPOINT quelle');
  });

  it('verknüpft plan_addons mit dem Add-on-Produkt und den Spalten der Buchung', async () => {
    const res = await ctx.client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'plan_addons'`);
    const spalten = res.rows.map((r) => r.column_name);
    for (const s of ['stripe_price_id', 'product_id', 'grants', 'per_unit']) expect(spalten).toContain(s);
    const sa = await ctx.client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'subscription_addons'`);
    const sp = sa.rows.map((r) => r.column_name);
    for (const s of ['tenant_id', 'status', 'removed_at', 'stripe_price_id']) expect(sp).toContain(s);
  });
});

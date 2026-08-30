/**
 * `tenant_entitlements()` muss für **beide** Aufrufer richtig antworten.
 *
 * ## Warum es diese Datei gibt
 *
 * `20260828010000` hat der Funktion eine Mitgliedschaftsprüfung gegeben und
 * damit ein echtes Loch geschlossen: Vorher konnte jeder eingeloggte Nutzer
 * die Entitlements jedes beliebigen Mandanten lesen. Die Prüfung hat aber
 * zugleich den Aufrufer ausgesperrt, für den die Funktion in erster Linie
 * da ist — Edge Functions lösen über den **Admin-Client** auf, und ein
 * service_role-Token trägt keinen `sub`-Claim.
 *
 * Die Folge wäre in beide Richtungen schlecht gewesen:
 *
 *   `gateFeature()`   → FORBIDDEN für jeden Kunden bis Enterprise
 *   `consumeUsage()`  → `planLimit` NULL, Kontingente lautlos wirkungslos
 *
 * Beides ist **kein Mock-Thema**: Die Regel steht in SQL, hängt an
 * `auth.uid()` bzw. `auth.role()` und ist in TypeScript nicht nachbildbar.
 * Genau deshalb läuft dieser Test gegen echtes Postgres.
 *
 * Der Test prüft die vier Fälle, die zusammen die Eigenschaft ausmachen:
 *
 *   | Aufrufer                      | erwartet |
 *   |-------------------------------|----------|
 *   | Browser, Mitglied             | sieht alles |
 *   | Edge Function (service_role)  | sieht alles |
 *   | Fremder eingeloggter Nutzer   | sieht nichts |
 *   | Anonym                        | sieht nichts |
 *
 * Fällt der zweite Fall, sind alle zehn Functions mit Entitlement-Gate tot.
 * Fällt der dritte, ist die Mandantentrennung offen. Ein Test, der nur einen
 * von beiden prüfte, hätte die Regression durchgelassen — der ursprüngliche
 * Nachweis zu AP1/AP4 hatte `auth.uid()` auf einen festen Nutzer gestubbt
 * und damit genau den service_role-Fall nie gesehen.
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

/** Nur die Migration, die den Auflöser auf seinen aktuellen Stand bringt. */
const RESOLVER_MIGRATION = '20260831020000_tenant_entitlements_service_role.sql';

const MANDANT = '44444444-4444-4444-4444-444444444444';
const MITGLIED = '99999999-9999-9999-9999-999999999999';
const FREMDER = '88888888-8888-8888-8888-888888888888';

/**
 * Der Schema-Ausschnitt, den der Auflöser voraussetzt — plus die beiden
 * `auth`-Funktionen, die in Supabase den JWT lesen. Hier lesen sie dieselben
 * GUCs wie dort, damit der Test denselben Weg nimmt und nicht einen
 * nachgebauten.
 */
const SCHEMA = `
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE
AS $$SELECT nullif(current_setting('request.jwt.claim.role', true), '')::text$$;

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
  tenant_id UUID NOT NULL,
  product_id UUID,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ
);

INSERT INTO public.entitlements (key, kind) VALUES
  ('bots.enabled','boolean'), ('limit.bot_messages_monthly','limit'),
  ('policy.packs','boolean')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.products (stripe_price_id, name, default_for_plan_key) VALUES
  ('price_growth','RealSync Growth','growth'),
  ('internal_default_free','Free Audit','free_audit')
ON CONFLICT (stripe_price_id) DO NOTHING;

INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, v.val FROM (VALUES
  ('growth','bots.enabled',1),
  ('growth','limit.bot_messages_monthly',2000),
  ('growth','policy.packs',1),
  ('free_audit','policy.packs',0)
) AS v(plan_key, ent_key, val)
JOIN public.products p ON p.default_for_plan_key = v.plan_key
JOIN public.entitlements e ON e.key = v.ent_key
ON CONFLICT DO NOTHING;
`;

/** Setzt die JWT-Claims für die Dauer der Sitzung — wie PostgREST es tut. */
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

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

d('tenant_entitlements — Browser und Server sehen beide das Richtige', () => {
  let ctx: DbCtx;

  beforeEach(async () => {
    ctx = await openDb();
    await ctx.client.query('CREATE TABLE IF NOT EXISTS public.tenants (id UUID PRIMARY KEY, name TEXT NOT NULL)');
    await ctx.client.query(SCHEMA);
    await ctx.client.query(readFileSync(join(MIGRATIONS_DIR, RESOLVER_MIGRATION), 'utf8'));
    await ctx.client.query(
      `INSERT INTO public.tenants (id, name) VALUES ($1, 'growth-kunde') ON CONFLICT (id) DO NOTHING`,
      [MANDANT],
    );
    await ctx.client.query(
      `INSERT INTO public.subscriptions (tenant_id, plan_key, status) VALUES ($1, 'growth', 'active')`,
      [MANDANT],
    );
    await ctx.client.query(
      `INSERT INTO public.memberships (tenant_id, user_id) VALUES ($1, $2)`,
      [MANDANT, MITGLIED],
    );
  });

  afterEach(async () => {
    await closeDb(ctx);
  });

  it('gibt dem eingeloggten Mitglied seine Entitlements', async () => {
    await alsAufrufer(ctx, MITGLIED, 'authenticated');
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.get('bots.enabled')).toBe(1);
    expect(ent.get('policy.packs')).toBe(1);
  });

  it('gibt dem Server (service_role) dieselben Entitlements', async () => {
    // Der Fall, der die Regression ausgemacht hat. Ein service_role-Token
    // trägt keinen `sub`-Claim — `auth.uid()` ist NULL.
    await alsAufrufer(ctx, '', 'service_role');
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.get('bots.enabled'), 'gateFeature() wäre sonst für jeden Kunden FORBIDDEN').toBe(1);
  });

  it('liefert dem Server das Kontingent, sonst greift keine Grenze', async () => {
    // `consumeUsage()` liest das Plan-Limit über genau diesen Weg. Fehlt der
    // Wert, ist `planLimit` NULL und die Mengenprüfung wird übersprungen —
    // aus einem Kontingent würde eine Preisangabe ohne Wirkung.
    await alsAufrufer(ctx, '', 'service_role');
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.get('limit.bot_messages_monthly')).toBe(2000);
  });

  it('gibt einem fremden eingeloggten Nutzer nichts', async () => {
    await alsAufrufer(ctx, FREMDER, 'authenticated');
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.size, 'Mandantentrennung').toBe(0);
  });

  it('gibt einem anonymen Aufrufer nichts', async () => {
    await alsAufrufer(ctx, '', 'anon');
    const ent = await entitlements(ctx, MANDANT);
    expect(ent.size).toBe(0);
  });
});

-- Entitlements normalization: decouple Stripe Prices from feature/limit definitions.
--
-- Model:
--   products              one row per Stripe Price (or internal default plan)
--   entitlements          catalog of feature/limit keys
--   product_entitlements  Product × Entitlement → integer value
--
-- Value semantics (kept simple by design):
--   value = -1   unlimited / always-on
--   value =  0   feature off / no quota   (== row absent)
--   value >  0   numeric limit            (e.g. 1000 api_requests)
--
-- Booleans use 1 = on, 0 = off, -1 = unlimited (treated as on).
--
-- Resolution at runtime joins subscriptions.stripe_price_id → products.stripe_price_id.
-- For tenants without a real Stripe subscription (or for fallback), we also keep
-- a `default_for_plan_key` column so subscriptions.plan_key matches.

-- 1. Tables
CREATE TABLE IF NOT EXISTS public.products (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_price_id        TEXT UNIQUE NOT NULL,
    name                   TEXT NOT NULL,
    -- When set, this product is the default catalog for the named plan_key.
    -- Lets us seed sensible defaults without real Stripe Price IDs.
    default_for_plan_key   TEXT UNIQUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.entitlements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         TEXT UNIQUE NOT NULL,
    description TEXT,
    -- 'boolean' for feature flags, 'limit' for numeric quotas.
    kind        TEXT NOT NULL DEFAULT 'limit'
                CHECK (kind IN ('boolean', 'limit'))
);

CREATE TABLE IF NOT EXISTS public.product_entitlements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES public.products(id)     ON DELETE CASCADE,
    entitlement_id  UUID NOT NULL REFERENCES public.entitlements(id) ON DELETE CASCADE,
    value           INTEGER NOT NULL DEFAULT 0,
    UNIQUE (product_id, entitlement_id)
);

CREATE INDEX IF NOT EXISTS idx_products_default_plan ON public.products(default_for_plan_key);
CREATE INDEX IF NOT EXISTS idx_product_entitlements_product ON public.product_entitlements(product_id);

-- 2. RLS — entitlement catalog is global / read-for-authenticated
ALTER TABLE public.products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products read"             ON public.products;
DROP POLICY IF EXISTS "entitlements read"         ON public.entitlements;
DROP POLICY IF EXISTS "product_entitlements read" ON public.product_entitlements;

CREATE POLICY "products read"
    ON public.products FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "entitlements read"
    ON public.entitlements FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "product_entitlements read"
    ON public.product_entitlements FOR SELECT
    USING (auth.role() = 'authenticated');

-- Writes happen only via service-role (no INSERT/UPDATE/DELETE policies).

-- 3. Resolver: returns the effective entitlement set for a tenant.
--    Strategy: prefer a product matched by stripe_price_id; fall back to the
--    default product for the subscription's plan_key; fall back to the global
--    "free" default product.
CREATE OR REPLACE FUNCTION public.tenant_entitlements(p_tenant_id UUID)
RETURNS TABLE (key TEXT, kind TEXT, value INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH active_sub AS (
        SELECT *
        FROM public.subscriptions
        WHERE tenant_id = p_tenant_id
        ORDER BY updated_at DESC
        LIMIT 1
    ),
    chosen_product AS (
        SELECT p.*
        FROM public.products p
        WHERE p.stripe_price_id = (SELECT stripe_price_id FROM active_sub)
        UNION ALL
        SELECT p.*
        FROM public.products p
        WHERE p.default_for_plan_key = COALESCE(
            (SELECT plan_key FROM active_sub),
            'free'
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.products p2
            WHERE p2.stripe_price_id = (SELECT stripe_price_id FROM active_sub)
        )
        LIMIT 1
    )
    SELECT e.key, e.kind, pe.value
    FROM chosen_product cp
    JOIN public.product_entitlements pe ON pe.product_id = cp.id
    JOIN public.entitlements e          ON e.id = pe.entitlement_id;
$$;

COMMENT ON FUNCTION public.tenant_entitlements(UUID) IS
    'Returns the resolved {key, kind, value} entitlement set for the given tenant. Prefers Stripe price match; falls back to default_for_plan_key, then to free.';

-- 4. Seed catalog of entitlement keys (matches current FeatureKey enum + numeric quotas)
INSERT INTO public.entitlements (key, description, kind) VALUES
    ('asset.register',       'Assets registrieren / einsiegeln',                  'boolean'),
    ('asset.verify',         'C2PA-Verifikation öffentlicher Assets',             'boolean'),
    ('watermark.apply',      'Wasserzeichen anwenden',                            'boolean'),
    ('barcode.issue',        'Barcodes ausstellen',                               'boolean'),
    ('provenance.basic',     'Basis-Herkunftsnachweis',                           'boolean'),
    ('provenance.advanced',  'Erweiterter Herkunftsnachweis (Forensik)',          'boolean'),
    ('c2pa.export',          'C2PA-Manifeste exportieren',                        'boolean'),
    ('team.members',         'Team-Funktionen / Mitgliederverwaltung',            'boolean'),
    ('api.access',           'API-Zugriff (programmierbare Schnittstelle)',       'boolean'),
    ('bulk.jobs',            'Massenverarbeitung / Batch-Jobs',                   'boolean'),
    ('compliance.export',    'Compliance-Exporte (DSGVO, AI Act)',                'boolean'),
    ('org.governance',       'Org-Governance (Audit-Logs, Rollenmatrix)',         'boolean'),
    ('sso.enabled',          'SSO / SAML',                                        'boolean'),
    ('public-sector.mode',   'Public-Sector-Modus (Behördenfeatures)',            'boolean'),
    -- Numeric quotas
    ('limit.active_assets',          'Maximale Anzahl aktiver Assets',            'limit'),
    ('limit.monthly_registrations',  'Asset-Registrierungen pro Monat',           'limit'),
    ('limit.team_seats',             'Inkludierte Team-Seats',                    'limit'),
    ('limit.api_calls_monthly',      'API-Calls pro Monat',                       'limit'),
    ('limit.bulk_jobs_monthly',      'Bulk-Jobs pro Monat',                       'limit'),
    ('limit.compliance_exports_monthly', 'Compliance-Exporte pro Monat',          'limit')
ON CONFLICT (key) DO NOTHING;

-- 5. Seed default products (one per current plan key) with sentinel stripe_price_ids.
--    Replace these with real Stripe Price IDs as products go live; the resolver
--    automatically prefers the real ID over the sentinel.
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key) VALUES
    ('internal_default_free',              'Free (default)',              'free'),
    ('internal_default_bronze',            'Bronze (default)',            'bronze'),
    ('internal_default_silver',            'Silver (default)',            'silver'),
    ('internal_default_gold',              'Gold (default)',              'gold'),
    ('internal_default_enterprise_public', 'Enterprise Public (default)', 'enterprise_public')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- 6. Seed bindings — the actual plan → feature/limit matrix.
--    Keep this CTE-style insert idempotent via NOT EXISTS guard.
WITH plan_def(plan_key, ent_key, val) AS (VALUES
    -- FREE
    ('free',              'asset.verify',                       1),
    ('free',              'limit.active_assets',                10),
    ('free',              'limit.monthly_registrations',        0),
    ('free',              'limit.team_seats',                   1),

    -- BRONZE
    ('bronze',            'asset.verify',                       1),
    ('bronze',            'asset.register',                     1),
    ('bronze',            'provenance.basic',                   1),
    ('bronze',            'limit.active_assets',                100),
    ('bronze',            'limit.monthly_registrations',        50),
    ('bronze',            'limit.team_seats',                   3),

    -- SILVER
    ('silver',            'asset.verify',                       1),
    ('silver',            'asset.register',                     1),
    ('silver',            'provenance.basic',                   1),
    ('silver',            'watermark.apply',                    1),
    ('silver',            'barcode.issue',                      1),
    ('silver',            'c2pa.export',                        1),
    ('silver',            'team.members',                       1),
    ('silver',            'limit.active_assets',                1000),
    ('silver',            'limit.monthly_registrations',        500),
    ('silver',            'limit.team_seats',                   10),
    ('silver',            'limit.api_calls_monthly',            5000),

    -- GOLD
    ('gold',              'asset.verify',                       1),
    ('gold',              'asset.register',                     1),
    ('gold',              'provenance.basic',                   1),
    ('gold',              'provenance.advanced',                1),
    ('gold',              'watermark.apply',                    1),
    ('gold',              'barcode.issue',                      1),
    ('gold',              'c2pa.export',                        1),
    ('gold',              'team.members',                       1),
    ('gold',              'api.access',                         1),
    ('gold',              'bulk.jobs',                          1),
    ('gold',              'compliance.export',                  1),
    ('gold',              'limit.active_assets',                10000),
    ('gold',              'limit.monthly_registrations',        5000),
    ('gold',              'limit.team_seats',                   25),
    ('gold',              'limit.api_calls_monthly',            50000),
    ('gold',              'limit.bulk_jobs_monthly',            100),
    ('gold',              'limit.compliance_exports_monthly',   10),

    -- ENTERPRISE PUBLIC — most features unlimited (-1)
    ('enterprise_public', 'asset.verify',                       1),
    ('enterprise_public', 'asset.register',                     1),
    ('enterprise_public', 'provenance.basic',                   1),
    ('enterprise_public', 'provenance.advanced',                1),
    ('enterprise_public', 'watermark.apply',                    1),
    ('enterprise_public', 'barcode.issue',                      1),
    ('enterprise_public', 'c2pa.export',                        1),
    ('enterprise_public', 'team.members',                       1),
    ('enterprise_public', 'api.access',                         1),
    ('enterprise_public', 'bulk.jobs',                          1),
    ('enterprise_public', 'compliance.export',                  1),
    ('enterprise_public', 'org.governance',                     1),
    ('enterprise_public', 'sso.enabled',                        1),
    ('enterprise_public', 'public-sector.mode',                 1),
    ('enterprise_public', 'limit.active_assets',               -1),
    ('enterprise_public', 'limit.monthly_registrations',       -1),
    ('enterprise_public', 'limit.team_seats',                  -1),
    ('enterprise_public', 'limit.api_calls_monthly',           -1),
    ('enterprise_public', 'limit.bulk_jobs_monthly',           -1),
    ('enterprise_public', 'limit.compliance_exports_monthly',  -1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
FROM plan_def pd
JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;

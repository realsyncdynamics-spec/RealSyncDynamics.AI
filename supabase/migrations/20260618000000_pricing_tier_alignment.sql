-- Pricing-Tier-Alignment: bringt public.products in Übereinstimmung mit der
-- Marketing-Pricing-Config (src/config/pricing.ts) und der Runtime-
-- Feature-Matrix (src/lib/billing/planAccess.ts).
--
-- Hintergrund:
--   Der ursprüngliche Entitlements-Seed (20260430200000) lieferte die
--   alten Plan-Keys bronze/silver/gold/enterprise_public. Das Produkt
--   ist inzwischen auf das 5-Tier-SaaS-Modell starter/growth/agency/
--   scale + enterprise umgestellt (Agentur- und Multi-Site-Fokus).
--
-- Diese Migration ist rein additiv:
--   1. Erweitert den Entitlement-Katalog um Keys, die die neuen Tiers
--      brauchen (limit.domains, whitelabel.reports, webhooks.enabled,
--      monitoring.daily etc.).
--   2. Legt Sentinel-Produktzeilen für starter/growth/agency/scale/
--      enterprise an, damit stripe-checkout nicht mehr mit
--      PRICE_NOT_CONFIGURED bricht. Sobald in Stripe echte Prices
--      angelegt sind, ersetzt Ops die Sentinel-IDs:
--        UPDATE public.products
--           SET stripe_price_id = 'price_xxx'
--         WHERE default_for_plan_key = 'starter';
--      Der Resolver in tenant_entitlements() bevorzugt automatisch die
--      echte Stripe-ID gegenüber dem Sentinel.
--   3. Seedet Plan × Entitlement-Bindings analog zur Feature-Matrix in
--      planAccess.ts, sodass tenant_entitlements() korrekte Quotas
--      liefert.
--
-- Die Legacy-Plan-Keys bronze/silver/gold/enterprise_public bleiben
-- unangetastet — Bestandskunden auf diesen Plänen behalten ihre
-- Entitlements.

-- 1. Entitlement-Katalog erweitern
INSERT INTO public.entitlements (key, description, kind) VALUES
    ('limit.domains',            'Maximale Anzahl überwachter Domains',        'limit'),
    ('monitoring.daily',         'Tägliches Re-Scan-Monitoring',               'boolean'),
    ('monitoring.drift',         'Drift-Detection zwischen Scans',             'boolean'),
    ('monitoring.monthly',       'Monatlicher Re-Scan',                        'boolean'),
    ('whitelabel.reports',       'White-Label-Reports mit eigenem Logo',       'boolean'),
    ('whitelabel.dashboard',     'White-Label-Dashboard (eigene Subdomain)',   'boolean'),
    ('webhooks.enabled',         'Webhooks für CI/CD-Integration',             'boolean'),
    ('sla.priority',             'Priority-Support / SLA',                     'boolean'),
    ('dse.generator',            'DSE-Generator (Datenschutzerklärung)',       'boolean'),
    ('fix.snippets',             'Fix-Empfehlungen mit Code-Snippets',         'boolean'),
    ('alerts.email',             'E-Mail-Alerts bei neuen Findings',           'boolean')
ON CONFLICT (key) DO NOTHING;

-- 2. Sentinel-Produkte für die neuen Plan-Keys
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key) VALUES
    ('internal_default_starter',    'Starter (default)',    'starter'),
    ('internal_default_growth',     'Growth (default)',     'growth'),
    ('internal_default_agency',     'Agency (default)',     'agency'),
    ('internal_default_scale',      'Scale (default)',      'scale'),
    ('internal_default_enterprise', 'Enterprise (default)', 'enterprise')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- 3. Plan × Entitlement-Bindings (spiegelt src/lib/billing/planAccess.ts
--    und die Bullet-Listen aus src/config/pricing.ts)
WITH plan_def(plan_key, ent_key, val) AS (VALUES
    -- STARTER (79 €/Monat · 1 Domain · monatlicher Scan)
    ('starter',    'asset.verify',                       1),
    ('starter',    'monitoring.monthly',                 1),
    ('starter',    'dse.generator',                      1),
    ('starter',    'alerts.email',                       1),
    ('starter',    'compliance.export',                  1),
    ('starter',    'limit.domains',                      1),
    ('starter',    'limit.team_seats',                   3),
    ('starter',    'limit.compliance_exports_monthly',   5),

    -- GROWTH (249 €/Monat · 3 Domains · tägliches Monitoring · Fix-Snippets)
    ('growth',     'asset.verify',                       1),
    ('growth',     'asset.register',                     1),
    ('growth',     'monitoring.monthly',                 1),
    ('growth',     'monitoring.daily',                   1),
    ('growth',     'monitoring.drift',                   1),
    ('growth',     'dse.generator',                      1),
    ('growth',     'fix.snippets',                       1),
    ('growth',     'alerts.email',                       1),
    ('growth',     'compliance.export',                  1),
    ('growth',     'team.members',                       1),
    ('growth',     'limit.domains',                      3),
    ('growth',     'limit.team_seats',                   5),
    ('growth',     'limit.api_calls_monthly',            5000),
    ('growth',     'limit.compliance_exports_monthly',   20),

    -- AGENCY (699 €/Monat · 10 Domains · White-Label · API + Webhooks)
    ('agency',     'asset.verify',                       1),
    ('agency',     'asset.register',                     1),
    ('agency',     'monitoring.monthly',                 1),
    ('agency',     'monitoring.daily',                   1),
    ('agency',     'monitoring.drift',                   1),
    ('agency',     'dse.generator',                      1),
    ('agency',     'fix.snippets',                       1),
    ('agency',     'alerts.email',                       1),
    ('agency',     'compliance.export',                  1),
    ('agency',     'team.members',                       1),
    ('agency',     'api.access',                         1),
    ('agency',     'webhooks.enabled',                   1),
    ('agency',     'whitelabel.reports',                 1),
    ('agency',     'bulk.jobs',                          1),
    ('agency',     'sla.priority',                       1),
    ('agency',     'limit.domains',                      10),
    ('agency',     'limit.team_seats',                   15),
    ('agency',     'limit.api_calls_monthly',            25000),
    ('agency',     'limit.bulk_jobs_monthly',            50),
    ('agency',     'limit.compliance_exports_monthly',   100),

    -- SCALE (1.999 €/Monat · 50 Mandanten · eigene Subdomain · voller API)
    ('scale',      'asset.verify',                       1),
    ('scale',      'asset.register',                     1),
    ('scale',      'monitoring.monthly',                 1),
    ('scale',      'monitoring.daily',                   1),
    ('scale',      'monitoring.drift',                   1),
    ('scale',      'dse.generator',                      1),
    ('scale',      'fix.snippets',                       1),
    ('scale',      'alerts.email',                       1),
    ('scale',      'compliance.export',                  1),
    ('scale',      'team.members',                       1),
    ('scale',      'api.access',                         1),
    ('scale',      'webhooks.enabled',                   1),
    ('scale',      'whitelabel.reports',                 1),
    ('scale',      'whitelabel.dashboard',               1),
    ('scale',      'bulk.jobs',                          1),
    ('scale',      'sla.priority',                       1),
    ('scale',      'org.governance',                     1),
    ('scale',      'limit.domains',                      50),
    ('scale',      'limit.team_seats',                   50),
    ('scale',      'limit.api_calls_monthly',            100000),
    ('scale',      'limit.bulk_jobs_monthly',            500),
    ('scale',      'limit.compliance_exports_monthly',   500),

    -- ENTERPRISE (individuell · unlimited · dedicated runtime)
    ('enterprise', 'asset.verify',                       1),
    ('enterprise', 'asset.register',                     1),
    ('enterprise', 'monitoring.monthly',                 1),
    ('enterprise', 'monitoring.daily',                   1),
    ('enterprise', 'monitoring.drift',                   1),
    ('enterprise', 'dse.generator',                      1),
    ('enterprise', 'fix.snippets',                       1),
    ('enterprise', 'alerts.email',                       1),
    ('enterprise', 'compliance.export',                  1),
    ('enterprise', 'team.members',                       1),
    ('enterprise', 'api.access',                         1),
    ('enterprise', 'webhooks.enabled',                   1),
    ('enterprise', 'whitelabel.reports',                 1),
    ('enterprise', 'whitelabel.dashboard',               1),
    ('enterprise', 'bulk.jobs',                          1),
    ('enterprise', 'sla.priority',                       1),
    ('enterprise', 'org.governance',                     1),
    ('enterprise', 'sso.enabled',                        1),
    ('enterprise', 'provenance.advanced',                1),
    ('enterprise', 'limit.domains',                      -1),
    ('enterprise', 'limit.team_seats',                   -1),
    ('enterprise', 'limit.api_calls_monthly',            -1),
    ('enterprise', 'limit.bulk_jobs_monthly',            -1),
    ('enterprise', 'limit.compliance_exports_monthly',   -1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
FROM plan_def pd
JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;

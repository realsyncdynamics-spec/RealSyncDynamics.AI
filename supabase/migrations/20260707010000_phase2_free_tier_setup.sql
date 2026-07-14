-- Phase 2: Free-Tier Dashboard + Adaptive Setup
-- Adds tenant_type, trial tracking, and free-tier entitlements

-- 1. Add tenant_type column (org classification for adaptive UI)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS tenant_type TEXT
    DEFAULT 'unknown'
    CHECK (tenant_type IN ('freelancer', 'sme', 'agency', 'enterprise', 'unknown'));

-- 2. Track trial status
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- 3. Add org metadata for adaptive messaging
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS org_name TEXT;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS org_size_employees INTEGER;

-- 4. Create entitlements for free tier (if not already seeded)
INSERT INTO public.entitlements (key, description, kind) VALUES
  ('website.scan', 'Website-Compliance-Scan durchführen', 'boolean'),
  ('website.scan_monthly_limit', 'Monatliche Scan-Limits', 'limit'),
  ('reports.export', 'Compliance-Reports exportieren', 'boolean'),
  ('dashboard.access', 'Zugriff auf Governance-Dashboard', 'boolean'),
  ('ai_classification.limited', 'AI-Act-Klassifizierung (limitiert)', 'boolean'),
  ('evidence.basic_vault', 'Evidence Vault (Basic)', 'boolean'),
  ('governance.dsgvo_directory', 'DSGVO-Verzeichnis', 'boolean'),
  ('governance.ai_register', 'AI-System-Verzeichnis', 'boolean'),
  ('bots.count', 'Anzahl Governance-Bots', 'limit')
ON CONFLICT (key) DO NOTHING;

-- 5. Add free-tier product with default_for_plan_key
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('internal_free_tier', 'Free Tier (Dashboard)', 'free_tier')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- 6. Seed free-tier entitlements (what free users get)
WITH product_data AS (
  SELECT id FROM public.products WHERE default_for_plan_key = 'free_tier'
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT
  p.id,
  e.id,
  CASE e.key
    WHEN 'dashboard.access' THEN 1
    WHEN 'website.scan' THEN 1
    WHEN 'website.scan_monthly_limit' THEN 3
    WHEN 'reports.export' THEN 0
    WHEN 'ai_classification.limited' THEN 0
    WHEN 'evidence.basic_vault' THEN 1
    WHEN 'governance.dsgvo_directory' THEN 1
    WHEN 'governance.ai_register' THEN 1
    WHEN 'bots.count' THEN 0
  END
FROM product_data p
CROSS JOIN public.entitlements e
WHERE e.key IN (
  'dashboard.access', 'website.scan', 'website.scan_monthly_limit',
  'reports.export', 'ai_classification.limited', 'evidence.basic_vault',
  'governance.dsgvo_directory', 'governance.ai_register', 'bots.count'
)
ON CONFLICT (product_id, entitlement_id) DO NOTHING;

-- 7. Comment on new columns for documentation
COMMENT ON COLUMN public.tenants.tenant_type IS 'Organization type: freelancer, sme, agency, or enterprise. Used for adaptive UI.';
COMMENT ON COLUMN public.tenants.trial_expires_at IS 'When trial period ends. NULL = no trial or trial passed. Used with subscriptions.trial_ends_at.';
COMMENT ON COLUMN public.tenants.onboarded_at IS 'When user completed SetupAssistant. NULL = not yet onboarded.';
COMMENT ON COLUMN public.tenants.org_name IS 'Organization name for display in dashboard.';
COMMENT ON COLUMN public.tenants.org_size_employees IS 'Employee count, used for org type inference and adaptive messaging.';

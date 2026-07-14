-- Partner Provisioning API
--
-- Enables resellers/agencies to provision white-label tenant instances programmatically.
-- Partners authenticate with API keys and can create up to N tenants per month.
-- Each provisioned tenant gets custom branding, domain, and billing passthrough.

BEGIN;

-- 1. Partners table (resellers, agencies, white-label distributors)
CREATE TABLE IF NOT EXISTS public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,

  -- API authentication
  api_key_hash TEXT NOT NULL UNIQUE,
  api_key_prefix TEXT NOT NULL UNIQUE,

  -- Billing & revenue sharing
  stripe_connect_account_id TEXT,
  revenue_share_percent NUMERIC(5, 2) NOT NULL DEFAULT 30.0 CHECK (revenue_share_percent >= 0 AND revenue_share_percent <= 100),

  -- Rate limiting
  max_tenants_per_month INT NOT NULL DEFAULT 100 CHECK (max_tenants_per_month > 0),

  -- Status
  enabled BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_api_key_hash ON public.partners(api_key_hash) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_partners_stripe_connect ON public.partners(stripe_connect_account_id) WHERE stripe_connect_account_id IS NOT NULL;

COMMENT ON TABLE public.partners IS 'Resellers, agencies, white-label partners who can provision tenants via API';

-- 2. Partner provisioning quota (monthly rate limit tracking)
CREATE TABLE IF NOT EXISTS public.partner_provisioning_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  year_month DATE NOT NULL, -- e.g., 2026-07-01
  tenants_provisioned INT NOT NULL DEFAULT 0,

  UNIQUE(partner_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_partner_quota_year_month ON public.partner_provisioning_quota(year_month);

COMMENT ON TABLE public.partner_provisioning_quota IS 'Tracks monthly provisioning quota usage per partner for rate limiting';

-- 3. Extend tenants table with partner branding
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS partner_id UUID;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS brand_colors JSONB;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS custom_logo_url TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS auto_invoice_passthrough BOOLEAN;

-- Add defaults
DO $$
BEGIN
  ALTER TABLE public.tenants ALTER COLUMN brand_colors SET DEFAULT '{}'::jsonb;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.tenants ALTER COLUMN auto_invoice_passthrough SET DEFAULT false;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  ALTER TABLE public.tenants ADD CONSTRAINT tenants_partner_id_fk FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenants_partner_id ON public.tenants(partner_id);
-- Partial unique index on custom_domain (allows NULL, prevents duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_custom_domain_unique ON public.tenants(custom_domain) WHERE custom_domain IS NOT NULL;

-- 4. RLS Policies for partners (service-role only)
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_provisioning_quota ENABLE ROW LEVEL SECURITY;

-- Partners: service-role only (API key validation in functions)
CREATE POLICY partners_service_role_all ON public.partners
  FOR ALL TO service_role USING (true);

CREATE POLICY partner_quota_service_role_all ON public.partner_provisioning_quota
  FOR ALL TO service_role USING (true);

-- 5. Helper: validate partner API key and return partner_id
CREATE OR REPLACE FUNCTION public.partner_validate_key(p_key TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_hash TEXT;
  v_partner_id UUID;
BEGIN
  v_hash := encode(extensions.digest(p_key, 'sha256'), 'hex');
  SELECT id INTO v_partner_id
  FROM public.partners
  WHERE api_key_hash = v_hash AND enabled = true
  LIMIT 1;
  RETURN v_partner_id;
END;
$$;

REVOKE ALL ON FUNCTION public.partner_validate_key(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_validate_key(TEXT) TO anon, authenticated, service_role;

-- 6. Helper: get current month's provisioning quota for partner
CREATE OR REPLACE FUNCTION public.partner_get_quota_used(p_partner_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_used INT;
BEGIN
  SELECT COALESCE(tenants_provisioned, 0) INTO v_used
  FROM public.partner_provisioning_quota
  WHERE partner_id = p_partner_id
    AND year_month = DATE_TRUNC('month', NOW())::date;

  RETURN COALESCE(v_used, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.partner_get_quota_used(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_get_quota_used(UUID) TO anon, authenticated, service_role;

-- 7. Helper: increment monthly provisioning quota
CREATE OR REPLACE FUNCTION public.partner_increment_quota(p_partner_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.partner_provisioning_quota (partner_id, year_month, tenants_provisioned)
  VALUES (p_partner_id, DATE_TRUNC('month', NOW())::date, 1)
  ON CONFLICT (partner_id, year_month)
  DO UPDATE SET tenants_provisioned = tenants_provisioned + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.partner_increment_quota(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_increment_quota(UUID) TO anon, authenticated, service_role;

COMMIT;

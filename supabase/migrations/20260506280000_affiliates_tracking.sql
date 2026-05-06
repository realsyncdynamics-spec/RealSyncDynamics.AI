-- Affiliates: Partner-Programm via /agencies. Revenue-Share 30%.

CREATE TABLE IF NOT EXISTS public.affiliates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE CHECK (length(code) BETWEEN 3 AND 32),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  company         TEXT,
  commission_pct  INTEGER NOT NULL DEFAULT 30 CHECK (commission_pct BETWEEN 0 AND 100),
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_leads ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.gdpr_audits ADD COLUMN IF NOT EXISTS referral_code TEXT;

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliates super_admin_all" ON public.affiliates;
CREATE POLICY "affiliates super_admin_all"
  ON public.affiliates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true));

CREATE OR REPLACE FUNCTION public.affiliate_validate(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.affiliates WHERE code = p_code AND active = true);
$$;

REVOKE ALL ON FUNCTION public.affiliate_validate(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.affiliate_validate(TEXT) TO anon, authenticated;

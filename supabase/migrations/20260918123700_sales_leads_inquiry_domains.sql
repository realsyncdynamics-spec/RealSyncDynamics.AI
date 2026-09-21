-- Inquiry-Funnel: first-class domain fields for Enterprise/Partner sales leads.
-- Additive only — existing rows keep NULL / empty arrays; metadata.plan_key remains
-- the plan carrier (tier stays as optional alias in JSONB).

ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS company_domain TEXT,
  ADD COLUMN IF NOT EXISTS domains TEXT[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.sales_leads.company_domain IS
  'Primary company domain for inquiry leads (normalized host, no scheme/path).';

COMMENT ON COLUMN public.sales_leads.domains IS
  'Optional related domains for Enterprise/Partner inquiry (normalized hosts).';

CREATE INDEX IF NOT EXISTS idx_sales_leads_company_domain
  ON public.sales_leads (company_domain)
  WHERE company_domain IS NOT NULL;

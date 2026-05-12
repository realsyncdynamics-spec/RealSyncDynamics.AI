-- Conversion-Intelligence columns: track which audit findings → paying customers.
-- Purely additive; no destructive changes, no FK churn.
--
-- Applied to ebljyceifhnlzhjfyxup on 2026-05-11 via supabase MCP apply_migration.

ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS converted_at      timestamptz,
  ADD COLUMN IF NOT EXISTS conversion_value  numeric(12,2);

ALTER TABLE public.gdpr_audits
  ADD COLUMN IF NOT EXISTS conversion_score  integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS sales_leads_converted_at_idx
  ON public.sales_leads (converted_at DESC NULLS LAST)
  WHERE converted_at IS NOT NULL;

COMMENT ON COLUMN public.sales_leads.converted_at IS
  'Set when the lead resulted in a paid Stripe checkout. Populated by stripe-webhook on checkout.session.completed.';
COMMENT ON COLUMN public.sales_leads.conversion_value IS
  'Realized revenue in EUR (or session currency) from the converted lead.';
COMMENT ON COLUMN public.gdpr_audits.conversion_score IS
  'Backfilled correlation score: how predictive this audit was of a downstream conversion. 0 = neutral, positive = converted.';

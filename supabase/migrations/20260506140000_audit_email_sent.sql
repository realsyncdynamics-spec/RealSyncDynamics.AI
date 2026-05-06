-- Add email_sent_at to gdpr_audits to make audit-report-email idempotent.

ALTER TABLE public.gdpr_audits
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_gdpr_audits_email_unsent
  ON public.gdpr_audits(created_at)
  WHERE email_sent_at IS NULL;

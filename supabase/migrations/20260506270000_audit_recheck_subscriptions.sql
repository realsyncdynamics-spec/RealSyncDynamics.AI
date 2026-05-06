-- Audit-Auto-Recheck: User-opted-in wöchentliche Re-Scans für Score-Drift-Alerts.

CREATE TABLE IF NOT EXISTS public.audit_recheck_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  domain        TEXT NOT NULL,
  url           TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  last_audit_id UUID REFERENCES public.gdpr_audits(id) ON DELETE SET NULL,
  last_score    INTEGER,
  last_run_at   TIMESTAMPTZ,
  next_run_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  unsub_token   UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_recheck_email_domain
  ON public.audit_recheck_subscriptions (lower(email), lower(domain))
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_audit_recheck_next_run
  ON public.audit_recheck_subscriptions (next_run_at)
  WHERE active = true;

ALTER TABLE public.audit_recheck_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_recheck super_admin_read" ON public.audit_recheck_subscriptions;
CREATE POLICY "audit_recheck super_admin_read"
  ON public.audit_recheck_subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true));

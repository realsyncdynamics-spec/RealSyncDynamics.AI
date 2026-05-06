-- DSGVO-Audit-Reports — Lead-Magnet auf /audit.
--
-- Public POST endpoint speichert pro Submission ein Report-Row + duplicates
-- email als qualifizierten Lead in sales_leads (mit source='audit_lp').
-- Rate-Limit: 5 Submissions pro IP-Hash pro Stunde (gleiches Pattern wie sales-lead).

CREATE TABLE IF NOT EXISTS public.gdpr_audits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url             TEXT NOT NULL,
    domain          TEXT NOT NULL,                  -- normalized hostname
    email           TEXT NOT NULL,
    company         TEXT,                            -- optional, from form
    score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    severity        TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'pass')),
    issues          JSONB NOT NULL DEFAULT '[]'::jsonb,
                     -- [{ id, severity, title, detail, paragraph_ref }]
    fetched_status  INTEGER,                         -- HTTP status of target
    fetched_html_bytes INTEGER,
    fetched_at      TIMESTAMPTZ,
    fetch_error     TEXT,
    user_agent      TEXT,
    ip_hash         TEXT NOT NULL,
    sales_lead_id   UUID REFERENCES public.sales_leads(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gdpr_audits_email     ON public.gdpr_audits(lower(email));
CREATE INDEX IF NOT EXISTS idx_gdpr_audits_domain    ON public.gdpr_audits(domain);
CREATE INDEX IF NOT EXISTS idx_gdpr_audits_score     ON public.gdpr_audits(score);
CREATE INDEX IF NOT EXISTS idx_gdpr_audits_created   ON public.gdpr_audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gdpr_audits_ip        ON public.gdpr_audits(ip_hash, created_at);

ALTER TABLE public.gdpr_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gdpr_audits super_admin_read" ON public.gdpr_audits;
CREATE POLICY "gdpr_audits super_admin_read"
    ON public.gdpr_audits FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_super_admin = true
    ));

-- INSERT/DELETE only via service_role (Edge Function gdpr-audit).

COMMENT ON TABLE public.gdpr_audits IS
  'Lead-magnet GDPR audit reports. Public submit, super_admin read for outbound prio.';

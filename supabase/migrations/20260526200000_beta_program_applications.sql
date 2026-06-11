-- Beta-Programm — strukturierte Bewerbungen für die 5 Founding Beta Plätze.
--
-- Eigene Tabelle (separat zu enterprise_founders_access mit 100er-Cap),
-- weil die Bewerbung mehr Felder erhebt: Branche, Anzahl Websites,
-- aktueller Stack, DSGVO-/AI-Act-Probleme, Motivation. Status-Workflow:
-- pending → approved | rejected; approved wird beim Onboarding aktiv.
--
-- RLS aktiv. Inserts laufen über die Edge-Function mit Service-Role-Key —
-- kein anon-Insert, wie bei founding-access / sales-leads.

BEGIN;

CREATE TABLE IF NOT EXISTS public.beta_program_applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  company_name        TEXT NOT NULL,
  contact_name        TEXT NOT NULL,
  contact_email       TEXT NOT NULL,
  industry            TEXT,
  website_count       INTEGER,
  current_stack       TEXT,
  pain_points         TEXT,
  motivation          TEXT,

  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'active')),
  approved_at         TIMESTAMPTZ,
  access_expires_at   TIMESTAMPTZ,
  notes               TEXT,

  CONSTRAINT beta_program_applications_website_count_nonneg
    CHECK (website_count IS NULL OR website_count >= 0)
);

CREATE INDEX IF NOT EXISTS beta_program_applications_status_idx
  ON public.beta_program_applications(status);
CREATE INDEX IF NOT EXISTS beta_program_applications_created_idx
  ON public.beta_program_applications(created_at DESC);

ALTER TABLE public.beta_program_applications ENABLE ROW LEVEL SECURITY;

-- Kein anon/auth Policy — Inserts laufen ausschließlich über die
-- Edge-Function mit Service-Role-Key (RLS-Bypass). Reads erfolgen über
-- die Super-Admin-Konsole, die ihre eigenen Policies mitbringt
-- (analog zu sales_leads / enterprise_feedback_reports).

COMMIT;

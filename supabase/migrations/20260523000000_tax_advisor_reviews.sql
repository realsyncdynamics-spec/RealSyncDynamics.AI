-- Steuerberater Review Layer — tracks the review workflow between the
-- requester (Geschäftsführung / Owner) and an external Steuerberater
-- for artefacts produced by the Tax Evidence Runtime (e.g. evidence
-- export packages, Jahresabschluss drafts).
--
-- Positioning (locked into the schema via comments + UI copy):
-- Dieses Modell DOKUMENTIERT einen Workflow. Es generiert KEINE
-- steuerliche Bewertung, ersetzt keine Steuerberatung und übermittelt
-- keine verbindlichen Aussagen. Der Steuerberater liefert seine Aussagen
-- offline; der Requester transkribiert sie in den Kommentar-Thread.

BEGIN;

-- ── tax_advisor_reviews ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tax_advisor_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  subject_type      TEXT NOT NULL
                      CHECK (subject_type IN ('tax_evidence_export','tax_year','annual_financials')),
  subject_id        UUID NOT NULL,                              -- loose FK by type

  title             TEXT NOT NULL,
  notes             TEXT,                                       -- context the requester writes

  assigned_to_name  TEXT,                                       -- Steuerberater / Kanzlei
  assigned_to_email TEXT,                                       -- contact email; NOT a platform user FK
                                                                -- intentionally — Steuerberater needn't have an account

  status            TEXT NOT NULL DEFAULT 'requested'
                      CHECK (status IN ('requested','in_review','confirmed','rejected','completed')),

  requested_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tax_advisor_reviews_tenant_idx  ON public.tax_advisor_reviews (tenant_id);
CREATE INDEX IF NOT EXISTS tax_advisor_reviews_subject_idx ON public.tax_advisor_reviews (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS tax_advisor_reviews_status_idx  ON public.tax_advisor_reviews (status);

-- ── tax_advisor_review_comments ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tax_advisor_review_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  review_id       UUID NOT NULL REFERENCES public.tax_advisor_reviews(id) ON DELETE CASCADE,
  author_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_label    TEXT NOT NULL                                 -- "owner" | "steuerberater" | "system"
                    CHECK (author_label IN ('owner','steuerberater','system')),
  body            TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tax_advisor_review_comments_review_idx
  ON public.tax_advisor_review_comments (review_id, created_at);
CREATE INDEX IF NOT EXISTS tax_advisor_review_comments_tenant_idx
  ON public.tax_advisor_review_comments (tenant_id);

-- ── RLS ───────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['tax_advisor_reviews','tax_advisor_review_comments'])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   t || '_tenant_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         USING (tenant_id IN (
           SELECT m.tenant_id FROM public.memberships m
           WHERE m.user_id = auth.uid()
         ))
         WITH CHECK (tenant_id IN (
           SELECT m.tenant_id FROM public.memberships m
           WHERE m.user_id = auth.uid()
         ))',
      t || '_tenant_isolation', t);
  END LOOP;
END $$;

-- ── Updated-at trigger on tax_advisor_reviews ─────────────────────
-- Reuses fn_tax_touch_updated_at from PR #238.
DROP TRIGGER IF EXISTS trg_tax_advisor_reviews_touch ON public.tax_advisor_reviews;
CREATE TRIGGER trg_tax_advisor_reviews_touch
  BEFORE UPDATE ON public.tax_advisor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.fn_tax_touch_updated_at();

COMMIT;

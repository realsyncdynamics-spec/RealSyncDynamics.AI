-- PR A (#1806): Free-Audit Marketing-Consent columns ONLY.
--
-- Additive columns on sales_leads + gdpr_audits. Server-owned proof fields
-- via BEFORE INSERT/UPDATE triggers. Deliberately does NOT touch follow-up
-- drip tables or drip RPCs (live ledger/object mismatch would make
-- check_function_bodies fail and roll back db push).
--
-- Idempotent. RLS unchanged: no anon/authenticated INSERT/UPDATE policies
-- on these tables (service_role / super_admin only as before).

-- ── 1. Columns ──────────────────────────────────────────────────────────────

ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent_text_version text,
  ADD COLUMN IF NOT EXISTS marketing_consent_revoked_at timestamptz;

ALTER TABLE public.gdpr_audits
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent_text_version text,
  ADD COLUMN IF NOT EXISTS marketing_consent_revoked_at timestamptz;

COMMENT ON COLUMN public.sales_leads.marketing_consent IS
  'Explicit Free-Audit follow-up/marketing opt-in. Default false.';
COMMENT ON COLUMN public.sales_leads.marketing_consent_at IS
  'Server-set consent timestamp (BEFORE INSERT/UPDATE trigger). Never trust client.';
COMMENT ON COLUMN public.sales_leads.marketing_consent_text_version IS
  'Allowlisted wording id: audit_followup_v1_de | audit_followup_v1_en.';
COMMENT ON COLUMN public.sales_leads.marketing_consent_revoked_at IS
  'Sticky revocation timestamp; once set, never cleared. On revoke, marketing_consent stays true (proof) and this is set. Every send/due gate MUST require marketing_consent AND marketing_consent_revoked_at IS NULL.';

COMMENT ON COLUMN public.gdpr_audits.marketing_consent IS
  'Explicit Free-Audit follow-up/marketing opt-in. Default false.';
COMMENT ON COLUMN public.gdpr_audits.marketing_consent_at IS
  'Server-set consent timestamp (BEFORE INSERT/UPDATE trigger). Never trust client.';
COMMENT ON COLUMN public.gdpr_audits.marketing_consent_text_version IS
  'Allowlisted wording id: audit_followup_v1_de | audit_followup_v1_en.';
COMMENT ON COLUMN public.gdpr_audits.marketing_consent_revoked_at IS
  'Sticky revocation timestamp; once set, never cleared. On revoke, marketing_consent stays true (proof) and this is set. Every send/due gate MUST require marketing_consent AND marketing_consent_revoked_at IS NULL.';

-- ── 2. CHECK constraints (proof + allowlist) ────────────────────────────────

ALTER TABLE public.sales_leads
  DROP CONSTRAINT IF EXISTS sales_leads_marketing_consent_proof_chk;
ALTER TABLE public.sales_leads
  ADD CONSTRAINT sales_leads_marketing_consent_proof_chk
  CHECK (
    marketing_consent = false
    OR (
      marketing_consent_at IS NOT NULL
      AND marketing_consent_text_version IS NOT NULL
    )
  );

ALTER TABLE public.sales_leads
  DROP CONSTRAINT IF EXISTS sales_leads_marketing_consent_version_chk;
ALTER TABLE public.sales_leads
  ADD CONSTRAINT sales_leads_marketing_consent_version_chk
  CHECK (
    marketing_consent_text_version IS NULL
    OR marketing_consent_text_version IN ('audit_followup_v1_de', 'audit_followup_v1_en')
  );

ALTER TABLE public.gdpr_audits
  DROP CONSTRAINT IF EXISTS gdpr_audits_marketing_consent_proof_chk;
ALTER TABLE public.gdpr_audits
  ADD CONSTRAINT gdpr_audits_marketing_consent_proof_chk
  CHECK (
    marketing_consent = false
    OR (
      marketing_consent_at IS NOT NULL
      AND marketing_consent_text_version IS NOT NULL
    )
  );

ALTER TABLE public.gdpr_audits
  DROP CONSTRAINT IF EXISTS gdpr_audits_marketing_consent_version_chk;
ALTER TABLE public.gdpr_audits
  ADD CONSTRAINT gdpr_audits_marketing_consent_version_chk
  CHECK (
    marketing_consent_text_version IS NULL
    OR marketing_consent_text_version IN ('audit_followup_v1_de', 'audit_followup_v1_en')
  );

CREATE INDEX IF NOT EXISTS idx_sales_leads_marketing_consent_false
  ON public.sales_leads (created_at)
  WHERE marketing_consent = false;

CREATE INDEX IF NOT EXISTS idx_gdpr_audits_marketing_consent_true
  ON public.gdpr_audits (created_at)
  WHERE marketing_consent = true AND marketing_consent_revoked_at IS NULL;

-- ── 3. BEFORE INSERT — server timestamp + allowlist; strip proof if false ───

CREATE OR REPLACE FUNCTION public.marketing_consent_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Revocation cannot be forged on INSERT; only UPDATE may set it.
  NEW.marketing_consent_revoked_at := NULL;

  IF NEW.marketing_consent IS TRUE THEN
    IF NEW.marketing_consent_text_version IS NULL
       OR NEW.marketing_consent_text_version NOT IN (
         'audit_followup_v1_de',
         'audit_followup_v1_en'
       ) THEN
      RAISE EXCEPTION 'marketing_consent_text_version must be audit_followup_v1_de or audit_followup_v1_en'
        USING ERRCODE = '23514';
    END IF;
    -- Always server clock; ignore any client-supplied timestamp.
    NEW.marketing_consent_at := pg_catalog.now();
  ELSE
    NEW.marketing_consent := false;
    NEW.marketing_consent_at := NULL;
    NEW.marketing_consent_text_version := NULL;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.marketing_consent_before_insert() IS
  'PR A (#1806): server-owns marketing_consent_at; allowlists text_version.';

REVOKE ALL ON FUNCTION public.marketing_consent_before_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marketing_consent_before_insert() FROM anon;
REVOKE ALL ON FUNCTION public.marketing_consent_before_insert() FROM authenticated;

DROP TRIGGER IF EXISTS trg_sales_leads_marketing_consent_bi ON public.sales_leads;
CREATE TRIGGER trg_sales_leads_marketing_consent_bi
  BEFORE INSERT ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.marketing_consent_before_insert();

DROP TRIGGER IF EXISTS trg_gdpr_audits_marketing_consent_bi ON public.gdpr_audits;
CREATE TRIGGER trg_gdpr_audits_marketing_consent_bi
  BEFORE INSERT ON public.gdpr_audits
  FOR EACH ROW
  EXECUTE FUNCTION public.marketing_consent_before_insert();

-- ── 4. BEFORE UPDATE — proof immutable; revocation sticky ───────────────────

CREATE OR REPLACE FUNCTION public.marketing_consent_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Consent is INSERT-only. DOI will use a separate confirmed_at column later.
  IF OLD.marketing_consent IS NOT TRUE AND NEW.marketing_consent IS TRUE THEN
    RAISE EXCEPTION 'marketing consent can only be granted on INSERT'
      USING ERRCODE = '23514';
  END IF;

  -- Once proof exists (consent granted with timestamp), consent/at/version are immutable.
  IF OLD.marketing_consent_at IS NOT NULL THEN
    IF NEW.marketing_consent IS DISTINCT FROM OLD.marketing_consent
       OR NEW.marketing_consent_at IS DISTINCT FROM OLD.marketing_consent_at
       OR NEW.marketing_consent_text_version IS DISTINCT FROM OLD.marketing_consent_text_version THEN
      RAISE EXCEPTION 'marketing consent proof fields are immutable once set'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    NEW.marketing_consent := false;
    NEW.marketing_consent_at := NULL;
    NEW.marketing_consent_text_version := NULL;
  END IF;

  -- Revocation: may set once; never clear. Consent stays true as proof.
  IF OLD.marketing_consent_revoked_at IS NOT NULL THEN
    IF NEW.marketing_consent_revoked_at IS DISTINCT FROM OLD.marketing_consent_revoked_at THEN
      RAISE EXCEPTION 'marketing_consent_revoked_at is sticky and cannot be cleared or changed'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.marketing_consent_revoked_at IS NOT NULL THEN
    NEW.marketing_consent_revoked_at := pg_catalog.now();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.marketing_consent_before_update() IS
  'PR A (#1806): INSERT-only grant; immutable consent proof; sticky revoked_at.';

REVOKE ALL ON FUNCTION public.marketing_consent_before_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marketing_consent_before_update() FROM anon;
REVOKE ALL ON FUNCTION public.marketing_consent_before_update() FROM authenticated;

DROP TRIGGER IF EXISTS trg_sales_leads_marketing_consent_bu ON public.sales_leads;
CREATE TRIGGER trg_sales_leads_marketing_consent_bu
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.marketing_consent_before_update();

DROP TRIGGER IF EXISTS trg_gdpr_audits_marketing_consent_bu ON public.gdpr_audits;
CREATE TRIGGER trg_gdpr_audits_marketing_consent_bu
  BEFORE UPDATE ON public.gdpr_audits
  FOR EACH ROW
  EXECUTE FUNCTION public.marketing_consent_before_update();

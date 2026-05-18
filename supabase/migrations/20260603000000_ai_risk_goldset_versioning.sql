-- =========================================================================
-- RealSync Dynamics AI — ai-risk-agent Goldset Versionierung
--
-- Erfüllt zwei dokumentierte Folge-PRs aus CLAUDE.md §5 + §7:
--   - case_category-Spalte auf ai_risk_goldset (objective | interpretive | excluded)
--   - agent_versions-Tabelle für prompt/goldset/model/interpretation-policy-Tracking
--
-- Beide additiv. Bestehende Seeds aus 20260602000000_ai_risk_goldset.sql
-- bleiben unverändert; ein Backfill markiert den einen heute schon
-- vorhandenen Borderline-Case ("AI-Generated Product Description Tool")
-- als interpretive_case.
-- =========================================================================

-- 1. Enum für Fall-Kategorien (CLAUDE.md §7)
DO $$ BEGIN
  CREATE TYPE goldset_case_category AS ENUM ('objective', 'interpretive', 'excluded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Spalte auf ai_risk_goldset
ALTER TABLE public.ai_risk_goldset
  ADD COLUMN IF NOT EXISTS case_category            goldset_case_category NOT NULL DEFAULT 'objective',
  ADD COLUMN IF NOT EXISTS legal_basis              text,
  ADD COLUMN IF NOT EXISTS interpretation_policy_version text;

COMMENT ON COLUMN public.ai_risk_goldset.case_category IS
  'objective = klare Annex/Article-Zuordnung. interpretive = juristisch auslegungsabhängig (legal_basis + interpretation_policy_version Pflicht). excluded = wartet auf Legal/Governance-Entscheidung, is_active sollte false sein.';
COMMENT ON COLUMN public.ai_risk_goldset.legal_basis IS
  'Pflicht für interpretive_case: Artikel-/Annex-Referenz oder Behörden-Auslegung, auf die das erwartete Label fußt.';
COMMENT ON COLUMN public.ai_risk_goldset.interpretation_policy_version IS
  'Pflicht für interpretive_case: Version des Interpretations-Policy-Dokuments, gegen das gemessen wird. Form z. B. 2026.05.';

-- 3. Backfill: bekannten Borderline-Case markieren
UPDATE public.ai_risk_goldset
SET case_category = 'interpretive',
    legal_basis = 'EU AI Act Art. 50(4) — Public-Interest-Charakter',
    interpretation_policy_version = '2026.05'
WHERE label = 'AI-Generated Product Description Tool';

-- 4. Soft-Constraint via Trigger: interpretive_case verlangt legal_basis + policy_version
CREATE OR REPLACE FUNCTION public.tg_goldset_interpretive_case_check()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.case_category = 'interpretive' THEN
    IF NEW.legal_basis IS NULL OR length(trim(NEW.legal_basis)) = 0 THEN
      RAISE EXCEPTION 'interpretive_case % requires legal_basis', NEW.label;
    END IF;
    IF NEW.interpretation_policy_version IS NULL
       OR length(trim(NEW.interpretation_policy_version)) = 0 THEN
      RAISE EXCEPTION 'interpretive_case % requires interpretation_policy_version', NEW.label;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_risk_goldset_interpretive_check ON public.ai_risk_goldset;
CREATE TRIGGER ai_risk_goldset_interpretive_check
  BEFORE INSERT OR UPDATE ON public.ai_risk_goldset
  FOR EACH ROW EXECUTE FUNCTION public.tg_goldset_interpretive_case_check();

-- 5. Index für häufige Filter
CREATE INDEX IF NOT EXISTS idx_ai_risk_goldset_category
  ON public.ai_risk_goldset (case_category)
  WHERE is_active = true;

-- =========================================================================
-- 6. agent_versions — Versions-Tracking (CLAUDE.md §5)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.agent_versions (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name                    text NOT NULL,
  prompt_version                text NOT NULL,
  goldset_version               text NOT NULL,
  model_version                 text NOT NULL,
  interpretation_policy_version text,
  git_sha                       text,
  notes                         text,
  superseded_by                 uuid REFERENCES public.agent_versions(id),
  created_at                    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_name, prompt_version, goldset_version, model_version)
);

CREATE INDEX IF NOT EXISTS idx_agent_versions_active
  ON public.agent_versions (agent_name, created_at DESC)
  WHERE superseded_by IS NULL;

COMMENT ON TABLE public.agent_versions IS
  'Append-only Versions-Tracking pro Agent. Eval-Workflow schreibt einen Eintrag pro Run-Konfiguration; spätere Eval-Runs referenzieren die agent_version_id statt einzelne Strings zu duplizieren.';

ALTER TABLE public.agent_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_agent_versions" ON public.agent_versions;
CREATE POLICY "service_role_all_agent_versions"
  ON public.agent_versions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed: der heutige ai-risk-agent als initiale Version (prompt v1)
INSERT INTO public.agent_versions
  (agent_name, prompt_version, goldset_version, model_version, interpretation_policy_version, notes)
VALUES
  ('ai-risk', 'v1', '2026-06-02', 'claude-haiku-4-5-20251001', '2026.05',
   'Initial production version. Prompt v1 enumerates all Art. 5(1) subsections and Annex III categories. Goldset-Version entspricht Migration-Timestamp 20260602000000.')
ON CONFLICT (agent_name, prompt_version, goldset_version, model_version) DO NOTHING;

-- =========================================================================
-- 7. Verifikation
-- =========================================================================
DO $$
DECLARE
  v_interpretive int;
  v_versions int;
BEGIN
  SELECT COUNT(*) INTO v_interpretive
    FROM public.ai_risk_goldset
    WHERE case_category = 'interpretive';
  SELECT COUNT(*) INTO v_versions
    FROM public.agent_versions
    WHERE agent_name = 'ai-risk';

  RAISE NOTICE 'Goldset interpretive_cases: %, agent_versions(ai-risk): %',
    v_interpretive, v_versions;

  IF v_versions < 1 THEN
    RAISE EXCEPTION 'agent_versions seed for ai-risk fehlt';
  END IF;
END $$;

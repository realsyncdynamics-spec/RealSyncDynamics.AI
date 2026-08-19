-- AI Act requirement-level compliance assessments (Art. 9–15 + Art. 50)
--
-- Distinct from public.ai_act_assessments (system classification / risk scoring).
-- This table stores one row per (tenant, asset, requirement_id) and supports the
-- audit chain: Requirement → Assessment → Evidence → Finding → Remediation → Review.
--
-- Catalog: docs/compliance/ai-act-requirement-catalog.json
-- Schema:  docs/compliance/ai-act-compliance-assessment.schema.json
-- Checklist: docs/compliance/ai-act-art-9-15-checklist.md
--
-- Art. 50 is stored as article=50 (not merged into Art. 13).

CREATE TABLE IF NOT EXISTS public.ai_act_compliance_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Prefer governance_assets; no hard FK so inventory rows outside that table still work.
  asset_id UUID NOT NULL,

  regulation TEXT NOT NULL DEFAULT 'EU_AI_ACT'
    CHECK (regulation = 'EU_AI_ACT'),
  article INT NOT NULL
    CHECK (article IN (9, 10, 11, 12, 13, 14, 15, 50)),
  requirement_id TEXT NOT NULL
    CHECK (requirement_id ~ '^(9|10|11|12|13|14|15|50)\.[0-9]+$'),

  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'partial', 'satisfied', 'not_applicable', 'blocked')),
  applicability_reason TEXT,

  evidence_ids UUID[] NOT NULL DEFAULT '{}',
  finding_ids UUID[] NOT NULL DEFAULT '{}',
  policy_id UUID,

  owner TEXT,
  reviewer TEXT,

  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,

  remediation JSONB,
  -- Example: {"summary":"...","steps":["..."],"owner":null,"due_at":null,"status":"planned"}

  risk_level TEXT
    CHECK (risk_level IS NULL OR risk_level IN ('info', 'low', 'medium', 'high', 'critical')),

  related_requirement_ids TEXT[] NOT NULL DEFAULT '{}',

  classification_context JSONB,
  -- Example: {"high_risk":true,"basis":"annex_iii","annex_iii_area":"employment","rationale":"..."}

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ai_act_compliance_assessments_na_reason_chk
    CHECK (
      status NOT IN ('not_applicable', 'blocked')
      OR (applicability_reason IS NOT NULL AND length(trim(applicability_reason)) > 0)
    ),
  CONSTRAINT ai_act_compliance_assessments_article_matches_req_chk
    CHECK (
      split_part(requirement_id, '.', 1)::int = article
    )
);

-- One assessment row per requirement per asset (current state; history via audit log later).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_act_compliance_assessments_asset_req
  ON public.ai_act_compliance_assessments (tenant_id, asset_id, requirement_id);

CREATE INDEX IF NOT EXISTS idx_ai_act_compliance_assessments_tenant_status
  ON public.ai_act_compliance_assessments (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_act_compliance_assessments_tenant_article
  ON public.ai_act_compliance_assessments (tenant_id, article);

CREATE INDEX IF NOT EXISTS idx_ai_act_compliance_assessments_tenant_asset
  ON public.ai_act_compliance_assessments (tenant_id, asset_id);

CREATE INDEX IF NOT EXISTS idx_ai_act_compliance_assessments_due
  ON public.ai_act_compliance_assessments (tenant_id, due_at)
  WHERE due_at IS NOT NULL AND status IN ('open', 'partial', 'blocked');

CREATE INDEX IF NOT EXISTS idx_ai_act_compliance_assessments_next_review
  ON public.ai_act_compliance_assessments (tenant_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

ALTER TABLE public.ai_act_compliance_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_act_compliance_assessments tenant_select" ON public.ai_act_compliance_assessments;
CREATE POLICY "ai_act_compliance_assessments tenant_select"
  ON public.ai_act_compliance_assessments FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "ai_act_compliance_assessments tenant_insert" ON public.ai_act_compliance_assessments;
CREATE POLICY "ai_act_compliance_assessments tenant_insert"
  ON public.ai_act_compliance_assessments FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "ai_act_compliance_assessments tenant_update" ON public.ai_act_compliance_assessments;
CREATE POLICY "ai_act_compliance_assessments tenant_update"
  ON public.ai_act_compliance_assessments FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "ai_act_compliance_assessments tenant_delete" ON public.ai_act_compliance_assessments;
CREATE POLICY "ai_act_compliance_assessments tenant_delete"
  ON public.ai_act_compliance_assessments FOR DELETE
  USING (public.is_tenant_member(tenant_id));

DROP TRIGGER IF EXISTS update_ai_act_compliance_assessments_modtime ON public.ai_act_compliance_assessments;
CREATE TRIGGER update_ai_act_compliance_assessments_modtime
  BEFORE UPDATE ON public.ai_act_compliance_assessments
  FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

COMMENT ON TABLE public.ai_act_compliance_assessments IS
  'Per-requirement EU AI Act assessments (Art. 9-15 high-risk + Art. 50 transparency). Not the same as ai_act_assessments (classification).';
COMMENT ON COLUMN public.ai_act_compliance_assessments.requirement_id IS
  'Catalog ID from docs/compliance/ai-act-requirement-catalog.json (e.g. 9.1, 50.2).';
COMMENT ON COLUMN public.ai_act_compliance_assessments.article IS
  '50 is transparency; must not be folded into 13 in application logic.';
COMMENT ON COLUMN public.ai_act_compliance_assessments.evidence_ids IS
  'Links to governance evidence / custody objects supporting the status.';
COMMENT ON COLUMN public.ai_act_compliance_assessments.remediation IS
  'JSON: summary, steps[], owner, due_at, status (planned|in_progress|done|cancelled).';

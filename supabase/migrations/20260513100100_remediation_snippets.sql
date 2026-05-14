-- Remediation Snippets — generated, audit-trail-attached code/config
-- artefacts that an operator can copy-paste into the customer codebase
-- to fix a specific finding.
--
-- The artefacts themselves are templated by the `governance-remediate`
-- Edge Function from a library of patterns:
--   - csp_header_block         block a tracker via CSP
--   - consent_wrapper          wrap a script-tag in a CMP gate
--   - font_self_host           replace Google Fonts <link> with self-host
--   - tracker_dom_remove       small JS snippet to strip a tracker tag
--   - dsgvo_footer_block       AVV + DSB-Kontakt-Block for the footer
--
-- One row per generation. Snippets are never auto-applied — the
-- workflow is: tenant admin reviews the snippet in the asset detail
-- view, copies it, applies it in their own codebase, and clicks
-- "Mark applied" which transitions status → applied + writes audit.

CREATE TABLE IF NOT EXISTS public.remediation_snippets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id      UUID REFERENCES public.governance_assets(id) ON DELETE SET NULL,
  event_id      UUID REFERENCES public.governance_events(id) ON DELETE SET NULL,

  pattern       TEXT NOT NULL CHECK (pattern IN (
    'csp_header_block',
    'consent_wrapper',
    'font_self_host',
    'tracker_dom_remove',
    'dsgvo_footer_block'
  )),
  target_lang   TEXT NOT NULL CHECK (target_lang IN ('html','js','css','nginx','apache','vercel','netlify','wordpress','shopify')),

  title         TEXT NOT NULL,
  rationale     TEXT NOT NULL,                 -- why this snippet, why now
  snippet       TEXT NOT NULL,                 -- the actual copy-paste payload
  applies_to     TEXT,                          -- e.g. 'page.html', 'next.config.js'
  regulation_refs TEXT[],                        -- e.g. ['TTDSG_25', 'GDPR_ART_6']

  status        TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN (
    'suggested',     -- generated, awaiting review
    'reviewed',      -- operator has read it
    'applied',       -- operator marked as applied
    'rejected',      -- operator does not want this snippet
    'superseded'     -- a newer snippet replaces this one
  )),
  applied_at    TIMESTAMPTZ,
  applied_by    TEXT,

  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_remediation_snippets_tenant
  ON public.remediation_snippets(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_remediation_snippets_asset
  ON public.remediation_snippets(asset_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_remediation_snippets_updated_at ON public.remediation_snippets;
CREATE TRIGGER trg_remediation_snippets_updated_at BEFORE UPDATE ON public.remediation_snippets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.remediation_snippets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "remediation_snippets_service_all" ON public.remediation_snippets;
CREATE POLICY "remediation_snippets_service_all"
  ON public.remediation_snippets FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "remediation_snippets_tenant_read" ON public.remediation_snippets;
CREATE POLICY "remediation_snippets_tenant_read"
  ON public.remediation_snippets FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

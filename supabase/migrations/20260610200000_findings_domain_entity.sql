-- Finding domain entity — central compliance-evidence record.
--
-- Per the MVP-domain-model conversation: Finding is the entity that
-- ties together scan output, agent decisions, evidence references,
-- remediation, replay, and risk scoring. It is NOT a temporary scan
-- output; it is the persistent record an auditor reads.
--
-- Why a new table when marketing_compliance_findings + Audit's Issue
-- shape already exist:
--   - marketing_compliance_findings (#20260513500100) is Marketing-
--     funnel-scoped (campaigns, attribution, tracker compliance) —
--     not the governance-compliance domain. Distinct concept, kept.
--   - The audit-flow's React `Issue` / `AuditResultFinding` interfaces
--     are in-memory shapes returned by gdpr-audit; they don't persist.
--   - Findings (this table) is the canonical compliance record across
--     all detectors: gdpr-audit scans, governance-agent tool runs,
--     human input, future scanner integrations.
--
-- How this correlates with the existing event/activity layer:
--   - runtime_events (SPEC-001 kernel-v1, 20260602100000) is the
--     neutral activity-log backbone. Finding creation emits a
--     runtime_event of type='finding.created' with the finding's
--     correlation_id, so the same correlation_id joins:
--       runtime_events   ←→  findings
--       runtime_events   ←→  anon_chat_runs
--       runtime_events   ←→  llm_query_history
--       runtime_events   ←→  (future) scan_runs
--     This is the cross-entity correlation the conversation called for,
--     without introducing a third event log.
--
-- Scope-strict for PR 1 of the MVP-domain sequence:
--   - DB migration + indexes + RLS
--   - NO scan_runs FK (next PR adds the scan_runs table; column kept
--     here as a forward-compatible UUID without FK so the next PR is
--     additive)
--   - NO automatic runtime_events insert trigger here — the adapter
--     in supabase/functions/_shared/findings.ts handles correlation
--     emission, so callers control the spec_version + event_tier.
--   - NO scanner integration

CREATE TABLE IF NOT EXISTS public.findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  website_id      UUID          REFERENCES public.websites(id) ON DELETE SET NULL,
  -- scan_run_id has NO foreign key constraint yet — the scan_runs
  -- table arrives in PR 2 of the sequence. Persisting the UUID now
  -- so emitters can stamp it without needing a follow-up migration.
  scan_run_id     UUID,

  -- Domain classification. category is open-text + soft validation
  -- via the CHECK below; new categories can be added in additive
  -- migrations without breaking existing rows.
  category        TEXT NOT NULL,
  severity        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open',

  -- Detector identity (which subsystem produced this finding).
  -- Examples: 'gdpr-audit', 'governance-agent', 'cookie-scanner',
  --           'manual', 'ai-act-classifier', 'shopify-scan'.
  detector        TEXT NOT NULL,

  -- Evidence pointer. Opaque string — could be a URL, sha256 hash,
  -- runtime_events.id, storage object key, or external document id.
  -- Resolution lives in the consumer; this is intentionally typeless.
  evidence_ref    TEXT,

  -- Human-readable. summary is short (≤500 chars), raw_payload is the
  -- full detector output JSON for audit / replay / re-classification.
  summary         TEXT NOT NULL,
  raw_payload     JSONB,

  -- Cross-entity correlation handle (joins runtime_events,
  -- anon_chat_runs, llm_query_history, future scan_runs). The
  -- adapter populates this with the same UUID it stamps onto a
  -- runtime_events row at creation time.
  correlation_id  UUID,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT findings_category_check
    CHECK (category IN (
      'consent', 'tracker', 'ai_act', 'tom', 'dpa',
      'accessibility', 'security', 'transparency', 'data_quality',
      'documentation', 'other'
    )),
  CONSTRAINT findings_severity_check
    CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  CONSTRAINT findings_status_check
    CHECK (status IN (
      'open', 'acknowledged', 'fixed', 'false_positive', 'ignored', 'resolved'
    )),
  CONSTRAINT findings_summary_length
    CHECK (length(summary) BETWEEN 1 AND 1000)
);

COMMENT ON TABLE public.findings IS
  'Central compliance-finding record. One row per (detector × subject × evidence) at creation; lifecycle (acknowledged/fixed/resolved/...) tracked in `status`.';
COMMENT ON COLUMN public.findings.category IS
  'Compliance category. Soft-validated via CHECK so additive migrations can add new ones without breaking storage shape.';
COMMENT ON COLUMN public.findings.evidence_ref IS
  'Opaque pointer to evidence. URL, sha256, storage key, runtime_events.id — typeless by design; consumer resolves.';
COMMENT ON COLUMN public.findings.correlation_id IS
  'Joinable to runtime_events.correlation_id, anon_chat_runs.correlation_id, llm_query_history.correlation_id, and future scan_runs.';

-- Indexes — covering the four typical access paths.
CREATE INDEX IF NOT EXISTS findings_tenant_created_idx
  ON public.findings (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS findings_tenant_open_idx
  ON public.findings (tenant_id, created_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS findings_tenant_severity_idx
  ON public.findings (tenant_id, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS findings_correlation_idx
  ON public.findings (correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS findings_website_idx
  ON public.findings (website_id, created_at DESC)
  WHERE website_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS findings_scan_run_idx
  ON public.findings (scan_run_id)
  WHERE scan_run_id IS NOT NULL;

-- updated_at trigger — matches the convention from websites + tenants.
CREATE OR REPLACE FUNCTION public.findings_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS findings_update_modtime ON public.findings;
CREATE TRIGGER findings_update_modtime
  BEFORE UPDATE ON public.findings
  FOR EACH ROW EXECUTE FUNCTION public.findings_set_updated_at();

-- RLS — deny-by-default, tenant members SELECT, service-role mutates.
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "findings tenant member read"       ON public.findings;
DROP POLICY IF EXISTS "findings service-role full access" ON public.findings;

CREATE POLICY "findings tenant member read"
  ON public.findings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
       WHERE m.tenant_id = public.findings.tenant_id
         AND m.user_id   = auth.uid()
    )
  );

-- Service-role bypass is automatic. We explicitly add a service-role
-- write policy ONLY to make intent visible in audits — Supabase's
-- default service-role behavior would already cover it.
CREATE POLICY "findings service-role full access"
  ON public.findings FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT ON public.findings TO authenticated;
GRANT ALL    ON public.findings TO service_role;

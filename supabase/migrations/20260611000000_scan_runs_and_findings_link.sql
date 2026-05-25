-- ScanRun → Finding pipeline — PR 2 of the MVP-domain-model sequence.
--
-- A scan_run represents one execution of a detector against a subject
-- (typically a website, sometimes tenant-scope). Findings reference
-- the scan_run that produced them via the `scan_run_id` column added
-- in migration 20260610000000_findings_domain_entity.sql.
--
-- This migration:
--   1. Creates public.scan_runs with status lifecycle + denormalized
--      counters (finding_count, severity_max) for fast list views.
--   2. Backfills the FK from findings.scan_run_id → scan_runs.id with
--      ON DELETE SET NULL (deleting a scan run preserves the findings
--      it produced, just disconnects the audit trail of "which run").
--
-- Why denormalize finding_count + severity_max on scan_runs:
--   - List queries "show me my last 50 scans" need a finding-summary
--     per row. A JOIN-aggregate per row is N+1 expensive.
--   - The counters are updated EXPLICITLY by completeScanRun() in the
--     pipeline adapter; not via DB trigger. Trigger complexity around
--     RLS + multi-statement-tx + status-transition rules is not worth
--     the consistency guarantee here — at worst the counters are
--     stale until the next completeScanRun call.
--
-- Why not generalize the existing shopify_scan_runs:
--   - shopify_scan_runs (20260513300100) is Shopify-domain-specific
--     (shop_id FK, product/page counts). Different concept. We keep
--     it; this table is the GOVERNANCE-scan equivalent and the one
--     findings.scan_run_id points at.

-- ─────────────────────────────────────────────────────────────────────
-- 1. scan_runs table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scan_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  website_id      UUID          REFERENCES public.websites(id) ON DELETE SET NULL,

  -- Free-form detector identity, same vocabulary as findings.detector.
  -- Examples: 'gdpr-audit', 'cookie-scanner', 'ai-act-classifier',
  --           'governance-agent', 'manual'.
  detector        TEXT NOT NULL,

  status          TEXT NOT NULL DEFAULT 'queued',

  -- Lifecycle timestamps. queued_at == created_at; started_at when
  -- the worker picks the row; completed_at when status moves to a
  -- terminal value (completed / failed / cancelled).
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER,

  -- Denormalized roll-ups, updated by the pipeline adapter on
  -- completion. NULL while the run is still queued/running.
  finding_count   INTEGER NOT NULL DEFAULT 0 CHECK (finding_count >= 0),
  severity_max    TEXT,            -- 'critical'|'high'|'medium'|'low'|'info'|NULL

  -- Failure metadata. NULL on success.
  error_code      TEXT,
  error_message   TEXT,

  -- Detector-specific config and / or output metadata.
  raw_payload     JSONB,

  -- Cross-entity correlation. Same UUID gets stamped onto the matching
  -- runtime_events row and onto every finding emitted by this run.
  correlation_id  UUID,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT scan_runs_status_check
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),

  CONSTRAINT scan_runs_severity_max_check
    CHECK (severity_max IS NULL OR severity_max IN (
      'critical', 'high', 'medium', 'low', 'info'
    )),

  -- Lifecycle consistency. terminal states require completed_at;
  -- non-terminal states must NOT have completed_at set.
  CONSTRAINT scan_runs_terminal_timestamp_check
    CHECK (
      (status IN ('completed', 'failed', 'cancelled')) = (completed_at IS NOT NULL)
    ),

  -- failed → error_code must be set
  CONSTRAINT scan_runs_failed_requires_error_check
    CHECK (status != 'failed' OR error_code IS NOT NULL)
);

COMMENT ON TABLE public.scan_runs IS
  'One execution of a detector against a subject. Findings reference scan_runs via findings.scan_run_id.';
COMMENT ON COLUMN public.scan_runs.finding_count IS
  'Denormalized count of findings produced by this run. Updated by the pipeline adapter on completion; stale-tolerant.';
COMMENT ON COLUMN public.scan_runs.severity_max IS
  'Denormalized highest severity among this run''s findings. Same source as finding_count.';
COMMENT ON COLUMN public.scan_runs.correlation_id IS
  'Joinable to runtime_events.correlation_id and findings.correlation_id.';

-- Indexes — typical access paths.
CREATE INDEX IF NOT EXISTS scan_runs_tenant_created_idx
  ON public.scan_runs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS scan_runs_tenant_status_idx
  ON public.scan_runs (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS scan_runs_website_created_idx
  ON public.scan_runs (website_id, created_at DESC)
  WHERE website_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS scan_runs_correlation_idx
  ON public.scan_runs (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- updated_at trigger — mirrors the convention.
CREATE OR REPLACE FUNCTION public.scan_runs_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS scan_runs_update_modtime ON public.scan_runs;
CREATE TRIGGER scan_runs_update_modtime
  BEFORE UPDATE ON public.scan_runs
  FOR EACH ROW EXECUTE FUNCTION public.scan_runs_set_updated_at();

-- RLS — same shape as findings.
ALTER TABLE public.scan_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scan_runs tenant member read"       ON public.scan_runs;
DROP POLICY IF EXISTS "scan_runs service-role full access" ON public.scan_runs;

CREATE POLICY "scan_runs tenant member read"
  ON public.scan_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
       WHERE m.tenant_id = public.scan_runs.tenant_id
         AND m.user_id   = auth.uid()
    )
  );

CREATE POLICY "scan_runs service-role full access"
  ON public.scan_runs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT ON public.scan_runs TO authenticated;
GRANT ALL    ON public.scan_runs TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 2. findings.scan_run_id → scan_runs.id FK
-- ─────────────────────────────────────────────────────────────────────
--
-- PR 1 created findings.scan_run_id WITHOUT a constraint so PR 2 could
-- be additive. Now we add the FK with ON DELETE SET NULL — deleting a
-- scan_run preserves the findings it produced, just disconnects the
-- "produced-by-which-run" pointer (the finding is still a valid
-- compliance record).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'findings_scan_run_id_fkey'
      AND conrelid = 'public.findings'::regclass
  ) THEN
    ALTER TABLE public.findings
      ADD CONSTRAINT findings_scan_run_id_fkey
      FOREIGN KEY (scan_run_id) REFERENCES public.scan_runs(id) ON DELETE SET NULL;
  END IF;
END $$;

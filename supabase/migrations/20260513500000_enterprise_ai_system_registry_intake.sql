-- Enterprise AI OS — Self-Assessment intake fields for the AI registry.
--
-- Extends enterprise_ai_system_registry with optional context that the
-- Discovery self-assessment form collects. Existing rows stay valid; all
-- new columns are nullable / default-safe.

ALTER TABLE public.enterprise_ai_system_registry
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS data_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS external_usage BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS intake_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (intake_source IN ('manual', 'self_assessment', 'browser_extension', 'webhook', 'api', 'connector_sync')),
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS enterprise_ai_system_registry_approved_idx
  ON public.enterprise_ai_system_registry(approved);
CREATE INDEX IF NOT EXISTS enterprise_ai_system_registry_intake_source_idx
  ON public.enterprise_ai_system_registry(intake_source);

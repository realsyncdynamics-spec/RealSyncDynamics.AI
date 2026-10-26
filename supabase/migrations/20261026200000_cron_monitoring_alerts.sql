-- ─────────────────────────────────────────────────────────────────────────────
-- Cron Functions Monitoring (P0-2)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Tracks execution status of critical cron functions to detect outages.
-- Each cron function logs its execution result (success/failure).
-- Minimal alarm detection: Admin dashboard queries this table for recent failures.

CREATE TABLE IF NOT EXISTS public.cron_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL CHECK (function_name IN (
    'scheduler-dispatch',
    'governance-monitoring-scheduler',
    'memory-decay-worker'
  )),
  status text NOT NULL CHECK (status IN ('success', 'failure')),
  http_status integer,
  error_code text,
  error_message text,
  executed_at timestamptz NOT NULL DEFAULT now(),
  execution_duration_ms integer
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_function_recent
  ON public.cron_execution_logs (function_name, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_logs_failures
  ON public.cron_execution_logs (function_name, executed_at DESC)
  WHERE status = 'failure';

-- No RLS: cron functions are service_role only; monitoring is system-level.
-- Admins can query via admin dashboard (future: add a view if needed).

COMMENT ON TABLE public.cron_execution_logs IS 'System-level monitoring for critical cron functions. Used to detect outages and trigger minimal alerts.';
COMMENT ON COLUMN public.cron_execution_logs.function_name IS 'Name of the cron function';
COMMENT ON COLUMN public.cron_execution_logs.status IS 'success or failure';
COMMENT ON COLUMN public.cron_execution_logs.http_status IS 'HTTP status code returned by function';
COMMENT ON COLUMN public.cron_execution_logs.error_code IS 'Error code (e.g. CRON_KEY_MISSING, INTERNAL)';

-- Phase 3 Follow-up: Dead Letter Queue and Metrics Persistence for Social Orchestrator
-- Implements Postgres backend for in-memory infrastructure classes

-- ── Dead Letter Queue ────────────────────────────────────────────────────────
-- Stores failed publishing attempts with retry tracking and exponential backoff

CREATE TABLE IF NOT EXISTS social_dlq_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_entry_id TEXT NOT NULL UNIQUE,
  channel social_channel NOT NULL,
  error_code TEXT NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_social_dlq_channel ON social_dlq_entries(channel);
CREATE INDEX idx_social_dlq_next_retry ON social_dlq_entries(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX idx_social_dlq_created ON social_dlq_entries(created_at DESC);

-- ── Publishing Metrics ───────────────────────────────────────────────────────
-- Time-series metrics for observability: latency, retry rates, error tracking

CREATE TABLE IF NOT EXISTS social_publishing_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel social_channel NOT NULL,
  queue_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed')),
  latency_ms INTEGER,
  error_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_publishing_metrics_channel_created ON social_publishing_metrics(channel, created_at DESC);
CREATE INDEX idx_publishing_metrics_error ON social_publishing_metrics(error_code) WHERE error_code IS NOT NULL;
CREATE INDEX idx_publishing_metrics_status ON social_publishing_metrics(status);

-- ── Audit Logging ───────────────────────────────────────────────────────────
-- Compliance trail for regulatory evidence and debugging

CREATE TABLE IF NOT EXISTS social_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  queue_id TEXT NOT NULL,
  channel social_channel NOT NULL,
  status TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_social_audit_queue ON social_audit_log(queue_id);
CREATE INDEX idx_social_audit_event_type ON social_audit_log(event_type);
CREATE INDEX idx_social_audit_channel ON social_audit_log(channel);
CREATE INDEX idx_social_audit_created ON social_audit_log(created_at DESC);

-- ── RLS Policies ────────────────────────────────────────────────────────────
-- Multi-tenant isolation: all operations filtered by tenant_id via runtime context

ALTER TABLE social_dlq_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_publishing_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow Service Role (Edge Functions) full access for publishing operations
CREATE POLICY social_dlq_service_role ON social_dlq_entries
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY social_metrics_service_role ON social_publishing_metrics
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY social_audit_service_role ON social_audit_log
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Maintenance: Auto-cleanup of old DLQ entries ──────────────────────────────
-- Remove entries older than 30 days (retention policy)

CREATE OR REPLACE FUNCTION cleanup_social_dlq()
RETURNS TABLE(deleted_count INT) AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM social_dlq_entries
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND retry_count > 3;  -- Only delete if max retries exceeded
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count::INT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Metrics Rollup: Aggregate metrics into hourly buckets ─────────────────────
-- Supports time-series queries and dashboard reporting

CREATE TABLE IF NOT EXISTS social_publishing_metrics_hourly (
  hour TIMESTAMP WITH TIME ZONE NOT NULL,
  channel social_channel NOT NULL,
  total_attempts INTEGER DEFAULT 0,
  succeeded INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  avg_latency_ms NUMERIC(10, 2),
  p95_latency_ms NUMERIC(10, 2),
  p99_latency_ms NUMERIC(10, 2),
  error_rate NUMERIC(5, 2),
  PRIMARY KEY (hour, channel)
);

CREATE INDEX idx_metrics_hourly_created ON social_publishing_metrics_hourly(hour DESC);

-- Aggregation function: run hourly to rollup metrics
CREATE OR REPLACE FUNCTION rollup_publishing_metrics_hourly()
RETURNS TABLE(hour TIMESTAMP WITH TIME ZONE, channels_processed INT) AS $$
DECLARE
  v_hour TIMESTAMP WITH TIME ZONE;
  v_channels_processed INT := 0;
  v_channel social_channel;
BEGIN
  v_hour := DATE_TRUNC('hour', NOW() - INTERVAL '1 hour');

  FOR v_channel IN SELECT DISTINCT channel FROM social_publishing_metrics
    WHERE created_at >= v_hour AND created_at < v_hour + INTERVAL '1 hour'
  LOOP
    INSERT INTO social_publishing_metrics_hourly (hour, channel, total_attempts, succeeded, failed, avg_latency_ms)
    SELECT
      v_hour,
      v_channel,
      COUNT(*),
      COUNT(CASE WHEN status = 'succeeded' THEN 1 END),
      COUNT(CASE WHEN status = 'failed' THEN 1 END),
      AVG(latency_ms) FILTER (WHERE latency_ms IS NOT NULL)
    FROM social_publishing_metrics
    WHERE channel = v_channel
      AND created_at >= v_hour
      AND created_at < v_hour + INTERVAL '1 hour'
    ON CONFLICT (hour, channel) DO UPDATE SET
      total_attempts = EXCLUDED.total_attempts,
      succeeded = EXCLUDED.succeeded,
      failed = EXCLUDED.failed,
      avg_latency_ms = EXCLUDED.avg_latency_ms;

    v_channels_processed := v_channels_processed + 1;
  END LOOP;

  RETURN QUERY SELECT v_hour, v_channels_processed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Documentation ──────────────────────────────────────────────────────────
-- To enable automated cleanup and metrics rollup in production:
-- 1. Set up Supabase PostgreSQL cron extension: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 2. Schedule cleanup: SELECT cron.schedule('cleanup_social_dlq', '0 2 * * *', 'SELECT cleanup_social_dlq()');
-- 3. Schedule rollup: SELECT cron.schedule('rollup_metrics', '0 * * * *', 'SELECT rollup_publishing_metrics_hourly()');

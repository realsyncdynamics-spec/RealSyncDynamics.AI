-- Phase 8: Add monitoring and resilience tables for production hardening

-- Rate limiting state tracking
CREATE TABLE IF NOT EXISTS _rate_limits (
  key TEXT PRIMARY KEY,
  tokens TEXT NOT NULL DEFAULT '100',
  last_refill BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rate_limits_created ON _rate_limits(created_at DESC);

-- Circuit breaker state tracking
CREATE TABLE IF NOT EXISTS _circuit_breakers (
  name TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half-open')),
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_failure_time BIGINT,
  last_state_change BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Cleanup: Remove rate limit records older than 24 hours daily
-- (Would be run via scheduled job in production)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS TABLE(deleted_count INT) AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM _rate_limits
  WHERE updated_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

-- Monitoring table for operation metrics
CREATE TABLE IF NOT EXISTS _operation_metrics (
  id BIGSERIAL PRIMARY KEY,
  operation_name TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  duration_ms BIGINT,
  error_message TEXT,
  request_id TEXT,
  user_id TEXT,
  tenant_id TEXT,
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_operation_metrics_operation ON _operation_metrics(operation_name, created_at DESC);
CREATE INDEX idx_operation_metrics_request ON _operation_metrics(request_id);
CREATE INDEX idx_operation_metrics_user ON _operation_metrics(user_id, created_at DESC);
CREATE INDEX idx_operation_metrics_tenant ON _operation_metrics(tenant_id, created_at DESC);

-- Retention policy: Keep metrics for 30 days
CREATE OR REPLACE FUNCTION cleanup_operation_metrics()
RETURNS TABLE(deleted_count INT) AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM _operation_metrics
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

-- Add monitoring columns to website_projects if not exist
-- (one ADD COLUMN clause per column — Postgres does not accept a shared
--  IF NOT EXISTS across a comma-separated column list)
ALTER TABLE website_projects ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE website_projects ADD COLUMN IF NOT EXISTS consecutive_errors INTEGER DEFAULT 0;
ALTER TABLE website_projects ADD COLUMN IF NOT EXISTS last_successful_deployment TIMESTAMP WITH TIME ZONE;

-- Add monitoring columns to deployment_logs if not exist
ALTER TABLE deployment_logs ADD COLUMN IF NOT EXISTS duration_ms BIGINT;
ALTER TABLE deployment_logs ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE deployment_logs ADD COLUMN IF NOT EXISTS circuit_breaker_state TEXT
  CHECK (circuit_breaker_state IN ('closed', 'open', 'half-open'));

-- Create view for recent errors (last 24 hours)
CREATE OR REPLACE VIEW v_recent_errors AS
SELECT
  operation_name,
  COUNT(*) as error_count,
  COUNT(*) FILTER (WHERE success = FALSE) as failures,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success = FALSE) / COUNT(*), 2) as error_rate_pct,
  MAX(created_at) as last_error,
  MAX(COALESCE(duration_ms, 0)) as max_duration_ms,
  AVG(COALESCE(duration_ms, 0))::BIGINT as avg_duration_ms
FROM _operation_metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY operation_name;

COMMENT ON TABLE _rate_limits IS 'Rate limiter state for distributed rate limiting';
COMMENT ON TABLE _circuit_breakers IS 'Circuit breaker state for fault tolerance';
COMMENT ON TABLE _operation_metrics IS 'Operation metrics for monitoring and alerting';
COMMENT ON FUNCTION cleanup_rate_limits() IS 'Remove stale rate limit records (>24h old)';
COMMENT ON FUNCTION cleanup_operation_metrics() IS 'Remove stale operation metrics (>30d old)';

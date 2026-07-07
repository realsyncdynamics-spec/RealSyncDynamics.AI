-- Cron jobs for SEO-Marketing-Dashboard data syncs
-- Enables automatic scheduled data synchronization from external sources

-- Attempt to create pg_cron extension (available in Supabase Pro+, not in test environments)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create http extension if not exists
CREATE EXTENSION IF NOT EXISTS http;

-- Create table to track cron job executions
CREATE TABLE IF NOT EXISTS cron_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'success',
  error_message TEXT,
  records_processed INT DEFAULT 0
);

CREATE INDEX idx_cron_executions_job_name ON cron_executions(job_name);
CREATE INDEX idx_cron_executions_executed_at ON cron_executions(executed_at);

-- Function to handle sync job completion logging
CREATE OR REPLACE FUNCTION log_sync_completion()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO cron_executions (job_name, status, records_processed)
  SELECT
    'seo-marketing-sync',
    'success',
    COUNT(*)
  FROM data_sync_jobs
  WHERE status = 'completed'
    AND completed_at >= NOW() - INTERVAL '1 hour';
END;
$$;

-- Create view for monitoring sync status
CREATE OR REPLACE VIEW seo_sync_status AS
SELECT
  i.tenant_id,
  i.provider,
  i.status,
  i.last_sync_at,
  i.sync_interval_minutes,
  (NOW() - i.last_sync_at) AS time_since_last_sync,
  CASE
    WHEN i.last_sync_at IS NULL THEN 'never'
    WHEN (NOW() - i.last_sync_at) < (i.sync_interval_minutes * INTERVAL '1 minute')
      THEN 'on-schedule'
    ELSE 'overdue'
  END AS sync_status,
  dsj.status AS last_job_status,
  dsj.completed_at AS last_job_completed,
  dsj.error_message
FROM integrations i
LEFT JOIN LATERAL (
  SELECT status, completed_at, error_message
  FROM data_sync_jobs
  WHERE integration_id = i.id
  ORDER BY created_at DESC
  LIMIT 1
) dsj ON TRUE;

-- Enable RLS on new tables if needed
ALTER TABLE cron_executions ENABLE ROW LEVEL SECURITY;

-- Add audit trigger for cron executions
CREATE TRIGGER audit_cron_executions AFTER INSERT ON cron_executions
FOR EACH ROW EXECUTE FUNCTION audit_seo_marketing_changes();

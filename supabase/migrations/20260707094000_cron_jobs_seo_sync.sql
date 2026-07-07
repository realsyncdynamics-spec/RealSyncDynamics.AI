-- Cron jobs for SEO-Marketing-Dashboard data syncs
-- Enables automatic scheduled data synchronization from external sources

-- Create pg_cron extension if not exists
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

-- Schedule data sync every hour (runs schedule-data-syncs function)
-- Format: minute (0-59), hour (0-23), day (1-31), month (1-12), day-of-week (0-6, 0=Sunday)
-- This runs at the start of every hour
SELECT cron.schedule(
  'seo-marketing-sync-hourly',  -- job name
  '0 * * * *',                   -- every hour at :00
  $$
    SELECT http_post(
      concat(
        current_setting('app.supabase_url'), '/functions/v1/schedule-data-syncs'
      ),
      '{}'::jsonb,
      'application/json',
      concat('Bearer ', current_setting('app.supabase_service_role_key'))
    );
  $$
);

-- Schedule daily summary calculation and archival
-- Runs at midnight every day
SELECT cron.schedule(
  'seo-marketing-daily-archive',  -- job name
  '0 0 * * *',                     -- every day at 00:00
  $$
    WITH daily_summary AS (
      SELECT
        tenant_id,
        period_start::date AS summary_date,
        AVG(web_visitors) AS avg_visitors,
        AVG(leads_generated) AS avg_leads,
        AVG(revenue_generated) AS avg_revenue,
        AVG((revenue_generated / NULLIF(customers_acquired, 0))) AS avg_revenue_per_customer,
        NOW() AS calculated_at
      FROM marketing_metrics
      WHERE period_start::date = CURRENT_DATE - INTERVAL '1 day'
      GROUP BY tenant_id, period_start::date
    )
    INSERT INTO marketing_metrics (
      tenant_id, period_start, period_end,
      web_visitors, leads_generated, revenue_generated,
      data_source, created_at
    )
    SELECT
      ds.tenant_id,
      (ds.summary_date)::date,
      (ds.summary_date + INTERVAL '1 day')::date,
      ROUND(ds.avg_visitors)::int,
      ROUND(ds.avg_leads)::int,
      ROUND(ds.avg_revenue::numeric, 2),
      'daily_archive',
      NOW()
    FROM daily_summary ds
    ON CONFLICT (tenant_id, period_start, period_end) DO UPDATE
    SET
      web_visitors = EXCLUDED.web_visitors,
      leads_generated = EXCLUDED.leads_generated,
      revenue_generated = EXCLUDED.revenue_generated,
      updated_at = NOW();
  $$
);

-- Schedule cleanup of old sync jobs (delete entries older than 90 days)
-- Runs at 2 AM every day
SELECT cron.schedule(
  'seo-marketing-cleanup-jobs',  -- job name
  '0 2 * * *',                    -- every day at 02:00
  $$
    DELETE FROM data_sync_jobs
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND status IN ('completed', 'failed');
  $$
);

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

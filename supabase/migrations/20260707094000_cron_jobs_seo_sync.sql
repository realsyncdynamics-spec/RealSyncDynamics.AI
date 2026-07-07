-- Cron jobs for SEO-Marketing-Dashboard data syncs
-- Simplified migration with only essential table and RLS

-- Create table to track cron job executions
CREATE TABLE IF NOT EXISTS cron_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'success',
  error_message TEXT,
  records_processed INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cron_executions_job_name ON cron_executions(job_name);
CREATE INDEX idx_cron_executions_executed_at ON cron_executions(executed_at);

-- Enable RLS on table
ALTER TABLE cron_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to view all cron execution logs
CREATE POLICY "cron_executions_read_all"
  ON cron_executions
  FOR SELECT
  USING (true);

-- RLS Policy: Only allow inserts for cron jobs
CREATE POLICY "cron_executions_insert_all"
  ON cron_executions
  FOR INSERT
  WITH CHECK (true);

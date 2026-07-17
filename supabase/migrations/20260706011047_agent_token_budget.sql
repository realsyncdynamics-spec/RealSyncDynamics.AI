-- Agent Token Budget & Usage Tracking
-- Tracks governance-agent API calls and token consumption for quota management

CREATE TABLE IF NOT EXISTS agent_token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prompt_type TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER,
  output_tokens INTEGER,
  completion_time_ms INTEGER,
  cached BOOLEAN DEFAULT false,
  error_occurred BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE agent_token_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service role only - this is a logging table)
CREATE POLICY "Service role can view token usage"
  ON agent_token_usage
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert token usage"
  ON agent_token_usage
  FOR INSERT
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_agent_token_usage_tenant
  ON agent_token_usage(tenant_id);

CREATE INDEX idx_agent_token_usage_created_at
  ON agent_token_usage(tenant_id, created_at DESC);

CREATE INDEX idx_agent_token_usage_prompt_type
  ON agent_token_usage(tenant_id, prompt_type);

-- Hourly-bucket queries are served by idx_agent_token_usage_created_at
-- (tenant_id, created_at DESC). An expression index on
-- date_trunc('hour', created_at) is rejected because date_trunc over
-- timestamptz is only STABLE (session-timezone dependent), not IMMUTABLE.

-- Agent Configuration Table
CREATE TABLE IF NOT EXISTS agent_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  monthly_token_budget INTEGER DEFAULT 100000,
  hourly_rate_limit INTEGER DEFAULT 3,
  cache_enabled BOOLEAN DEFAULT true,
  cache_ttl_minutes INTEGER DEFAULT 60,
  fallback_to_rules BOOLEAN DEFAULT true,
  auto_generate_digests BOOLEAN DEFAULT true,
  auto_generate_insights BOOLEAN DEFAULT true,
  alert_on_budget_warning BOOLEAN DEFAULT true,
  warning_threshold_percent INTEGER DEFAULT 80,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE agent_configuration ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin/service role only)
CREATE POLICY "Service role can manage agent config"
  ON agent_configuration
  FOR ALL
  USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_agent_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_config_updated_at
BEFORE UPDATE ON agent_configuration
FOR EACH ROW
EXECUTE FUNCTION update_agent_config_updated_at();

-- Helper function to get token usage in time period
CREATE OR REPLACE FUNCTION get_token_usage(
  p_tenant_id UUID,
  p_hours INTEGER DEFAULT 1
)
RETURNS TABLE (
  total_tokens INTEGER,
  call_count INTEGER,
  avg_tokens_per_call NUMERIC,
  error_count INTEGER,
  cached_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(agent_token_usage.tokens_used), 0)::INTEGER,
    COUNT(*)::INTEGER,
    COALESCE(AVG(agent_token_usage.tokens_used), 0)::NUMERIC,
    COALESCE(SUM(CASE WHEN agent_token_usage.error_occurred THEN 1 ELSE 0 END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN agent_token_usage.cached THEN 1 ELSE 0 END), 0)::INTEGER
  FROM agent_token_usage
  WHERE agent_token_usage.tenant_id = p_tenant_id
    AND agent_token_usage.created_at >= NOW() - INTERVAL '1 hour' * p_hours;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to check if rate limit exceeded
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_tenant_id UUID
)
RETURNS TABLE (
  rate_limit_exceeded BOOLEAN,
  calls_this_hour INTEGER,
  rate_limit INTEGER
) AS $$
DECLARE
  v_config RECORD;
  v_call_count INTEGER;
BEGIN
  -- Get tenant config
  SELECT * INTO v_config FROM agent_configuration WHERE tenant_id = p_tenant_id;

  -- Get call count for current hour
  SELECT COUNT(*) INTO v_call_count
  FROM agent_token_usage
  WHERE tenant_id = p_tenant_id
    AND created_at >= DATE_TRUNC('hour', NOW());

  RETURN QUERY
  SELECT
    (v_call_count >= COALESCE((v_config).hourly_rate_limit, 3)),
    v_call_count,
    COALESCE((v_config).hourly_rate_limit, 3);
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to check budget
CREATE OR REPLACE FUNCTION check_budget(
  p_tenant_id UUID,
  p_requested_tokens INTEGER DEFAULT 1000
)
RETURNS TABLE (
  budget_available BOOLEAN,
  tokens_used_this_month INTEGER,
  budget_limit INTEGER,
  remaining_budget INTEGER
) AS $$
DECLARE
  v_config RECORD;
  v_tokens_used INTEGER;
  v_budget_limit INTEGER;
BEGIN
  -- Get tenant config
  SELECT * INTO v_config FROM agent_configuration WHERE tenant_id = p_tenant_id;

  v_budget_limit := COALESCE((v_config).monthly_token_budget, 100000);

  -- Get tokens used this month
  SELECT COALESCE(SUM(tokens_used), 0) INTO v_tokens_used
  FROM agent_token_usage
  WHERE tenant_id = p_tenant_id
    AND created_at >= DATE_TRUNC('month', NOW());

  RETURN QUERY
  SELECT
    (v_tokens_used + p_requested_tokens <= v_budget_limit),
    v_tokens_used,
    v_budget_limit,
    GREATEST(0, v_budget_limit - v_tokens_used);
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to record token usage
CREATE OR REPLACE FUNCTION record_token_usage(
  p_tenant_id UUID,
  p_prompt_type TEXT,
  p_tokens_used INTEGER,
  p_input_tokens INTEGER DEFAULT NULL,
  p_output_tokens INTEGER DEFAULT NULL,
  p_completion_time_ms INTEGER DEFAULT NULL,
  p_cached BOOLEAN DEFAULT false,
  p_error_occurred BOOLEAN DEFAULT false,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_usage_id UUID;
BEGIN
  INSERT INTO agent_token_usage (
    tenant_id,
    prompt_type,
    tokens_used,
    input_tokens,
    output_tokens,
    completion_time_ms,
    cached,
    error_occurred,
    error_message
  ) VALUES (
    p_tenant_id,
    p_prompt_type,
    p_tokens_used,
    p_input_tokens,
    p_output_tokens,
    p_completion_time_ms,
    p_cached,
    p_error_occurred,
    p_error_message
  )
  RETURNING id INTO v_usage_id;

  RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql;

-- View for token usage analytics
CREATE OR REPLACE VIEW agent_token_usage_analytics AS
SELECT
  tenant_id,
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as call_count,
  SUM(tokens_used) as tokens_used,
  AVG(tokens_used) as avg_tokens,
  MAX(tokens_used) as max_tokens,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END) as cached_count,
  SUM(CASE WHEN error_occurred THEN 1 ELSE 0 END) as error_count
FROM agent_token_usage
GROUP BY tenant_id, DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- Insert default config for existing tenants
INSERT INTO agent_configuration (tenant_id)
SELECT id FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM agent_configuration)
ON CONFLICT DO NOTHING;

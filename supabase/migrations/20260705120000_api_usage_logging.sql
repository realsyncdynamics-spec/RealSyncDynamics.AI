-- API Usage Logging and Rate Limiting
-- Tracks all API calls for quota enforcement and analytics

CREATE TABLE IF NOT EXISTS public.api_calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  api_key_id      UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL,
  method          TEXT NOT NULL,
  status_code     INTEGER,
  response_time_ms INTEGER,
  error_message   TEXT,
  called_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_path    TEXT NOT NULL,
  CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH'))
);

CREATE INDEX IF NOT EXISTS idx_api_calls_tenant_key ON public.api_calls(tenant_id, api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_called_at ON public.api_calls(called_at DESC) WHERE called_at > now() - interval '30 days';
CREATE INDEX IF NOT EXISTS idx_api_calls_api_key ON public.api_calls(api_key_id, called_at DESC);

ALTER TABLE public.api_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_calls tenant_member_read" ON public.api_calls;
CREATE POLICY "api_calls tenant_member_read"
  ON public.api_calls FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = api_calls.tenant_id AND m.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "api_calls service_role_insert" ON public.api_calls;
CREATE POLICY "api_calls service_role_insert"
  ON public.api_calls FOR INSERT
  WITH CHECK (true);

-- API Call Statistics View (monthly usage per tenant)
DROP VIEW IF EXISTS public.api_monthly_usage CASCADE;
CREATE VIEW public.api_monthly_usage AS
SELECT
  tenant_id,
  DATE_TRUNC('month', called_at)::DATE as month,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_calls,
  AVG(response_time_ms) as avg_response_time_ms,
  MAX(response_time_ms) as max_response_time_ms
FROM public.api_calls
GROUP BY tenant_id, DATE_TRUNC('month', called_at);

-- Function to check if API call is within rate limits
CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  p_tenant_id UUID,
  p_tier TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  v_limit INTEGER;
  v_current_count BIGINT;
  v_month_start TIMESTAMPTZ;
BEGIN
  -- Determine monthly limit based on tier
  v_limit := CASE
    WHEN p_tier = 'agency' THEN 1000
    WHEN p_tier = 'scale' THEN 10000
    WHEN p_tier = 'enterprise' THEN 100000
    ELSE 0
  END;

  IF v_limit = 0 THEN
    RETURN false;
  END IF;

  v_month_start := DATE_TRUNC('month', now());

  -- Count calls this month
  SELECT COUNT(*) INTO v_current_count
  FROM public.api_calls
  WHERE tenant_id = p_tenant_id
    AND called_at >= v_month_start
    AND called_at < v_month_start + INTERVAL '1 month';

  RETURN v_current_count < v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_api_rate_limit(UUID, TEXT) TO authenticated, service_role;

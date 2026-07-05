-- Webhook Notifications System
-- Supports quota warnings, rate limit alerts, and suspicious activity notifications

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  description     TEXT,
  events          TEXT[] NOT NULL DEFAULT ARRAY['quota_warning', 'quota_exceeded', 'suspicious_activity'],
  is_active       BOOLEAN NOT NULL DEFAULT true,
  secret_key      TEXT NOT NULL,
  last_tested_at  TIMESTAMPTZ,
  retry_count     INTEGER DEFAULT 0,
  max_retries     INTEGER DEFAULT 3,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant ON public.webhook_endpoints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active ON public.webhook_endpoints(tenant_id, is_active);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_endpoints tenant_member_read" ON public.webhook_endpoints;
CREATE POLICY "webhook_endpoints tenant_member_read"
  ON public.webhook_endpoints FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "webhook_endpoints tenant_member_insert" ON public.webhook_endpoints;
CREATE POLICY "webhook_endpoints tenant_member_insert"
  ON public.webhook_endpoints FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "webhook_endpoints tenant_member_update" ON public.webhook_endpoints;
CREATE POLICY "webhook_endpoints tenant_member_update"
  ON public.webhook_endpoints FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "webhook_endpoints tenant_member_delete" ON public.webhook_endpoints;
CREATE POLICY "webhook_endpoints tenant_member_delete"
  ON public.webhook_endpoints FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid()
  ));

-- Webhook delivery log
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  event_data      JSONB NOT NULL,
  status_code     INTEGER,
  response_body   TEXT,
  error_message   TEXT,
  attempt_number  INTEGER NOT NULL DEFAULT 1,
  next_retry_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_type ON public.webhook_deliveries(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON public.webhook_deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON public.webhook_deliveries(next_retry_at) WHERE delivered_at IS NULL;

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_deliveries tenant_member_read" ON public.webhook_deliveries;
CREATE POLICY "webhook_deliveries tenant_member_read"
  ON public.webhook_deliveries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.webhook_endpoints we
    JOIN public.tenant_memberships m ON we.tenant_id = m.tenant_id
    WHERE we.id = webhook_deliveries.webhook_id AND m.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "webhook_deliveries service_role_insert" ON public.webhook_deliveries;
CREATE POLICY "webhook_deliveries service_role_insert"
  ON public.webhook_deliveries FOR INSERT
  WITH CHECK (true);

-- Quota alerts log
CREATE TABLE IF NOT EXISTS public.quota_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  alert_type      TEXT NOT NULL CHECK (alert_type IN ('warning_80', 'limit_exceeded', 'suspicious_activity')),
  api_calls_count INTEGER NOT NULL,
  quota_limit     INTEGER NOT NULL,
  message         TEXT,
  webhook_sent    BOOLEAN DEFAULT false,
  email_sent      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quota_alerts_tenant ON public.quota_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_type ON public.quota_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_created ON public.quota_alerts(created_at DESC);

ALTER TABLE public.quota_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quota_alerts tenant_member_read" ON public.quota_alerts;
CREATE POLICY "quota_alerts tenant_member_read"
  ON public.quota_alerts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id = quota_alerts.tenant_id AND m.user_id = auth.uid()
  ));

-- Function to trigger webhook notifications
CREATE OR REPLACE FUNCTION public.notify_quota_alert(
  p_tenant_id UUID,
  p_alert_type TEXT,
  p_api_calls_count INTEGER,
  p_quota_limit INTEGER
) RETURNS void AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  -- Create alert record
  INSERT INTO public.quota_alerts (tenant_id, alert_type, api_calls_count, quota_limit, message)
  VALUES (
    p_tenant_id,
    p_alert_type,
    p_api_calls_count,
    p_quota_limit,
    CASE
      WHEN p_alert_type = 'warning_80' THEN 'API quota usage at 80% (' || p_api_calls_count || '/' || p_quota_limit || ')'
      WHEN p_alert_type = 'limit_exceeded' THEN 'API quota limit exceeded (' || p_api_calls_count || '/' || p_quota_limit || ')'
      ELSE 'API quota alert'
    END
  ) RETURNING id INTO v_alert_id;

  -- Queue webhook deliveries for active webhooks subscribed to this event
  INSERT INTO public.webhook_deliveries (webhook_id, event_type, event_data, created_at)
  SELECT
    we.id,
    p_alert_type,
    jsonb_build_object(
      'event_type', p_alert_type,
      'tenant_id', p_tenant_id,
      'timestamp', now()::text,
      'api_calls', p_api_calls_count,
      'quota_limit', p_quota_limit,
      'message', CASE
        WHEN p_alert_type = 'warning_80' THEN 'Your API quota usage is at 80%'
        WHEN p_alert_type = 'limit_exceeded' THEN 'Your API quota limit has been exceeded'
        ELSE 'API quota alert'
      END
    ),
    now()
  FROM public.webhook_endpoints we
  WHERE we.tenant_id = p_tenant_id
    AND we.is_active = true
    AND p_alert_type = ANY(we.events);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Webhook delivery is handled by edge function (api-webhook-deliver)
-- which runs on schedule to retry failed deliveries with exponential backoff

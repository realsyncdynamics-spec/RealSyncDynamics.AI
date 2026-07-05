-- Webhook Delivery System
--
-- Enables tenants to subscribe to RealSync events (audit.completed, risk.detected, etc.)
-- and receive real-time webhooks for CI/CD integration (n8n, Zapier, GitHub, etc).
--
-- Architecture:
-- 1. webhook_subscriptions: Which events a tenant wants to receive
-- 2. webhook_deliveries: Append-only log of all delivery attempts
-- 3. webhook-deliver function: Posts events to registered URLs with retries

-- 1. Event catalog (documentation/configuration)
CREATE TABLE IF NOT EXISTS public.webhook_event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  payload_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed event types
INSERT INTO public.webhook_event_types (event_key, display_name, description, payload_schema)
VALUES
  ('audit.completed', 'Audit Completed', 'Triggered when a domain audit scan completes',
   '{"type":"object","properties":{"audit_id":{"type":"string"},"domain":{"type":"string"},"findings":{"type":"array"},"risk_score":{"type":"number"}}}'),
  ('risk.detected', 'Risk Detected', 'Triggered when a compliance risk is detected',
   '{"type":"object","properties":{"risk_id":{"type":"string"},"severity":{"type":"string","enum":["low","medium","high","critical"]},"title":{"type":"string"}}}'),
  ('incident.created', 'Incident Created', 'Triggered when a new incident is reported',
   '{"type":"object","properties":{"incident_id":{"type":"string"},"incident_type":{"type":"string"},"description":{"type":"string"}}}'),
  ('sub_processor.changed', 'Sub-Processor Changed', 'Triggered when vendor status changes',
   '{"type":"object","properties":{"vendor_id":{"type":"string"},"vendor_name":{"type":"string"},"change_type":{"type":"string","enum":["added","updated","removed"]}}}'),
  ('dpia.completed', 'DPIA Assessment Completed', 'Triggered when DPIA assessment finishes',
   '{"type":"object","properties":{"dpia_id":{"type":"string"},"result":{"type":"string","enum":["compliant","issues_found","requires_review"]}}}'),
  ('policy.violation', 'Policy Violation', 'Triggered when a policy violation is detected',
   '{"type":"object","properties":{"policy_id":{"type":"string"},"violation_type":{"type":"string"},"severity":{"type":"string"}}}'),
  ('agent.completed', 'Agent Run Completed', 'Triggered when an AI agent completes a task',
   '{"type":"object","properties":{"agent_id":{"type":"string"},"run_id":{"type":"string"},"status":{"type":"string","enum":["success","error"]}}}')
ON CONFLICT (event_key) DO NOTHING;

-- 2. Webhook subscriptions (per tenant + event type)
CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL REFERENCES public.webhook_event_types(event_key) ON DELETE CASCADE,

  -- The webhook URL to POST to
  url TEXT NOT NULL,

  -- Secret for HMAC signature verification (stored encrypted in Vault in production)
  -- For now, included in config. Recommend moving to Vault later.
  secret TEXT,

  -- HTTP headers to include in requests (e.g., Authorization: Bearer token)
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Retry policy
  max_retries INT NOT NULL DEFAULT 3 CHECK (max_retries >= 0 AND max_retries <= 10),
  retry_delay_seconds INT NOT NULL DEFAULT 5 CHECK (retry_delay_seconds >= 1 AND retry_delay_seconds <= 3600),

  -- Rate limiting
  rate_limit_per_hour INT NOT NULL DEFAULT 100 CHECK (rate_limit_per_hour > 0),

  enabled BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT webhook_subscriptions_unique UNIQUE (tenant_id, event_key, url)
);

CREATE INDEX IF NOT EXISTS webhook_subscriptions_tenant_enabled_idx
  ON public.webhook_subscriptions(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS webhook_subscriptions_event_key_idx
  ON public.webhook_subscriptions(event_key);

-- 3. Webhook delivery log (append-only, immutable)
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  event_key TEXT NOT NULL,
  event_id TEXT NOT NULL,  -- Reference to the event that triggered this (audit_id, risk_id, etc)

  -- Request details
  url TEXT NOT NULL,  -- snapshot of URL at delivery time
  request_body JSONB NOT NULL,
  request_headers JSONB NOT NULL,

  -- Response details
  status_code INT,
  response_body TEXT,
  error_message TEXT,

  -- Retry tracking
  attempt_number INT NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
  next_retry_at TIMESTAMPTZ,

  -- Delivery status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivered', 'failed', 'rate_limited', 'skipped')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_subscription_status_idx
  ON public.webhook_deliveries(subscription_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_deliveries_tenant_created_idx
  ON public.webhook_deliveries(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_deliveries_next_retry_idx
  ON public.webhook_deliveries(next_retry_at) WHERE status = 'pending' AND next_retry_at <= NOW();

-- 4. RLS Policies
ALTER TABLE public.webhook_event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Event types are public (read-only)
CREATE POLICY webhook_event_types_read ON public.webhook_event_types
  FOR SELECT USING (TRUE);

-- Subscriptions: members SELECT, admins/owners CRUD
CREATE POLICY webhook_subscriptions_member_select ON public.webhook_subscriptions
  FOR SELECT TO authenticated USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE tenant_id = webhook_subscriptions.tenant_id
    )
  );

CREATE POLICY webhook_subscriptions_owner_write ON public.webhook_subscriptions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE tenant_id = webhook_subscriptions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY webhook_subscriptions_owner_update ON public.webhook_subscriptions
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE tenant_id = webhook_subscriptions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY webhook_subscriptions_owner_delete ON public.webhook_subscriptions
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE tenant_id = webhook_subscriptions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Deliveries: service-role only (read-only for humans)
CREATE POLICY webhook_deliveries_member_select ON public.webhook_deliveries
  FOR SELECT TO authenticated USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE tenant_id = webhook_deliveries.tenant_id
    )
  );

-- 5. Trigger to update webhook_subscriptions.updated_at
CREATE OR REPLACE FUNCTION public.webhook_subscriptions_update_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS webhook_subscriptions_update_timestamp ON public.webhook_subscriptions;
CREATE TRIGGER webhook_subscriptions_update_timestamp
  BEFORE UPDATE ON public.webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.webhook_subscriptions_update_timestamp();

-- 6. RPC helper: count pending deliveries for rate limiting
CREATE OR REPLACE FUNCTION public.count_webhook_deliveries_this_hour(
  p_subscription_id UUID
)
RETURNS BIGINT AS $$
  SELECT COUNT(*)
  FROM public.webhook_deliveries
  WHERE subscription_id = p_subscription_id
    AND created_at >= NOW() - INTERVAL '1 hour'
    AND status IN ('delivered', 'pending');
$$ LANGUAGE SQL IMMUTABLE;

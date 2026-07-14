-- Email Notifications System
-- Tracks email alerts for quota events and provides delivery status

CREATE TABLE IF NOT EXISTS public.email_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  event_type      TEXT NOT NULL CHECK (event_type IN ('quota_warning', 'quota_exceeded', 'rate_limit_warning', 'suspicious_activity')),
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  sent_at         TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_tenant ON public.email_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_event_type ON public.email_notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_created ON public.email_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_notifications_unsent ON public.email_notifications(tenant_id) WHERE sent_at IS NULL;

ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_notifications tenant_member_read" ON public.email_notifications;
CREATE POLICY "email_notifications tenant_member_read"
  ON public.email_notifications FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = email_notifications.tenant_id AND m.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "email_notifications service_role_insert" ON public.email_notifications;
CREATE POLICY "email_notifications service_role_insert"
  ON public.email_notifications FOR INSERT
  WITH CHECK (true);

-- Function to queue email notifications
CREATE OR REPLACE FUNCTION public.queue_email_notification(
  p_tenant_id UUID,
  p_recipient_email TEXT,
  p_event_type TEXT,
  p_subject TEXT,
  p_body TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO public.email_notifications (tenant_id, recipient_email, event_type, subject, body, created_at)
  VALUES (p_tenant_id, p_recipient_email, p_event_type, p_subject, p_body, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update notify_quota_alert to also trigger emails
CREATE OR REPLACE FUNCTION public.notify_quota_alert(
  p_tenant_id UUID,
  p_alert_type TEXT,
  p_api_calls_count INTEGER,
  p_quota_limit INTEGER
) RETURNS void AS $$
DECLARE
  v_alert_id UUID;
  v_member_email TEXT;
  v_subject TEXT;
  v_body TEXT;
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

  -- Queue email notifications to tenant admins
  FOR v_member_email IN
    SELECT u.email
    FROM public.memberships m
    JOIN auth.users u ON m.user_id = u.id
    WHERE m.tenant_id = p_tenant_id AND m.role = 'admin'
  LOOP
    v_subject := CASE
      WHEN p_alert_type = 'warning_80' THEN 'Alert: API Quota at 80%'
      WHEN p_alert_type = 'limit_exceeded' THEN 'Alert: API Quota Exceeded'
      ELSE 'API Quota Alert'
    END;

    v_body := CASE
      WHEN p_alert_type = 'warning_80' THEN 'Your API quota usage has reached 80% (' || p_api_calls_count || ' of ' || p_quota_limit || ' calls). Please review your usage or upgrade your plan.'
      WHEN p_alert_type = 'limit_exceeded' THEN 'Your API quota limit has been exceeded (' || p_api_calls_count || ' of ' || p_quota_limit || ' calls). Further API requests will be blocked. Please upgrade your plan or contact support.'
      ELSE 'An API quota event has occurred.'
    END;

    INSERT INTO public.email_notifications (tenant_id, recipient_email, event_type, subject, body, created_at)
    VALUES (p_tenant_id, v_member_email, p_alert_type, v_subject, v_body, now());
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

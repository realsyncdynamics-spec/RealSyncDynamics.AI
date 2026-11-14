-- Minimal live-shaped schema to test notify_quota_alert against the
-- production catalog (ebljyceifhnlzhjfyxup), not the localtest stub
-- that recreated webhook_deliveries with the function's stale columns.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE
);

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text
);

CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_role_check
    CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'dpo'::text, 'editor'::text, 'viewer_auditor'::text]))
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id),
  CONSTRAINT tenant_memberships_role_check
    CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]))
);

CREATE TABLE IF NOT EXISTS public.quota_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  api_calls_count integer NOT NULL,
  quota_limit integer NOT NULL,
  message text,
  webhook_sent boolean DEFAULT false,
  email_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quota_alerts_alert_type_check
    CHECK (alert_type = ANY (ARRAY['warning_80'::text, 'limit_exceeded'::text, 'suspicious_activity'::text]))
);

CREATE TABLE IF NOT EXISTS public.email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  event_type text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_notifications_event_type_check
    CHECK (event_type = ANY (ARRAY['quota_warning'::text, 'quota_exceeded'::text, 'rate_limit_warning'::text, 'suspicious_activity'::text]))
);

CREATE TABLE IF NOT EXISTS public.webhook_event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  payload_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_key text NOT NULL REFERENCES public.webhook_event_types(event_key) ON DELETE CASCADE,
  url text NOT NULL,
  secret text,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_retries integer NOT NULL DEFAULT 3,
  retry_delay_seconds integer NOT NULL DEFAULT 5,
  rate_limit_per_hour integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text,
  endpoint_url text,
  events text[],
  active boolean DEFAULT true,
  signing_algorithm text DEFAULT 'hmac-sha256',
  filter_criteria jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  disabled_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  event_id text NOT NULL,
  url text NOT NULL,
  request_body jsonb NOT NULL,
  request_headers jsonb NOT NULL,
  status_code integer,
  response_body text,
  error_message text,
  attempt_number integer NOT NULL DEFAULT 1,
  next_retry_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'delivered'::text, 'failed'::text, 'rate_limited'::text, 'skipped'::text])),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  url text NOT NULL,
  description text,
  events text[] NOT NULL DEFAULT ARRAY['quota_warning'::text, 'quota_exceeded'::text, 'suspicious_activity'::text],
  is_active boolean NOT NULL DEFAULT true,
  secret_key text NOT NULL DEFAULT 'test-secret',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

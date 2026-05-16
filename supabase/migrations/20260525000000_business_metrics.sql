-- Business-Metrics Pipeline
--
-- Stripe Events → Normalized Tables → Scheduled Aggregation → Snapshot
-- → /dashboard/business reads only snapshots (no live Stripe calls from browser).
--
-- Stores raw Stripe payloads in `raw jsonb` for audit / replay.
-- All writes service_role only; reads gated by profiles.is_super_admin.

-- ─── 1. Extend subscriptions table for trial + price tracking ────────────────
-- Without unit_amount_cents we'd need a live Stripe lookup for every MRR calc.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS unit_amount_cents bigint,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS trial_start timestamptz,
  ADD COLUMN IF NOT EXISTS trial_end timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions (status);
CREATE INDEX IF NOT EXISTS subscriptions_trial_end_idx ON public.subscriptions (trial_end)
  WHERE trial_end IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscriptions_canceled_at_idx ON public.subscriptions (canceled_at)
  WHERE canceled_at IS NOT NULL;

-- ─── 2. Normalized Stripe event tables ───────────────────────────────────────

-- Persisted invoices for revenue/payment analytics.
CREATE TABLE IF NOT EXISTS public.stripe_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id text NOT NULL UNIQUE,
  stripe_customer_id text,
  stripe_subscription_id text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  amount_due_cents bigint NOT NULL DEFAULT 0,
  amount_paid_cents bigint NOT NULL DEFAULT 0,
  amount_remaining_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL,          -- draft | open | paid | void | uncollectible
  billing_reason text,           -- subscription_create | subscription_cycle | etc.
  attempt_count integer NOT NULL DEFAULT 0,
  hosted_invoice_url text,
  invoice_pdf text,
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS stripe_invoices_customer_idx ON public.stripe_invoices (stripe_customer_id);
CREATE INDEX IF NOT EXISTS stripe_invoices_subscription_idx ON public.stripe_invoices (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS stripe_invoices_status_idx ON public.stripe_invoices (status);
CREATE INDEX IF NOT EXISTS stripe_invoices_paid_at_idx ON public.stripe_invoices (paid_at)
  WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS stripe_invoices_tenant_idx ON public.stripe_invoices (tenant_id);

-- Payment / charge events for failed-payment + retry tracking.
CREATE TABLE IF NOT EXISTS public.stripe_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,      -- invoice.paid | invoice.payment_failed | charge.failed | etc.
  stripe_invoice_id text,
  stripe_customer_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  status text NOT NULL,          -- succeeded | failed | pending
  amount_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'eur',
  failure_code text,
  failure_message text,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS stripe_payment_events_status_idx ON public.stripe_payment_events (status);
CREATE INDEX IF NOT EXISTS stripe_payment_events_occurred_idx ON public.stripe_payment_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS stripe_payment_events_customer_idx ON public.stripe_payment_events (stripe_customer_id);
CREATE INDEX IF NOT EXISTS stripe_payment_events_tenant_idx ON public.stripe_payment_events (tenant_id);

-- Trial lifecycle events for conversion analytics.
CREATE TABLE IF NOT EXISTS public.stripe_trial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE,
  stripe_subscription_id text NOT NULL,
  stripe_customer_id text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  kind text NOT NULL,            -- trial_started | trial_will_end | converted | canceled
  trial_start timestamptz,
  trial_end timestamptz,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS stripe_trial_events_subscription_idx ON public.stripe_trial_events (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS stripe_trial_events_kind_idx ON public.stripe_trial_events (kind);
CREATE INDEX IF NOT EXISTS stripe_trial_events_occurred_idx ON public.stripe_trial_events (occurred_at DESC);

-- ─── 3. Aggregated snapshots written by business-metrics-cron ────────────────

-- One row per cron run. Dashboard reads `ORDER BY captured_at DESC LIMIT 1`.
CREATE TABLE IF NOT EXISTS public.business_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  mrr_cents bigint NOT NULL DEFAULT 0,
  arr_cents bigint NOT NULL DEFAULT 0,
  active_customers integer NOT NULL DEFAULT 0,
  active_subscriptions integer NOT NULL DEFAULT 0,
  churned_subscriptions_30d integer NOT NULL DEFAULT 0,
  trial_users integer NOT NULL DEFAULT 0,
  failed_payments_30d integer NOT NULL DEFAULT 0,
  net_new_mrr_cents_30d bigint NOT NULL DEFAULT 0,
  plan_distribution jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ plan_key, customers, mrr_cents }]
  recent_payments jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ stripe_invoice_id, amount_cents, currency, status, paid_at, customer_id }]
  recent_failed_payments jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ stripe_event_id, amount_cents, currency, failure_code, occurred_at, customer_id }]
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer
);

CREATE INDEX IF NOT EXISTS business_metric_snapshots_captured_idx
  ON public.business_metric_snapshots (captured_at DESC);

-- Daily revenue rollup for trend chart. Idempotent on (day, currency).
CREATE TABLE IF NOT EXISTS public.business_revenue_timeseries (
  day date NOT NULL,
  currency text NOT NULL DEFAULT 'eur',
  mrr_cents bigint NOT NULL DEFAULT 0,
  paid_invoice_cents bigint NOT NULL DEFAULT 0,
  failed_invoice_cents bigint NOT NULL DEFAULT 0,
  new_subscriptions integer NOT NULL DEFAULT 0,
  churned_subscriptions integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, currency)
);

-- ─── 4. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_trial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_revenue_timeseries ENABLE ROW LEVEL SECURITY;

-- Helper: force-drop any prior policy with this name before recreate.
-- (super_admin read-only; service_role writes through SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.)

DROP POLICY IF EXISTS "stripe_invoices super_admin_read" ON public.stripe_invoices;
CREATE POLICY "stripe_invoices super_admin_read"
  ON public.stripe_invoices FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));

DROP POLICY IF EXISTS "stripe_payment_events super_admin_read" ON public.stripe_payment_events;
CREATE POLICY "stripe_payment_events super_admin_read"
  ON public.stripe_payment_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));

DROP POLICY IF EXISTS "stripe_trial_events super_admin_read" ON public.stripe_trial_events;
CREATE POLICY "stripe_trial_events super_admin_read"
  ON public.stripe_trial_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));

DROP POLICY IF EXISTS "business_metric_snapshots super_admin_read" ON public.business_metric_snapshots;
CREATE POLICY "business_metric_snapshots super_admin_read"
  ON public.business_metric_snapshots FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));

DROP POLICY IF EXISTS "business_revenue_timeseries super_admin_read" ON public.business_revenue_timeseries;
CREATE POLICY "business_revenue_timeseries super_admin_read"
  ON public.business_revenue_timeseries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));

-- ─── 5. Retention helper ─────────────────────────────────────────────────────
-- Keep every snapshot for 7 days (15-min granularity), then thin to hourly for
-- 30 days, then daily for 1 year, then drop. Idempotent — safe to run every cron.
CREATE OR REPLACE FUNCTION public.prune_business_metric_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 7d–30d: keep one per hour
  DELETE FROM public.business_metric_snapshots a
   WHERE captured_at < now() - interval '7 days'
     AND captured_at >= now() - interval '30 days'
     AND EXISTS (
       SELECT 1 FROM public.business_metric_snapshots b
        WHERE date_trunc('hour', b.captured_at) = date_trunc('hour', a.captured_at)
          AND b.captured_at > a.captured_at
     );

  -- 30d–365d: keep one per day
  DELETE FROM public.business_metric_snapshots a
   WHERE captured_at < now() - interval '30 days'
     AND captured_at >= now() - interval '365 days'
     AND EXISTS (
       SELECT 1 FROM public.business_metric_snapshots b
        WHERE date_trunc('day', b.captured_at) = date_trunc('day', a.captured_at)
          AND b.captured_at > a.captured_at
     );

  -- >365d: drop
  DELETE FROM public.business_metric_snapshots
   WHERE captured_at < now() - interval '365 days';
END;
$$;

REVOKE ALL ON FUNCTION public.prune_business_metric_snapshots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_business_metric_snapshots() TO service_role;

COMMENT ON TABLE public.business_metric_snapshots IS
  'Aggregated business KPIs written by business-metrics-cron edge function every 15 min.';
COMMENT ON TABLE public.stripe_invoices IS
  'Normalized Stripe invoice records persisted by stripe-webhook (invoice.* events).';
COMMENT ON TABLE public.stripe_payment_events IS
  'Stripe payment lifecycle events (paid / failed / refunded) for analytics.';
COMMENT ON TABLE public.stripe_trial_events IS
  'Trial lifecycle markers for conversion analytics.';

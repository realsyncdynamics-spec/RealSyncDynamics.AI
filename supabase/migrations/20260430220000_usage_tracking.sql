-- Usage tracking — append-only event log + aggregated monthly counters.
--
-- Builds on the entitlements catalog from migration 20260430200000:
--   usage_events.entitlement_key      -> entitlements.key
--   usage_limits_config.entitlement_key -> entitlements.key
--
-- Counters are kept in sync via an AFTER INSERT trigger on usage_events.
-- Edge functions never upsert into usage_totals manually; the trigger is the
-- single writer to avoid double-counting.

-- 1. Append-only event log
CREATE TABLE IF NOT EXISTS public.usage_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entitlement_key TEXT NOT NULL REFERENCES public.entitlements(key) ON DELETE CASCADE,
    delta           INTEGER NOT NULL,                -- +1 normal, -1 refund
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_key
    ON public.usage_events(tenant_id, entitlement_key, created_at DESC);

-- date_trunc on timestamptz is STABLE (timezone-dependent) and Postgres rejects
-- it in index expressions. Cast to a TZ-fixed timestamp first to make the call
-- IMMUTABLE; semantics unchanged because every read site treats months in UTC.
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_period
    ON public.usage_events(
        tenant_id,
        entitlement_key,
        (date_trunc('month', (created_at AT TIME ZONE 'UTC')))
    );

-- 2. Aggregated monthly totals
CREATE TABLE IF NOT EXISTS public.usage_totals (
    tenant_id       UUID NOT NULL,
    entitlement_key TEXT NOT NULL,
    period_month    DATE NOT NULL,                   -- always first day of month
    total           INTEGER NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, entitlement_key, period_month)
);

CREATE INDEX IF NOT EXISTS idx_usage_totals_tenant_period
    ON public.usage_totals(tenant_id, entitlement_key, period_month);

-- 3. Per-key limit + billing-mode configuration
CREATE TABLE IF NOT EXISTS public.usage_limits_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entitlement_key TEXT UNIQUE NOT NULL REFERENCES public.entitlements(key) ON DELETE CASCADE,
    hard_limit      INTEGER,                          -- if set: block at this value
    soft_limit      INTEGER,                          -- if set: warn at this value
    billing_mode    TEXT NOT NULL DEFAULT 'included'
                    CHECK (billing_mode IN ('included', 'metered', 'overage', 'none')),
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Atomic upsert helper (used by the trigger)
CREATE OR REPLACE FUNCTION public.upsert_usage_total(
    p_tenant_id       UUID,
    p_entitlement_key TEXT,
    p_period_month    DATE,
    p_delta           INTEGER
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.usage_totals (tenant_id, entitlement_key, period_month, total)
    VALUES (p_tenant_id, p_entitlement_key, p_period_month, GREATEST(p_delta, 0))
    ON CONFLICT (tenant_id, entitlement_key, period_month)
    DO UPDATE SET
        total      = GREATEST(usage_totals.total + p_delta, 0),
        updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.upsert_usage_total(UUID, TEXT, DATE, INTEGER) IS
    'Atomic increment/decrement of usage_totals. Floor at 0 so refunds cannot push totals negative.';

-- 5. Trigger: every usage_events insert keeps usage_totals in sync
CREATE OR REPLACE FUNCTION public.sync_usage_total_on_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.upsert_usage_total(
        NEW.tenant_id,
        NEW.entitlement_key,
        date_trunc('month', NEW.created_at)::DATE,
        NEW.delta
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS usage_events_sync_trigger ON public.usage_events;
CREATE TRIGGER usage_events_sync_trigger
    AFTER INSERT ON public.usage_events
    FOR EACH ROW EXECUTE FUNCTION public.sync_usage_total_on_event();

-- 6. RLS — read for tenant members, writes only via service role
ALTER TABLE public.usage_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_totals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_limits_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_events tenant-read"        ON public.usage_events;
DROP POLICY IF EXISTS "usage_totals tenant-read"        ON public.usage_totals;
DROP POLICY IF EXISTS "usage_limits_config read"        ON public.usage_limits_config;

CREATE POLICY "usage_events tenant-read"
    ON public.usage_events FOR SELECT
    USING (public.is_tenant_member(tenant_id));

CREATE POLICY "usage_totals tenant-read"
    ON public.usage_totals FOR SELECT
    USING (public.is_tenant_member(tenant_id));

CREATE POLICY "usage_limits_config read"
    ON public.usage_limits_config FOR SELECT
    USING (auth.role() = 'authenticated');

-- 7. Seed defaults for the numeric quota keys defined in entitlements.
--    These are app-wide caps that complement the per-plan limits.
INSERT INTO public.usage_limits_config (entitlement_key, hard_limit, soft_limit, billing_mode, description) VALUES
    ('limit.active_assets',              NULL,    NULL,    'included', 'Hard caps come from product_entitlements; this row is a placeholder for billing_mode.'),
    ('limit.monthly_registrations',      NULL,    NULL,    'included', 'Asset registrations per month'),
    ('limit.team_seats',                 NULL,    NULL,    'included', 'Team seats; checked at invitation time'),
    ('limit.api_calls_monthly',          NULL,    NULL,    'metered',  'API calls; metered for overage billing on enterprise plans'),
    ('limit.bulk_jobs_monthly',          NULL,    NULL,    'included', 'Batch jobs per month'),
    ('limit.compliance_exports_monthly', NULL,    NULL,    'included', 'Compliance exports per month')
ON CONFLICT (entitlement_key) DO NOTHING;

COMMENT ON TABLE public.usage_events IS
    'Append-only usage log. delta=+1 for consumption, -1 for refund. Trigger keeps usage_totals in sync.';
COMMENT ON TABLE public.usage_totals IS
    'Aggregated counter per (tenant, entitlement_key, month). Maintained by trigger; do not write directly.';
COMMENT ON TABLE public.usage_limits_config IS
    'Per-key billing-mode and optional global hard/soft caps. Per-plan limits live in product_entitlements.';

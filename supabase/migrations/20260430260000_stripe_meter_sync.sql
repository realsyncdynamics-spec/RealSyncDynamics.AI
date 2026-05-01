-- Stripe Metered Billing — bookkeeping for the periodic sync job.
--
-- For each (tenant, entitlement_key with billing_mode='metered'), we need:
--   * which Stripe subscription_item id to post usage to
--   * what we last reported (so we can post deltas with action='increment'
--     OR an absolute set with action='set' — we use 'set' for idempotency)
--
-- Two tables:
--   metered_subscription_items   immutable mapping (tenant, key) → SI-id
--   usage_meter_sync             rolling state per (tenant, key, period)

-- 1. Mapping table: which Stripe subscription_item gets which entitlement_key
CREATE TABLE IF NOT EXISTS public.metered_subscription_items (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entitlement_key             TEXT NOT NULL REFERENCES public.entitlements(key) ON DELETE CASCADE,
    stripe_subscription_item_id TEXT NOT NULL,
    -- Optional: a multiplier so an internal counter unit can be reported in
    -- Stripe's product unit (e.g. report cost-cents as USD: factor 0.01).
    stripe_unit_factor          NUMERIC NOT NULL DEFAULT 1,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, entitlement_key)
);

CREATE INDEX IF NOT EXISTS idx_metered_subscription_items_key
    ON public.metered_subscription_items(entitlement_key);

ALTER TABLE public.metered_subscription_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "metered_subscription_items tenant-read" ON public.metered_subscription_items;
CREATE POLICY "metered_subscription_items tenant-read"
    ON public.metered_subscription_items FOR SELECT
    USING (public.is_tenant_member(tenant_id));

-- 2. Sync state: what we last posted for a given (tenant, key, period)
CREATE TABLE IF NOT EXISTS public.usage_meter_sync (
    tenant_id        UUID NOT NULL,
    entitlement_key  TEXT NOT NULL,
    period_month     DATE NOT NULL,
    last_quantity    BIGINT NOT NULL DEFAULT 0,
    last_synced_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_status      TEXT,                  -- 'ok' or stripe error code
    last_error       TEXT,
    PRIMARY KEY (tenant_id, entitlement_key, period_month)
);

ALTER TABLE public.usage_meter_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_meter_sync tenant-read" ON public.usage_meter_sync;
CREATE POLICY "usage_meter_sync tenant-read"
    ON public.usage_meter_sync FOR SELECT
    USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.metered_subscription_items IS
    'Maps (tenant, entitlement_key) → Stripe subscription_item id for metered billing.';
COMMENT ON TABLE public.usage_meter_sync IS
    'Per-period state of the Stripe meter sync job. Idempotency key is (tenant, key, period_month).';

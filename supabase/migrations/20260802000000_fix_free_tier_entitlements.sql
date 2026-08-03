-- Fix: Governance free-tier entitlements resolution
--
-- Problem: When a tenant has no subscription record, tenant_entitlements()
-- falls back to 'free' plan which only has asset features, not governance features.
--
-- Solution: Update the RPC to fall back to 'free_tier' for governance module users,
-- or better: check if the tenant has governance features available and prefer free_tier.

-- Update tenant_entitlements() to prefer free_tier as default fallback
CREATE OR REPLACE FUNCTION public.tenant_entitlements(p_tenant_id UUID)
RETURNS TABLE (key TEXT, kind TEXT, value INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH active_sub AS (
        SELECT *
        FROM public.subscriptions
        WHERE tenant_id = p_tenant_id
        ORDER BY updated_at DESC
        LIMIT 1
    ),
    chosen_product AS (
        SELECT p.*
        FROM public.products p
        WHERE p.stripe_price_id = (SELECT stripe_price_id FROM active_sub)
        UNION ALL
        SELECT p.*
        FROM public.products p
        WHERE p.default_for_plan_key = COALESCE(
            (SELECT plan_key FROM active_sub),
            'free_tier'  -- Changed from 'free' to 'free_tier' for governance module
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.products p2
            WHERE p2.stripe_price_id = (SELECT stripe_price_id FROM active_sub)
        )
        LIMIT 1
    )
    SELECT e.key, e.kind, pe.value
    FROM chosen_product cp
    JOIN public.product_entitlements pe ON pe.product_id = cp.id
    JOIN public.entitlements e          ON e.id = pe.entitlement_id;
$$;

COMMENT ON FUNCTION public.tenant_entitlements(UUID) IS
    'Returns the resolved {key, kind, value} entitlement set for the given tenant. Prefers Stripe price match; falls back to default_for_plan_key, then to free_tier.';

-- Also create a trigger to auto-create a free_tier subscription for new tenants
CREATE OR REPLACE FUNCTION public.create_free_tier_subscription_on_tenant_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_free_tier_product_id UUID;
BEGIN
    -- Only create subscription if one doesn't already exist
    IF EXISTS (SELECT 1 FROM public.subscriptions WHERE tenant_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    -- Get the free_tier product ID
    SELECT id INTO v_free_tier_product_id
    FROM public.products
    WHERE default_for_plan_key = 'free_tier'
    LIMIT 1;

    -- If free_tier product doesn't exist, create it
    IF v_free_tier_product_id IS NULL THEN
        INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
        VALUES ('internal_free_tier', 'Free Tier (Dashboard)', 'free_tier')
        ON CONFLICT (stripe_price_id) DO UPDATE
        SET name = EXCLUDED.name, default_for_plan_key = EXCLUDED.default_for_plan_key
        RETURNING id INTO v_free_tier_product_id;
    END IF;

    -- Create a default free_tier subscription for the new tenant
    INSERT INTO public.subscriptions (
        tenant_id,
        stripe_customer_id,
        plan_key,
        status,
        billing_interval
    )
    VALUES (
        NEW.id,
        'free_tier_no_stripe_' || NEW.id,
        'free_tier',
        'active',
        'month'
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_free_tier_subscription_on_tenant_insert ON public.tenants;
CREATE TRIGGER create_free_tier_subscription_on_tenant_insert
    AFTER INSERT ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.create_free_tier_subscription_on_tenant_creation();

-- Backfill: Create subscriptions for existing tenants that don't have one
INSERT INTO public.subscriptions (
    tenant_id,
    stripe_customer_id,
    plan_key,
    status,
    billing_interval
)
SELECT
    t.id,
    'free_tier_no_stripe_' || t.id,
    'free_tier',
    'active',
    'month'
FROM public.tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.tenant_id = t.id
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Migration: 20260711000001_subscription_tenant_unique.sql
-- Description: Add UNIQUE constraint on tenant_id for atomic UPSERT operations

-- Check if constraint already exists to avoid error on re-run
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_tenant_id_key'
  ) THEN
    ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_tenant_id_key UNIQUE (tenant_id);
  END IF;
END $$;

COMMENT ON CONSTRAINT subscriptions_tenant_id_key ON public.subscriptions IS
  'Ensures one active subscription per tenant. Enables atomic UPSERT without race conditions.';

COMMIT;

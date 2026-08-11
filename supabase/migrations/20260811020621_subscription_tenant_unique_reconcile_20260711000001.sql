-- Reconciliation von 20260711000001_subscription_tenant_unique.sql (Repo) — nie in Prod angewendet.
-- UNIQUE(tenant_id) auf subscriptions: Grundlage für den atomaren UPSERT in
-- create-trial-subscription (onConflict: 'tenant_id'). Prod-Tabelle ist leer
-- (0 Zeilen, verifiziert 2026-08-11) — die Constraint greift konfliktfrei.

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

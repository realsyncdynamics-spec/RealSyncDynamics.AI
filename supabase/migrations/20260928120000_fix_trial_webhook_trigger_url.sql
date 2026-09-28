-- Reparatur von trigger_trial_webhook (20260719000000).
--
-- Der Alt-Stand machte
--   current_setting('app.supabase_url', true) || 'https://localhost:54321'
-- Das ist in SQL Konkatenation, kein Fallback. Ergebnis: NULL oder
-- '<url>https://localhost:54321'. Der Trigger feuert, die Function wird
-- nicht erreicht.
--
-- Dieselbe Lücke wie 20260820000000 für die Cron-Jobs: die GUCs sind in
-- Prod nicht gesetzt. Auflösung deshalb über die bereits existierenden
-- Helfer app_functions_base_url() + get_app_secret('service_role_key').
-- Fehlt das Vault-Secret, bricht der Trigger den INSERT nicht ab — er
-- warnt und lässt das Stripe-Event stehen.
--
-- 20260719000000 bleibt unverändert (append-only).

CREATE OR REPLACE FUNCTION public.trigger_trial_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_token text;
BEGIN
  v_url := public.app_functions_base_url() || 'automation-trigger-trial-webhook';
  v_token := public.get_app_secret('service_role_key');

  IF v_token IS NULL OR v_token = '' THEN
    RAISE WARNING 'trial_webhook skipped: vault secret service_role_key missing';
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_url,
      body := jsonb_build_object(
        'stripe_event_id', NEW.stripe_event_id,
        'kind', NEW.kind,
        'tenant_id', NEW.tenant_id,
        'subscription_id', NEW.stripe_subscription_id,
        'customer_id', NEW.stripe_customer_id,
        'trial_end', NEW.trial_end,
        'occurred_at', NEW.occurred_at
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_token
      )
    );
  EXCEPTION WHEN undefined_function THEN
    RAISE WARNING 'net.http_post not available (net extension not installed)';
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trial_webhook trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_trial_webhook() IS
  'Forwards stripe_trial_events inserts to automation-trigger-trial-webhook. URL via app_functions_base_url(); token via vault service_role_key. Missing secret skips the HTTP call and does not fail the insert.';

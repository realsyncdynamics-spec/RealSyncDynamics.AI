-- Trial-Webhook: DB-Trigger auf eigenen Key cron_trial_webhook_key.
--
-- BEFUND
-- trigger_trial_webhook() (Stand 20260928120000) liest den Vault-Eintrag
-- service_role_key. Dieser Eintrag fehlt seit dem
-- Vorfall 2026-09 (service_role-JWT gilt als kompromittiert); die Function
-- automation-trigger-trial-webhook prüfte zudem requireServiceRole. Neue
-- Einträge in stripe_trial_events werden dadurch nicht an n8n weitergereicht.
--
-- VERTRAG (identisch zu docs/runbooks/cron-vault-secrets.md)
--   Aufrufer                         Function                          Vault-Secret
--   Trigger trigger_trial_webhook()  automation-trigger-trial-webhook  cron_trial_webhook_key
-- Die Function löst denselben Key über _shared/cronKey.ts (Function Secret
-- CRON_TRIAL_WEBHOOK_KEY, sonst Vault-Fallback) auf und vergleicht konstantzeitig.
--
-- Übernommen aus #2143 (Phase 2), dort ohne die Cron-Jobs 45/46 — die stellt
-- #2119 (20261101090000) um. Job 47 (automation-trigger-trial-webhook-15min)
-- ist live deaktiviert und bleibt unverändert.
--
-- SAFE: Fehlt der Vault-Eintrag, überspringt der Trigger den HTTP-Aufruf mit
-- WARNING; der INSERT bleibt bestehen. Keine Tabellen, keine Daten.

BEGIN;

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
  v_token := public.get_app_secret('cron_trial_webhook_key');

  IF v_token IS NULL OR v_token = '' THEN
    RAISE WARNING 'trial_webhook skipped: vault secret cron_trial_webhook_key missing';
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
  'Forwards stripe_trial_events inserts to automation-trigger-trial-webhook. URL via app_functions_base_url(); token via vault cron_trial_webhook_key. Missing secret skips the HTTP call and does not fail the insert.';

COMMIT;

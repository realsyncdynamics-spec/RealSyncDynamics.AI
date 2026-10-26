-- Reconcile-Lauf für Voice-Agenten einplanen (pg_cron, alle 15 Minuten).
--
-- Eigene Migration, damit der Zeitplan getrennt von Tabelle und Function
-- (20261026090000) freigegeben werden kann. Der Lauf holt ab:
--   * pending / failed (< MAX_PROVISION_ATTEMPTS) / hängende provisioning —
--     z. B. wenn der Anstoß aus stripe-webhook verloren ging
--   * abgeschlossene Zeilen (active / suspended), rotierend nach
--     reconciled_at — abgelaufene oder widerrufene Grants und geänderte
--     Minuten kommen ohne Stripe-Ereignis an
--
-- Braucht das Vault-Secret `voice_provision_key` (gleicher Wert wie das
-- Function-Secret VOICE_PROVISION_KEY). Fehlt es, bricht jeder Lauf sichtbar
-- in cron.job_run_details ab (dispatch_cron_function, fail-closed).
-- Solange VOICE_PROVISIONING_ENABLED nicht 'true' ist, antwortet die
-- Function sofort mit disabled — der Job ist dann wirkungslos.
--
-- IDEMPOTENT: ein vorhandener Job gleichen Namens wird ersetzt.

BEGIN;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'voice-agent-reconcile') THEN
    PERFORM cron.unschedule('voice-agent-reconcile');
  END IF;
END
$do$;

SELECT cron.schedule(
  'voice-agent-reconcile',
  '*/15 * * * *',
  $cron$ SELECT public.dispatch_cron_function('provision-voice-agent', 'voice_provision_key', jsonb_build_object('trigger', 'cron')) $cron$
);

COMMIT;

-- Zwei Cron-Jobs entfernen, die am 2026-10-30 gegen 08:15 UTC direkt in
-- Produktion angelegt wurden — an Repo und CI vorbei (Befund zu #1634).
--
-- Beide waren seit dem ersten Lauf in jedem Lauf rot: das Supabase-Gateway
-- lehnte sie mit `401 UNAUTHORIZED_INVALID_JWT_FORMAT` ab, bevor die Function
-- lief. Ursache ist ein Vertragsbruch, kein fehlendes Secret:
--
--   * Die Jobs schicken per `dispatch_cron_function` einen Cron-Key aus dem
--     Vault (`cron_scheduler_dispatch_key` bzw. `cron_governance_monitoring_key`).
--   * Beide Functions laufen mit `verify_jwt` = Standard (true) und prüfen
--     zusätzlich `requireServiceRole` — sie nehmen nur den Service-Role-Key an.
--
-- automation-trigger-trial-webhook-15min (jobid 47, */15)
--   Die Function verarbeitet genau EIN Stripe-Trial-Ereignis aus dem POST-Body
--   und wird regulär vom DB-Trigger `trigger_trial_webhook` aufgerufen
--   (Migrationen 20260719000000, 20260928120000). Ein Aufruf ohne Body
--   per Cron hat keinen fachlichen Sinn — er liefe auch mit gültigem Token
--   auf 400. Der reguläre Pfad bleibt unverändert.
--
-- governance-score-calculator-hourly (jobid 46, 15 * * * *)
--   Kein Repo-Vertrag vorhanden. Soll der Score-Rechner stündlich laufen,
--   gehört das als eigener PR ins Repo: Function auf Cron-Key umstellen
--   (`verify_jwt = false`, `CRON_GOVERNANCE_MONITORING_KEY`), Job per
--   Migration anlegen, Zeile in docs/runbooks/cron-vault-secrets.md.
--
-- Gesicherte Definitionen (Befehlstext enthält nur Vault-NAMEN, keine Werte):
--   46 governance-score-calculator-hourly  '15 * * * *'
--      SELECT public.dispatch_cron_function('governance-score-calculator',
--        'cron_governance_monitoring_key',
--        jsonb_build_object('frequency_filter', 'hourly'))
--   47 automation-trigger-trial-webhook-15min  '*/15 * * * *'
--      SELECT public.dispatch_cron_function('automation-trigger-trial-webhook',
--        'cron_scheduler_dispatch_key')
--
-- Idempotent: läuft auch dann sauber, wenn die Jobs schon fehlen
-- (frisches `db reset`, Staging).

DO $$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'automation-trigger-trial-webhook-15min',
    'governance-score-calculator-hourly'
  ] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_name) THEN
      PERFORM cron.unschedule(v_name);
      RAISE NOTICE 'cron job % entfernt', v_name;
    END IF;
  END LOOP;
END
$$;

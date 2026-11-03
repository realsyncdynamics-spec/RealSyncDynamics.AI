-- Phase 2 der Key-Sanierung: drei Maschinen-Endpunkte auf eigene Cron-Keys.
--
-- BEFUND
-- governance-deadline-monitor, governance-score-calculator und
-- automation-trigger-trial-webhook prüften den inbound Bearer exakt gegen
-- SUPABASE_SERVICE_ROLE_KEY (requireServiceRole). Dieser Key gilt seit
-- September nicht mehr als Inbound-Credential. Live antworteten die Ziele
-- deshalb mit 401 (docs/command-center/M9-abnahme-und-rollout.md, B3).
-- Die Functions prüfen jetzt requireCronKey gegen eigene Function Secrets.
--
-- VERTRAG (identisch zu docs/runbooks/cron-vault-secrets.md und config.toml)
--
--   Aufrufer                          Function                          Vault-Secret
--   pg_cron (Job mit deadline-monitor) governance-deadline-monitor      cron_governance_deadline_key
--   pg_cron (Job mit score-calculator) governance-score-calculator      cron_governance_score_key
--   Trigger trigger_trial_webhook()    automation-trigger-trial-webhook cron_trial_webhook_key
--
-- JOBS
-- Die beiden Cron-Jobs stehen in keiner früheren Migration; Name und
-- Zeitplan sind nur live bekannt. Statt sie zu raten, stellt diese Migration
-- per cron.alter_job nur das Kommando jedes Jobs um, dessen Kommando die
-- jeweilige Function aufruft. Name und Zeitplan bleiben unverändert. Gibt es
-- keinen passenden Job (lokal, CI), meldet sie das per NOTICE.
--
-- Jobs, die automation-trigger-trial-webhook aufrufen, bleiben bewusst
-- unberührt: Die Function erwartet einen Event-Body aus stripe_trial_events,
-- den ein Cron-Lauf nicht liefert. Ein solcher Job ist ein eigener Befund.
--
-- TRIGGER
-- trigger_trial_webhook() übernimmt den Stand aus 20260928120000 und holt nur
-- den Token aus cron_trial_webhook_key. Fehlt das Secret, warnt der Trigger
-- und lässt den INSERT stehen (wie bisher).
--
-- IDEMPOTENT / SAFE
-- Keine Tabellen, keine Daten. cron.alter_job und CREATE OR REPLACE lassen
-- sich wiederholen. Rückweg: Kommando bzw. Trigger-Funktion auf den alten
-- Stand zurückschreiben.
--
-- Betreiberschritt (Namen only, keine Werte): docs/runbooks/cron-vault-secrets.md

BEGIN;

DO $$
DECLARE
  v_target   record;
  v_job      record;
  v_count    integer;
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'pg_cron nicht installiert — keine Cron-Jobs umzustellen';
    RETURN;
  END IF;

  FOR v_target IN
    SELECT * FROM (VALUES
      ('governance-deadline-monitor', 'cron_governance_deadline_key'),
      ('governance-score-calculator', 'cron_governance_score_key')
    ) AS t(fn, secret_name)
  LOOP
    v_count := 0;
    FOR v_job IN
      SELECT jobid, jobname
      FROM cron.job
      WHERE command ILIKE '%' || v_target.fn || '%'
      ORDER BY jobid
    LOOP
      PERFORM cron.alter_job(
        job_id  := v_job.jobid,
        command := format(
          'SELECT public.dispatch_cron_function(%L, %L)',
          v_target.fn, v_target.secret_name
        )
      );
      v_count := v_count + 1;
      RAISE NOTICE 'Cron-Job % (%) → dispatch_cron_function(%, %)',
        v_job.jobid, v_job.jobname, v_target.fn, v_target.secret_name;
    END LOOP;

    IF v_count = 0 THEN
      RAISE NOTICE 'Kein Cron-Job ruft % auf — nichts umgestellt', v_target.fn;
    END IF;
  END LOOP;
END;
$$;

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
  'Forwards stripe_trial_events inserts to automation-trigger-trial-webhook. URL via app_functions_base_url(); token via vault cron_trial_webhook_key (Function Secret CRON_TRIAL_WEBHOOK_KEY). Missing secret skips the HTTP call and does not fail the insert.';

COMMIT;

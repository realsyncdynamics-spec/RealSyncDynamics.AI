-- pg_cron-Schedule für den Agent-OS-Runner.
--
-- Zwei Cadences:
--   hourly  → 0  *  *  *  *  (jede volle Stunde)
--   daily   → 0  6  *  *  *  (täglich 06:00 UTC)
--
-- Edge Function: /functions/v1/agent-os-runner (verify_jwt=false,
-- Bearer-Token aus Vault `agent_os_runner_token`).
--
-- Erfordert (einmalig vom Operator zu setzen):
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co';
--   INSERT INTO vault.secrets (name, secret) VALUES
--     ('agent_os_runner_token', '<random-bytes>');
--
-- HINWEIS: pg_cron + pg_net sind Supabase-spezifische Extensions.
-- In CI (Standard-Postgres ohne diese Extensions) wird die Migration
-- graceful übersprungen — Pattern identisch zu market_scanner_cron.

DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron nicht verfügbar (CI-Umgebung) — Schedule wird übersprungen.';
  RETURN;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_net';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net nicht verfügbar — Schedule wird übersprungen.';
  RETURN;
END $$;

-- Vorhandene Schedules entfernen (idempotent).
DO $$
BEGIN
  PERFORM cron.unschedule('agent-os-runner-hourly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-os-runner-hourly');
  PERFORM cron.unschedule('agent-os-runner-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-os-runner-daily');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron.unschedule übersprungen (pg_cron nicht aktiv).';
END $$;

-- Hourly: SLO + SLA-Sweep.
DO $$
BEGIN
  PERFORM cron.schedule(
    'agent-os-runner-hourly',
    '0 * * * *',
    $cron$
      SELECT net.http_post(
        url     := current_setting('app.supabase_url', true) || '/functions/v1/agent-os-runner',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || public.get_app_secret('agent_os_runner_token')
        ),
        body    := jsonb_build_object('cadence', 'hourly')
      );
    $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron.schedule (hourly) übersprungen (pg_cron nicht aktiv).';
END $$;

-- Daily 06:00 UTC: Hermes-Brief + SLO + SLA-Sweep.
DO $$
BEGIN
  PERFORM cron.schedule(
    'agent-os-runner-daily',
    '0 6 * * *',
    $cron$
      SELECT net.http_post(
        url     := current_setting('app.supabase_url', true) || '/functions/v1/agent-os-runner',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || public.get_app_secret('agent_os_runner_token')
        ),
        body    := jsonb_build_object('cadence', 'daily')
      );
    $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron.schedule (daily) übersprungen (pg_cron nicht aktiv).';
END $$;

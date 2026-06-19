-- Aktiviert die zwei bislang nur als Kommentar vorhandenen Cron-Jobs:
--   1. audit-monitor-daily      → Drift-Monitoring (Edge Function audit-monitor-cron)
--      Quelle: 20260509020000_monitoring_tables.sql (Schedule war auskommentiert)
--   2. workflow-runs-sweeper    → Stale-Run-Cleanup (SQL-Funktion sweep_stale_workflow_runs)
--      Quelle: 20260505000000_workflow_runs_sweeper.sql (Schedule war auskommentiert)
--
-- Beide liefen nie automatisch. Diese Migration plant sie via pg_cron.
--
-- Auth/Settings folgen dem Repo-Muster aus 20260624000001_governance_monitoring_cron:
--   - app.supabase_url / app.service_role_key als DB-Settings (zur Cron-Laufzeit aufgelöst)
--   - cron.schedule speichert nur den Command-String → keine Auswertung zur Migrationszeit
--
-- Idempotent: vorhandene Jobs gleichen Namens werden zuvor entfernt.
-- Defensiv: läuft pg_cron nicht (z. B. lokale Test-DB ohne Extension), wird
-- die Migration nicht abgebrochen, sondern nur eine NOTICE ausgegeben.

DO $migration$
BEGIN
  -- Drift-Monitoring: täglich 03:00 UTC
  PERFORM cron.unschedule('audit-monitor-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'audit-monitor-daily');
  PERFORM cron.schedule(
    'audit-monitor-daily',
    '0 3 * * *',
    $cron$
      SELECT net.http_post(
        url     := current_setting('app.supabase_url') || '/functions/v1/audit-monitor-cron',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 60000
      )
    $cron$
  );

  -- Stale-Run-Sweeper: alle 5 Minuten, reiner SQL-Aufruf (keine Auth nötig)
  PERFORM cron.unschedule('workflow-runs-sweeper')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'workflow-runs-sweeper');
  PERFORM cron.schedule(
    'workflow-runs-sweeper',
    '*/5 * * * *',
    $cron$ SELECT public.sweep_stale_workflow_runs(); $cron$
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Cron-Aktivierung übersprungen (pg_cron nicht verfügbar?): %', SQLERRM;
END
$migration$;

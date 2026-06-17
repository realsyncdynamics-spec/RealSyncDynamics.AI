-- Governance OS — Cron-Jobs für Continuous Monitoring
--
-- Setzt pg_cron-Jobs für den governance-monitoring-scheduler.
-- Voraussetzung: pg_cron Extension muss im Supabase-Projekt aktiviert sein.

BEGIN;

-- Täglicher Scan um 02:00 UTC
SELECT cron.schedule(
  'governance-monitoring-daily',
  '0 2 * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/governance-monitoring-scheduler',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    )
  $$
);

-- Stündlicher Scan für hourly-Quellen um :15 jeder Stunde
SELECT cron.schedule(
  'governance-monitoring-hourly',
  '15 * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/governance-monitoring-scheduler',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{"frequency_filter": "hourly"}'::jsonb
    )
  $$
);

COMMIT;

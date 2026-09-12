-- Cron-Trio: Vault-Secret von service_role_key auf dedizierte cron_* Keys.
--
-- BEFUND
-- 20260820000000 registrierte governance-monitoring-*, scan-scheduler-dispatch
-- und memory-decay-hourly mit Vault-Namen `service_role_key`. PR #1334 stellte
-- die Edge Functions auf fail-closed CRON_* Function Secrets um; Live-Hotfixes
-- nutzen bereits Vault `cron_*`. Ohne diese Migration schreibt der nächste
-- Functions-/Migration-Deploy die Job-Kommandos wieder auf service_role_key
-- und die trio-Empfänger antworten mit 401.
--
-- VERTRAG (identisch zu docs/runbooks/cron-vault-secrets.md und den Functions)
--
--   Job                          Function                         Vault-Secret
--   scan-scheduler-dispatch      scheduler-dispatch               cron_scheduler_dispatch_key
--   governance-monitoring-*      governance-monitoring-scheduler  cron_governance_monitoring_key
--   memory-decay-hourly          memory-decay-worker              cron_memory_decay_key
--
-- dispatch_cron_function selbst bleibt unverändert: sie liest p_secret_name
-- zur Laufzeit. Nur die Job-Kommandos wechseln den Namen.
--
-- IDEMPOTENT / SAFE
-- cron.schedule(jobname, ...) ist Upsert per Name. Bereits live gesetzte
-- cron_* Vault-Einträge bleiben gültig. Fehlt ein Secret, bricht der Job mit
-- klarer Meldung ab (gleicher Fail-Closed-Pfad wie bisher).
--
-- ANDERE Jobs (daily-digest, audit-*, sub-processor-notify, …) bleiben auf
-- service_role_key — ihre Edge Functions vergleichen noch den SRK-Bearer.
--
-- Betreiberschritt (Namen only, keine Werte): docs/runbooks/cron-vault-secrets.md

BEGIN;

SELECT cron.schedule(
  'governance-monitoring-daily',
  '0 2 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'governance-monitoring-scheduler',
           'cron_governance_monitoring_key') $cron$
);

SELECT cron.schedule(
  'governance-monitoring-hourly',
  '15 * * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'governance-monitoring-scheduler',
           'cron_governance_monitoring_key',
           jsonb_build_object('frequency_filter', 'hourly')) $cron$
);

SELECT cron.schedule(
  'scan-scheduler-dispatch',
  '*/15 * * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'scheduler-dispatch',
           'cron_scheduler_dispatch_key') $cron$
);

SELECT cron.schedule(
  'memory-decay-hourly',
  '0 * * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'memory-decay-worker',
           'cron_memory_decay_key') $cron$
);

COMMIT;

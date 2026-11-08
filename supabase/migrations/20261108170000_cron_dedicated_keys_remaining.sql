-- Cron: die letzten sechs Jobs von service_role_key auf dedizierte cron_* Keys.
--
-- BEFUND (Live-Logs 2026-11-08, function_edge_logs, 24 h)
-- Alle Jobs, die noch Vault `service_role_key` an dispatch_cron_function
-- übergeben, scheitern mit 401: daily-digest, audit-recheck-daily,
-- audit-email-drip-daily, sub-processor-notify-daily,
-- governance-deadline-monitor-daily, governance-score-calculator-hourly.
-- Der service_role-JWT gilt seit dem Vorfall 2026-09 als kompromittiert und
-- liegt nicht im Vault. Jobs mit dedizierten cron_* Keys (memory-decay-worker,
-- scheduler-dispatch) antworten 200. Gleiches Muster wie
-- 20260912180000_cron_trio_dedicated_keys.sql.
--
-- Die Jobs governance-deadline-monitor-daily (45) und
-- governance-score-calculator-hourly (46) existieren bisher nur in der
-- Produktions-DB, in keiner Migration. Diese Migration holt sie ins Repo.
--
-- VERTRAG (identisch zu docs/runbooks/cron-vault-secrets.md und den Functions)
--
--   Job                                 Function                      Vault-Secret
--   daily-digest                        daily-digest                  cron_daily_digest_key
--   audit-recheck-daily                 audit-recheck-weekly          cron_audit_recheck_key
--   audit-email-drip-daily              audit-drip-cron               cron_audit_drip_key
--   sub-processor-notify-daily          sub-processor-notify          cron_sub_processor_notify_key
--   governance-deadline-monitor-daily   governance-deadline-monitor   cron_governance_deadline_key
--   governance-score-calculator-hourly  governance-score-calculator   cron_governance_score_key
--
-- Zeitpläne und Payloads 1:1 wie live (cron.job, 2026-11-08).
--
-- IDEMPOTENT / SAFE
-- cron.schedule(jobname, ...) ist Upsert per Name. Fehlt ein Vault-Secret,
-- bricht dispatch_cron_function mit klarer Meldung ab; fehlt das Function
-- Secret, antwortet die Function 500 CRON_KEY_MISSING (kein Lauf). Werte
-- gehören nicht in Migrationen — Betreiberschritt im Runbook.
--
-- REIHENFOLGE beim Ausrollen: 1. Vault-Secrets + Function Secrets setzen,
-- 2. Functions deployen, 3. diese Migration anwenden. Vorher bleibt alles
-- beim heutigen Zustand (401).

BEGIN;

SELECT cron.schedule(
  'daily-digest',
  '0 8 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'daily-digest',
           'cron_daily_digest_key') $cron$
);

SELECT cron.schedule(
  'audit-recheck-daily',
  '0 7 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'audit-recheck-weekly',
           'cron_audit_recheck_key') $cron$
);

SELECT cron.schedule(
  'audit-email-drip-daily',
  '0 9 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'audit-drip-cron',
           'cron_audit_drip_key') $cron$
);

SELECT cron.schedule(
  'sub-processor-notify-daily',
  '0 8 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'sub-processor-notify',
           'cron_sub_processor_notify_key') $cron$
);

SELECT cron.schedule(
  'governance-deadline-monitor-daily',
  '0 2 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'governance-deadline-monitor',
           'cron_governance_deadline_key') $cron$
);

SELECT cron.schedule(
  'governance-score-calculator-hourly',
  '15 * * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'governance-score-calculator',
           'cron_governance_score_key',
           jsonb_build_object('frequency_filter', 'hourly')) $cron$
);

COMMIT;

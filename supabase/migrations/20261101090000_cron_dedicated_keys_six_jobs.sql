-- Sechs Cron-Jobs: Vault-Secret von service_role_key auf dedizierte cron_* Keys.
--
-- BEFUND (nur lesend gegen ebljyceifhnlzhjfyxup, 2026-11-01)
-- Sechs aktive Jobs senden noch Vault `service_role_key`. Der service_role-JWT
-- gilt seit September als kompromittiert und ist kein Inbound-Credential
-- (Cron-Trio: 20260912180000). Folgen:
--   * governance-deadline-monitor / governance-score-calculator liefen mit
--     verify_jwt=true; das Gateway antwortete jedem Lauf mit
--     401 UNAUTHORIZED_INVALID_JWT_FORMAT, bevor die Function startete.
--   * daily-digest, audit-recheck-weekly, audit-drip-cron, sub-processor-notify
--     verglichen den Bearer mit SUPABASE_SERVICE_ROLE_KEY.
-- Die Functions pruefen jetzt requireCronKey (_shared/cronKey.ts, fail-closed);
-- governance-deadline-monitor und governance-score-calculator stehen in
-- config.toml auf verify_jwt = false.
--
-- VERTRAG (identisch zu docs/runbooks/cron-vault-secrets.md und den Functions)
--
--   Job                                 Function                     Vault-Secret
--   daily-digest                        daily-digest                 cron_daily_digest_key
--   audit-recheck-daily                 audit-recheck-weekly         cron_audit_recheck_key
--   audit-email-drip-daily              audit-drip-cron              cron_audit_drip_key
--   sub-processor-notify-daily          sub-processor-notify         cron_sub_processor_notify_key
--   governance-deadline-monitor-daily   governance-deadline-monitor  cron_governance_deadline_key
--   governance-score-calculator-hourly  governance-score-calculator  cron_governance_score_key
--
-- Zeitplaene unveraendert gegenueber dem Live-Stand vom 2026-11-01.
-- Die beiden governance-* Jobs wurden am 2026-10-30 direkt in Produktion
-- angelegt und standen in keiner Migration; diese Migration macht sie
-- repo-gestuetzt. (Achtung: Draft-PR #2101 plant, governance-score-calculator-
-- hourly zu entfernen — vor dem Merge entscheiden, welcher Weg gilt.)
--
-- REIHENFOLGE (Betreiber)
--   1. Vault-Eintraege cron_governance_deadline_key / cron_governance_score_key
--      anlegen (Werte nie in Git). Die vier anderen existieren seit 2026-10-04.
--   2. Functions mit dem Code dieses PRs deployen.
--   3. Diese Migration anwenden.
-- Fehlt ein Vault-Eintrag, bricht dispatch_cron_function mit klarer Meldung ab
-- (fail-closed, kein Aufruf mit falschem Key).
--
-- IDEMPOTENT / SAFE
-- cron.schedule(jobname, ...) ist Upsert per Name. Keine Daten werden
-- veraendert, keine Secrets angefasst.

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

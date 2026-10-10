-- audit-monitor-cron: täglicher Re-Scan der monitored_domains (pg_cron).
--
-- BEFUND (gemessen 2026-10-09, read-only gegen ebljyceifhnlzhjfyxup)
-- cron.job hatte KEINEN Job für audit-monitor-cron; der Zeitplan stand nur als
-- Kommentar in 20260509020000_monitoring_tables.sql (mit service_role-Bearer).
-- monitored_domains / audit_monitor_results: je 0 Zeilen.
--
-- WAS DIESE MIGRATION TUT
-- Ausschließlich additiv: legt den pg_cron-Job 'audit-monitor-daily'
-- (04:00 UTC) an, der über public.dispatch_cron_function mit dem DEDIZIERTEN
-- Vault-Key 'cron_audit_monitor_key' die Edge Function audit-monitor-cron
-- aufruft (Muster wie website-rescan-daily, docs/runbooks/cron-vault-secrets.md).
-- Keine Tabellen-, Spalten-, RLS- oder Tenant-Änderung.
-- Kadenz je Plan (täglich / monatlich / keine) entscheidet die Function.
--
-- FEHLT DER VAULT-EINTRAG?
-- Der Job wird trotzdem angelegt; zur Laufzeit bricht dispatch_cron_function
-- ab (Vault-Secret fehlt) → cron.job_run_details failed, kein HTTP-Request,
-- nichts geschrieben. Fehlt nur das Function Secret CRON_AUDIT_MONITOR_KEY,
-- antwortet die Function fail-closed mit 500 ohne Arbeit.
--
-- IDEMPOTENT: ein vorhandener Job gleichen Namens wird ersetzt.
-- Betreiberschritt (nur Namen): Vault cron_audit_monitor_key,
-- Function Secret CRON_AUDIT_MONITOR_KEY (gleicher Wert).

BEGIN;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'audit-monitor-daily') THEN
    PERFORM cron.unschedule('audit-monitor-daily');
  END IF;
END
$do$;

SELECT cron.schedule(
  'audit-monitor-daily',
  '0 4 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'audit-monitor-cron',
           'cron_audit_monitor_key',
           jsonb_build_object('trigger', 'cron')) $cron$
);

COMMIT;

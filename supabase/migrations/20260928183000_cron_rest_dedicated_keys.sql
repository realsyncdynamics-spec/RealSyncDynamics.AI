-- Die vier verbliebenen Cron-Jobs von `service_role_key` auf dedizierte
-- cron_* Keys. Danach benutzt kein Cron-Pfad mehr den Service-Role-Schlüssel.
--
-- BEFUND (gemessen 2026-09-15, Fenster 05:00–10:45 UTC gegen die Live-DB)
-- 20260912180000 hat das Trio (scheduler-dispatch, governance-monitoring-
-- scheduler, memory-decay-worker) auf dedizierte Keys umgestellt und die
-- übrigen Jobs ausdrücklich auf `service_role_key` gelassen — „ihre Edge
-- Functions vergleichen noch den SRK-Bearer". Das war als Zwischenzustand
-- gedacht. Er trägt nicht: Alle vier antworten mit HTTP 401. Der unter
-- `service_role_key` hinterlegte Wert wird von ihren Functions nicht
-- akzeptiert. Damit sind sie seit dem 2026-09-10 ausgefallen, und zwar
-- unsichtbar — `cron.job_run_details` meldet `succeeded`, weil der
-- HTTP-Aufruf abgesetzt wurde; die 401 steht nur in `net._http_response`.
--
-- Zusätzlich gilt für den Schlüssel selbst, was der deployte Quelltext von
-- governance-monitoring-scheduler v18 festhält: der service_role-JWT ist als
-- kompromittiert eingestuft. Ein Cron-Pfad, der ihn weiterreicht, ist auch
-- dann ein Befund, wenn er funktionieren würde.
--
-- VERTRAG (identisch zu docs/runbooks/cron-vault-secrets.md und den Functions)
--
--   Job                          Function               Vault-Secret / Function Secret
--   audit-recheck-daily          audit-recheck-weekly   cron_audit_recheck_key
--   daily-digest                 daily-digest           cron_daily_digest_key
--   sub-processor-notify-daily   sub-processor-notify   cron_sub_processor_notify_key
--   audit-email-drip-daily       audit-drip-cron        cron_audit_drip_key
--
-- Der Vault-Name ist die Datenbankseite, der gleichnamige Function Secret in
-- GROSSSCHREIBUNG die Function-Seite. Beide müssen denselben Wert tragen.
--
-- dispatch_cron_function bleibt unverändert: sie liest p_secret_name zur
-- Laufzeit. Nur die Job-Kommandos wechseln den Namen.
--
-- IDEMPOTENT / SAFE
-- cron.schedule(jobname, ...) ist ein Upsert über den Namen; Zeitplan und
-- Ziel-Function bleiben unverändert, nur das Secret wechselt. Fehlt ein
-- Secret, bricht der Job mit klarer Meldung ab (derselbe Fail-Closed-Pfad wie
-- bisher) — er fällt nicht still auf den alten Schlüssel zurück.
--
-- BETREIBERSCHRITT NACH DEM DEPLOY (Namen only, keine Werte hier):
-- Die vier Vault-Secrets anlegen und dieselben Werte als Function Secrets
-- setzen. Bis dahin brechen die vier Jobs mit „Vault-Secret fehlt" ab —
-- sichtbar in cron.job_run_details, statt wie bisher unsichtbar mit 401.
-- Das ist die Verbesserung, nicht der Nebeneffekt. Anleitung:
-- docs/runbooks/cron-vault-secrets.md

BEGIN;

SELECT cron.schedule(
  'audit-recheck-daily',
  '0 7 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'audit-recheck-weekly',
           'cron_audit_recheck_key') $cron$
);

SELECT cron.schedule(
  'daily-digest',
  '0 8 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'daily-digest',
           'cron_daily_digest_key') $cron$
);

SELECT cron.schedule(
  'sub-processor-notify-daily',
  '0 8 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'sub-processor-notify',
           'cron_sub_processor_notify_key') $cron$
);

SELECT cron.schedule(
  'audit-email-drip-daily',
  '0 9 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'audit-drip-cron',
           'cron_audit_drip_key') $cron$
);

COMMIT;

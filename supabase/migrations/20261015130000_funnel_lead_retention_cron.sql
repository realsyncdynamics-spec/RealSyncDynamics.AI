-- Löschfrist für Funnel-Leads einplanen (pg_cron).
--
-- Eigene Migration, damit Frist und Zeitplan getrennt von der Lead-Erfassung
-- (20261015120000) freigegeben werden können. Ohne diese Datei existiert
-- `purge_stale_funnel_leads()`, läuft aber nie.
--
-- FRIST: 12 Monate ohne Aktivität. Gelöscht werden Leads ohne Konto, ohne
-- Kauf und ohne bestätigte Einwilligung; anonyme Scans ohne Lead verlieren
-- nach derselben Frist ihren Personenbezug (Details in der Funktion).
-- Die Frist steht so auch in der Datenschutzerklärung (Abschnitt 7) — wer sie
-- ändert, ändert beide Stellen.
--
-- Reines SQL, kein HTTP-Aufruf, kein Vault-Secret nötig.
-- IDEMPOTENT: ein vorhandener Job gleichen Namens wird ersetzt.

BEGIN;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'funnel-lead-retention-daily') THEN
    PERFORM cron.unschedule('funnel-lead-retention-daily');
  END IF;
END
$do$;

SELECT cron.schedule(
  'funnel-lead-retention-daily',
  '17 3 * * *',
  $cron$ SELECT public.purge_stale_funnel_leads(interval '12 months') $cron$
);

COMMIT;

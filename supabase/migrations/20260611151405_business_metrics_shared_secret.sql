-- Dokumentations-Migration fuer Migrations-Drift-Guard.
--
-- Am 2026-06-11 15:14:05 UTC wurde direkt auf der Prod-DB ausgefuehrt:
--   SELECT public.set_app_secret('business_metrics_shared_secret', '<echtes Secret>');
--
-- (Vault-Secret fuer den Bearer-Token des business-metrics-cron Edge-Functions-
-- Aufrufs, siehe 20260525000010_business_metrics_cron.sql.) Der echte
-- Secret-Wert wird bewusst NICHT ins Repo committet.
--
-- Diese Datei existiert nur, damit `supabase migration list --linked` die
-- Remote-Version 20260611151405 einer Repo-Datei zuordnen kann
-- (Migration Drift Guard). Sie ist absichtlich ein No-Op.

SELECT 1;

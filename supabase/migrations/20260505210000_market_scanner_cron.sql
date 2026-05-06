-- pg_cron-Schedule: täglich 06:00 UTC market-scanner mit rotate=true.
-- Edge Function rotiert auf Server-Seite durch 12 Branchen
-- (HealthTech → Legal → FinTech → Behörden → HR → Logistik → Handwerk
-- → Gastronomie → Bildung → Immobilien → Marketing → Fertigung).
--
-- Erfordert (einmalig vom Operator zu setzen):
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co';
--   ALTER DATABASE postgres SET app.market_scanner_secret = '<random-bytes>';
--
-- Das Bearer-Token wird der Edge Function zusätzlich als Supabase-Secret
-- `MARKET_SCANNER_SECRET` exponiert (gleicher Wert) — die Function vergleicht
-- header gegen secret. Gleiches Pattern wie ai-invoke / sales-lead.
--
-- HINWEIS: pg_cron und pg_net sind Supabase-spezifische Extensions.
-- In CI (Standard-Postgres ohne diese Extensions) wird die Migration
-- graceful übersprungen.

DO $$
BEGIN
  -- pg_cron laden (nur auf Supabase/pg_cron-fähigen Instanzen verfügbar)
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron nicht verfügbar (CI-Umgebung) — Schedule wird übersprungen.';
  RETURN;
END $$;

DO $$
BEGIN
  -- pg_net laden
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_net';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net nicht verfügbar — Schedule wird übersprungen.';
  RETURN;
END $$;

-- Vorhandene Schedule entfernen (idempotent).
DO $$
BEGIN
  PERFORM cron.unschedule('market-scanner-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'market-scanner-daily');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron.unschedule übersprungen (pg_cron nicht aktiv).';
END $$;

-- Daily 06:00 UTC. Auth-Header trägt das shared secret.
DO $$
BEGIN
  PERFORM cron.schedule(
    'market-scanner-daily',
    '0 6 * * *',
    $cron$
      SELECT net.http_post(
        url     := current_setting('app.supabase_url', true) || '/functions/v1/market-scanner',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.market_scanner_secret', true)
        ),
        body    := jsonb_build_object('depth', 'deep', 'rotate', true)
      );
    $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron.schedule übersprungen (pg_cron nicht aktiv).';
END $$;

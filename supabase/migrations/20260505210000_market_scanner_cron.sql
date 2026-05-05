-- pg_cron-Schedule: täglich 06:00 UTC market-scanner mit rotate=true.
-- Edge Function rotiert auf Server-Seite durch 12 Branchen
-- (HealthTech → Legal → FinTech → Behörden → HR → Logistik → Handwerk
--  → Gastronomie → Bildung → Immobilien → Marketing → Fertigung).
--
-- Erfordert (einmalig vom Operator zu setzen):
--   ALTER DATABASE postgres SET app.supabase_url       = 'https://<ref>.supabase.co';
--   ALTER DATABASE postgres SET app.market_scanner_secret = '<random-bytes>';
--
-- Das Bearer-Token wird der Edge Function zusätzlich als Supabase-Secret
-- `MARKET_SCANNER_SECRET` exponiert (gleicher Wert) — die Function vergleicht
-- header gegen secret. Gleiches Pattern wie ai-invoke / sales-lead.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Vorhandene Schedule entfernen (idempotent).
DO $$
BEGIN
  PERFORM cron.unschedule('market-scanner-daily')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'market-scanner-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Daily 06:00 UTC. Auth-Header trägt das shared secret.
SELECT cron.schedule(
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

COMMENT ON EXTENSION pg_cron IS 'Job scheduler — incl. market-scanner-daily (06:00 UTC, 12-industry rotation).';

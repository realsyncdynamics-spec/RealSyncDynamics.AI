-- pg_cron Job: Daily Digest 08:00 UTC.
-- Calls Edge Function daily-digest, das die KPIs sammelt + Email an
-- FOUNDER_EMAIL (env) bzw. kontakt@realsyncdynamicsai.de (default) sendet.
-- Bei fehlendem RESEND_API_KEY graceful no-op.

DO $$ BEGIN
  PERFORM cron.unschedule('daily-digest');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM cron.schedule(
    'daily-digest',
    '0 8 * * *',
    $cmd$
    SELECT net.http_get(
      url := 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/daily-digest',
      timeout_milliseconds := 30000
    );
    $cmd$
  );
EXCEPTION WHEN OTHERS THEN
  -- cron extension not available in CI bootstrap
  NULL;
END $$;

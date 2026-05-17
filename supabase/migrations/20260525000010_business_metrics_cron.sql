-- pg_cron schedule for business-metrics-cron edge function.
--
-- Runs every 15 minutes. Authenticates via Vault-stored bearer token:
--   SELECT public.set_app_secret('business_metrics_shared_secret', '...');
--
-- Prereqs:
--   1. Vault secret `business_metrics_shared_secret` set
--   2. Edge Function `business-metrics-cron` deployed
--   3. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY available to the function

DO $$
BEGIN
  PERFORM cron.unschedule('business-metrics-cron-15min')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'business-metrics-cron-15min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'business-metrics-cron-15min',
  '*/15 * * * *',
  $cron$
    SELECT net.http_post(
      url     := 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/business-metrics-cron',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'business_metrics_shared_secret' LIMIT 1),
          ''
        )
      ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$
);

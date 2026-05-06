-- pg_cron schedule für stripe-meter-sync.
--
-- Reads bearer secret from Vault (set via public.set_app_secret('stripe_meter_shared_secret', ...)).
-- Hourly :05 minute.
--
-- Voraussetzungen:
--   1. Vault-Secret 'stripe_meter_shared_secret' gesetzt
--   2. Edge-Function-Env STRIPE_SECRET_KEY gesetzt (oder vault 'stripe_secret_key')
--   3. usage_limits_config hat mind. eine row mit billing_mode='metered'
--   4. metered_subscription_items hat Mappings für aktive Kunden mit Overage

DO $$
BEGIN
  PERFORM cron.unschedule('stripe-meter-sync-hourly')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stripe-meter-sync-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'stripe-meter-sync-hourly',
  '5 * * * *',
  $cron$
    SELECT net.http_post(
      url     := 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/stripe-meter-sync',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
           WHERE name = 'stripe_meter_shared_secret' LIMIT 1
        )
      ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$
);

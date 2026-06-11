-- Provision the Vault secret that the business-metrics-cron pg_cron job
-- (migration 20260525000010) and the business-metrics-cron Edge Function
-- both rely on for shared-secret auth.
--
-- Without this secret the cron's `Authorization: Bearer ` header is sent
-- empty (COALESCE(...) || ''), and the function's getSharedSecret() also
-- resolves to null, so every 15-minute run returns 401.
--
-- A random 32-byte hex secret is generated once; both sides read the same
-- value via vault.decrypted_secrets / get_app_secret('business_metrics_shared_secret').

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'business_metrics_shared_secret'
  ) THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'business_metrics_shared_secret',
      'Bearer secret for the business-metrics-cron pg_cron job (15min schedule).'
    );
  END IF;
END $$;

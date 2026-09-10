-- Cron-Jobs ohne Bearer auf den zentralen Dispatch umstellen.
--
-- daily-digest und audit-recheck-weekly riefen die Edge Function per
-- net.http_get ohne Authorization auf (verify_jwt = false). Jeder im
-- Internet konnte den Digest auslösen, inklusive ?email=.
-- audit-email-drip-daily schickte den Anon-Key; der steht im Bundle.
--
-- Dieselben Jobs laufen jetzt über public.dispatch_cron_function mit
-- Vault-Secret service_role_key — dasselbe Muster wie 20260820000000.
-- Fehlt das Secret, bricht der Job mit klarer Meldung ab (kein stilles
-- 401 in net._http_response). Der Betreiberschritt bleibt
-- docs/runbooks/cron-vault-secrets.md.

BEGIN;

SELECT cron.schedule(
  'daily-digest',
  '0 8 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'daily-digest',
           'service_role_key') $cron$
);

SELECT cron.schedule(
  'audit-recheck-daily',
  '0 7 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'audit-recheck-weekly',
           'service_role_key') $cron$
);

SELECT cron.schedule(
  'audit-email-drip-daily',
  '0 9 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'audit-drip-cron',
           'service_role_key') $cron$
);

COMMIT;

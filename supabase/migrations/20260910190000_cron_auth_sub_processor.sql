-- sub-processor-notify-daily von Anon-Bearer auf den zentralen Dispatch.
--
-- 20260507140000 registrierte den Job mit
--   'Bearer ' || current_setting('app.supabase_service_key')
-- in einer Variable namens v_anon_key. Der Anon-Key ist ein gültiges JWT:
-- Gateway-verify_jwt=true lässt ihn durch. Nach dem Bearer-Check in der
-- Function würde genau dieser Job mit 401 enden.
--
-- Derselbe Pfad wie 20260820000000 / 20260910180000: Vault-Secret
-- service_role_key. Fehlt das Secret, bricht der Job mit klarer Meldung
-- ab. Der Betreiberschritt bleibt docs/runbooks/cron-vault-secrets.md.

BEGIN;

SELECT cron.schedule(
  'sub-processor-notify-daily',
  '0 8 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'sub-processor-notify',
           'service_role_key') $cron$
);

COMMIT;

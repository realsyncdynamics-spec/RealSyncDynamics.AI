-- Welcome-Mail beim Anlegen des Kontos, ohne die Anmeldung zu sprengen.
--
-- #1297 hat welcome-email hinter den Service-Role-Bearer gelegt. Ein Aufruf
-- aus handle_new_auth_user über dispatch_cron_function käme dort an — und
-- würde die Anmeldung abbrechen, sobald Vault-Secret service_role_key fehlt
-- (#1252). Genau das Secret fehlt in Produktion.
--
-- Eigener Pfad: try_dispatch_welcome_email schluckt jeden Fehler
-- (fehlendes Secret, kein pg_net, Netz). handle_new_auth_user bleibt
-- unverändert — Profil, Mandant und Mitgliedschaft hängen an seiner
-- Reihenfolge (20260906200000).

BEGIN;

CREATE OR REPLACE FUNCTION public.try_dispatch_welcome_email(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := public.get_app_secret('service_role_key');
  IF v_token IS NULL OR v_token = '' THEN
    RAISE NOTICE
      'welcome-email übersprungen: Vault-Secret service_role_key fehlt';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := public.app_functions_base_url() || 'welcome-email',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body    := jsonb_build_object('user_id', p_user_id),
    timeout_milliseconds := 2000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'welcome-email dispatch fehlgeschlagen: %', SQLERRM;
  RETURN;
END;
$$;

REVOKE ALL    ON FUNCTION public.try_dispatch_welcome_email(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.try_dispatch_welcome_email(uuid) TO service_role;

COMMENT ON FUNCTION public.try_dispatch_welcome_email(uuid) IS
  'Fire-and-forget POST an welcome-email. Fehlt das Vault-Secret oder das Netz, kehrt sie ohne Fehler zurück — die Anmeldung darf daran nicht scheitern.';

CREATE OR REPLACE FUNCTION public.dispatch_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
BEGIN
  PERFORM public.try_dispatch_welcome_email(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_welcome_email() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.dispatch_welcome_email() IS
  'AFTER INSERT auf auth.users. Ruft try_dispatch_welcome_email; wirft nie.';

-- Name sortiert nach on_auth_user_created, damit Profil und Mandant zuerst
-- stehen. welcome-email toleriert ein fehlendes Profil, der Name ist trotzdem
-- die sichere Reihenfolge.
DROP TRIGGER IF EXISTS on_auth_user_welcome_email ON auth.users;
CREATE TRIGGER on_auth_user_welcome_email
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_welcome_email();

COMMIT;

-- Generalisierter Vault-Reader für Edge Functions.
--
-- Hintergrund: Edge-Function-Project-Secrets sind nur via Dashboard/CLI
-- setzbar. Stattdessen speichern wir API-Keys in Supabase Vault und
-- lesen sie zur Laufzeit aus dem Edge Function via RPC.
--
-- providers.ts (_shared) fällt von Deno.env.get(...) automatisch auf
-- get_app_secret(name) zurück, sobald die env-Variable fehlt.
--
-- Erwartete Vault-Namen:
--   anthropic_api_key, gemini_api_key, google_api_key, openai_api_key,
--   ollama_url, ollama_auth_token, market_scanner_token

CREATE OR REPLACE FUNCTION public.get_app_secret(secret_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT decrypted_secret
    FROM vault.decrypted_secrets
   WHERE name = secret_name
   LIMIT 1;
$$;

REVOKE ALL    ON FUNCTION public.get_app_secret(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_app_secret(text) TO service_role;

COMMENT ON FUNCTION public.get_app_secret(text) IS
  'Returns a named secret from Vault. service_role only. Used as fallback by _shared/providers.ts.';

-- Backwards-compat: get_market_scanner_token() jetzt via get_app_secret().
CREATE OR REPLACE FUNCTION public.get_market_scanner_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT public.get_app_secret('market_scanner_token');
$$;

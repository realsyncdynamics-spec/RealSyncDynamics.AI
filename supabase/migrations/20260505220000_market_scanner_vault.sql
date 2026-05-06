-- Vault-Secret + RPC-Wrapper für market-scanner Edge Function.
--
-- Hintergrund: Edge-Function-Project-Secrets sind nur via Dashboard/CLI
-- setzbar (kein SQL-Zugriff). Stattdessen speichern wir den Bearer-Token
-- in Supabase Vault — dort kann er via SQL gesetzt/rotiert werden.
--
-- Da PostgREST nur das `public`-Schema exposed, brauchen wir eine
-- SECURITY-DEFINER-Wrapper-Function in public, die intern Vault liest.
-- Edge Function (service_role) ruft sie via RPC; andere Rollen haben
-- kein EXECUTE.
--
-- Initial-Setup:
--   SELECT vault.create_secret('<random>', 'market_scanner_token', '...');
-- Rotation:
--   UPDATE vault.secrets SET secret = '<new>' WHERE name = 'market_scanner_token';

CREATE OR REPLACE FUNCTION public.get_market_scanner_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret
    FROM vault.decrypted_secrets
   WHERE name = 'market_scanner_token'
   LIMIT 1;
$$;

REVOKE ALL    ON FUNCTION public.get_market_scanner_token() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_market_scanner_token() TO service_role;

COMMENT ON FUNCTION public.get_market_scanner_token() IS
  'Returns the market-scanner Bearer token from Vault. service_role only.';

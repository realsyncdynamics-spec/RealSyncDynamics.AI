-- mcp_api_keys: Clients nur lesen, Schreiben nur ueber service_role.
--
-- Befund 27.09.: Die Policy aus 20260903120000 war FOR ALL ohne WITH CHECK.
-- Jedes Mandanten-Mitglied konnte damit per PostgREST Keys anlegen, fremde
-- Keys reaktivieren, scopes/expires_at aendern und key_hash lesen. Alle
-- legitimen Schreibwege laufen ueber service_role (Edge Function
-- mcp-api-key-manager, apps/mcp-server) und umgehen RLS ohnehin.
--
-- Nicht destruktiv: keine Daten- oder Spaltenaenderung, nur Rechte.

DROP POLICY IF EXISTS "mcp_api_keys tenant members can manage" ON public.mcp_api_keys;
DROP POLICY IF EXISTS "mcp_api_keys tenant members can read" ON public.mcp_api_keys;

CREATE POLICY "mcp_api_keys tenant members can read"
    ON public.mcp_api_keys
    FOR SELECT
    TO authenticated
    USING (public.is_tenant_member(tenant_id));

-- Spaltenrechte: key_hash (Verifier) und last_used_ip (personenbezogen)
-- bleiben fuer Clients unlesbar. Kein Frontend liest die Tabelle direkt.
REVOKE ALL ON public.mcp_api_keys FROM PUBLIC, anon, authenticated;
GRANT SELECT (
    id, tenant_id, key_prefix, name, scopes, created_by, created_at,
    expires_at, last_used_at, active, rotated_from
) ON public.mcp_api_keys TO authenticated;
GRANT ALL ON public.mcp_api_keys TO service_role;

COMMENT ON COLUMN public.mcp_api_keys.key_hash IS
    'PBKDF2-SHA512 mit key-eigenem Salt und Server-Pepper (mcp-api-key-manager, apps/mcp-server key-hash.ts). Fuer Clients nicht lesbar.';

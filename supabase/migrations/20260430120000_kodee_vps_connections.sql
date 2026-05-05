-- KODEE VPS SERVER ACTIONS — V1
-- Zweck: Per-User SSH-Verbindungsdaten + getrennt gespeicherte Schlüssel.
-- Sicherheit: RLS auf vps_connections (Owner-only). vps_ssh_keys ist deny-by-default
-- und wird ausschließlich vom Service-Role-Key in der Edge Function gelesen.

-- 1. Tabelle für Verbindungs-Metadaten (nicht-geheim)
CREATE TABLE IF NOT EXISTS public.vps_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22 CHECK (port BETWEEN 1 AND 65535),
    username TEXT NOT NULL,
    -- SHA256 fingerprint of the host's public key (z.B. "SHA256:abc...").
    -- Wenn gesetzt, MUSS die Edge Function den Host-Key dagegen verifizieren.
    known_host_fingerprint TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

ALTER TABLE public.vps_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nutzer können eigene VPS-Verbindungen lesen"
    ON public.vps_connections FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Nutzer können eigene VPS-Verbindungen anlegen"
    ON public.vps_connections FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Nutzer können eigene VPS-Verbindungen ändern"
    ON public.vps_connections FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Nutzer können eigene VPS-Verbindungen löschen"
    ON public.vps_connections FOR DELETE
    USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_vps_connections_owner
    ON public.vps_connections(owner_id);

CREATE TRIGGER trig_vps_connections_updated_at
    BEFORE UPDATE ON public.vps_connections
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.vps_connections IS
    'Verbindungs-Metadaten für Kodee VPS-Aktionen. Geheime Schlüssel liegen separat in vps_ssh_keys und sind nur per Service-Role lesbar.';

-- 2. Tabelle für SSH-Privatschlüssel (geheim, nur Service-Role)
-- Schlüsselmaterial wird applikationsseitig verschlüsselt (z.B. via Supabase Vault
-- oder libsodium sealed_box) bevor es hier landet. Diese Tabelle hat KEINE Owner-RLS,
-- weil sie ausschließlich vom Server-Side-Code gelesen wird.
CREATE TABLE IF NOT EXISTS public.vps_ssh_keys (
    connection_id UUID PRIMARY KEY REFERENCES public.vps_connections(id) ON DELETE CASCADE,
    -- Verschlüsseltes Schlüsselmaterial. Format ist applikationsdefiniert
    -- (z.B. JSON {alg, ciphertext, nonce}). NICHT direkt usable ohne Decrypt-Step.
    encrypted_private_key BYTEA NOT NULL,
    -- Optional: Fingerprint des öffentlichen Schlüssels für Anzeige in der UI
    public_key_fingerprint TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vps_ssh_keys ENABLE ROW LEVEL SECURITY;

-- Default-Deny: keine Policies = niemand außer Service-Role darf zugreifen.
-- Wir setzen explizit eine Deny-Policy, damit auch Authenticated-Rolle nichts sieht.
CREATE POLICY "vps_ssh_keys ist nur für Service-Role lesbar"
    ON public.vps_ssh_keys FOR ALL
    USING (false)
    WITH CHECK (false);

COMMENT ON TABLE public.vps_ssh_keys IS
    'Verschlüsseltes SSH-Schlüsselmaterial. Default-Deny RLS. Nur Edge Functions mit Service-Role-Key dürfen zugreifen. Niemals via PostgREST/anon/authenticated.';

-- 3. Audit-Log der ausgeführten Aktionen (read-only Verlauf)
CREATE TABLE IF NOT EXISTS public.vps_action_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES public.vps_connections(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    args JSONB DEFAULT '{}'::jsonb,
    success BOOLEAN NOT NULL,
    duration_ms INTEGER,
    error_code TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vps_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nutzer können eigene Action-Logs lesen"
    ON public.vps_action_log FOR SELECT
    USING (auth.uid() = owner_id);

-- INSERT erfolgt ausschließlich serverseitig via Service-Role; keine Insert-Policy für Clients.

CREATE INDEX IF NOT EXISTS idx_vps_action_log_owner_created
    ON public.vps_action_log(owner_id, created_at DESC);

COMMENT ON TABLE public.vps_action_log IS
    'Audit-Trail aller Kodee-VPS-Aktionen. Inserts nur serverseitig.';

-- MCP API Keys Management
--
-- Database-backed API key storage for MCP Server authentication.
-- Keys are hashed (SHA256) — only hash is stored, never the plain key.
-- Supports key rotation, expiration, scope management, and usage tracking.

-- ─── 1. MCP API Keys Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    key_prefix      TEXT NOT NULL,                        -- First 8 chars (unencrypted, for UI)
    key_hash        TEXT NOT NULL UNIQUE,                 -- SHA256 hash (stored)
    name            TEXT,                                 -- User-friendly name (e.g. "Hermes Integration")
    scopes          TEXT[] NOT NULL DEFAULT ARRAY['evidence.read', 'governance.read'],
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,                          -- NULL = never expires
    last_used_at    TIMESTAMPTZ,
    last_used_ip    INET,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    rotated_from    UUID REFERENCES public.mcp_api_keys(id), -- Previous key (for audit)

    UNIQUE (tenant_id, key_prefix)
);

CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_tenant     ON public.mcp_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_hash       ON public.mcp_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_active     ON public.mcp_api_keys(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_expires    ON public.mcp_api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- ─── 2. Key Usage Log (for analytics & abuse detection) ─────────────────
CREATE TABLE IF NOT EXISTS public.mcp_key_usage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id          UUID NOT NULL REFERENCES public.mcp_api_keys(id) ON DELETE CASCADE,
    action          TEXT NOT NULL,                        -- evidence.list, governance.get_status, etc.
    status          INT NOT NULL,                         -- 200, 401, 403, 500, etc.
    ip_address      INET,
    user_agent      TEXT,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    latency_ms      INT,
    error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_mcp_key_usage_key_id    ON public.mcp_key_usage(key_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_key_usage_action    ON public.mcp_key_usage(action, timestamp DESC);

-- ─── 3. RLS Policies ──────────────────────────────────────────────────────
ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_key_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mcp_api_keys tenant members can manage" ON public.mcp_api_keys;
CREATE POLICY "mcp_api_keys tenant members can manage" ON public.mcp_api_keys
    FOR ALL USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "mcp_key_usage tenant can view own logs" ON public.mcp_key_usage;
CREATE POLICY "mcp_key_usage tenant can view own logs" ON public.mcp_key_usage
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.mcp_api_keys k
            WHERE k.id = mcp_key_usage.key_id
            AND public.is_tenant_member(k.tenant_id)
        )
    );

-- ─── 4. Helper Functions ──────────────────────────────────────────────────

-- Check if a key is valid, active, and not expired
CREATE OR REPLACE FUNCTION public.mcp_key_is_valid(p_key_hash TEXT)
RETURNS TABLE (valid BOOLEAN, key_id UUID, tenant_id UUID, scopes TEXT[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT
        (k.active AND (k.expires_at IS NULL OR k.expires_at > now())) AS valid,
        k.id,
        k.tenant_id,
        k.scopes
    FROM public.mcp_api_keys k
    WHERE k.key_hash = p_key_hash;
$$;

-- mcp_key_is_valid prüft Keys, bevor der Aufrufer einen Tenant nachweisen kann —
-- deshalb SECURITY DEFINER. Damit ist die Funktion aber auch ein Orakel für
-- gestohlene Hashes: Ausführung bleibt dem service_role vorbehalten (MCP Server),
-- anon/authenticated dürfen nicht raten.
REVOKE ALL ON FUNCTION public.mcp_key_is_valid(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_key_is_valid(TEXT) TO service_role;

-- Log key usage
CREATE OR REPLACE FUNCTION public.mcp_log_usage(
    p_key_id UUID,
    p_action TEXT,
    p_status INT,
    p_ip INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_latency_ms INT DEFAULT NULL,
    p_error TEXT DEFAULT NULL
)
RETURNS void
-- Bewusst SECURITY INVOKER: nur der service_role (MCP Server) darf Usage-Zeilen
-- schreiben. Als DEFINER könnte jeder Aufrufer fremde key_ids fälschen.
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.mcp_key_usage (
        key_id, action, status, ip_address, user_agent, latency_ms, error_message
    ) VALUES (p_key_id, p_action, p_status, p_ip, p_user_agent, p_latency_ms, p_error);

    -- Update last_used_at
    UPDATE public.mcp_api_keys SET last_used_at = now(), last_used_ip = p_ip WHERE id = p_key_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_log_usage(UUID, TEXT, INT, INET, TEXT, INT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_log_usage(UUID, TEXT, INT, INET, TEXT, INT, TEXT)
    TO service_role;

-- ─── 5. Prüfpfad für den Key-Lebenszyklus ────────────────────────────────
--
-- Der Lebenszyklus (angelegt / geändert / widerrufen) landet in derselben
-- Tabelle wie die Nutzung: mcp_key_usage. Ein Trigger statt Anwendungscode,
-- damit der Eintrag nicht umgangen werden kann — auch nicht vom service_role.
--
-- Bewusst NICHT in audit_evidence, aus zwei Gründen. Erstens schematisch: Die
-- Tabelle beschreibt laut 20260507100000_audit_evidence.sql Audit-Findings
-- (audit_id + type mit CHECK-Constraint) und passt nicht zu
-- Lebenszyklus-Ereignissen eines API-Keys. Zweitens tatsaechlich: Sie
-- existiert in Produktion nicht, obwohl ihre Migration im Ledger als
-- angewendet steht (geprueft 2026-08-31). Spaetere Migrationen fangen das mit
-- to_regclass-Waechtern ab; ein Trigger von hier aus wuerde ins Leere greifen.
--
-- DELETE wird nicht protokolliert: mcp_key_usage.key_id hängt per ON DELETE
-- CASCADE am Key, der Eintrag würde in derselben Anweisung wieder verschwinden.
-- Der vorgesehene Weg ist active = FALSE (Widerruf), nicht DELETE.
CREATE OR REPLACE FUNCTION public.mcp_api_keys_audit()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.mcp_key_usage (key_id, action, status)
        VALUES (NEW.id, 'mcp_api_key.created', 201);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.mcp_key_usage (key_id, action, status)
        VALUES (
            NEW.id,
            CASE WHEN OLD.active AND NOT NEW.active
                 THEN 'mcp_api_key.revoked'
                 ELSE 'mcp_api_key.updated'
            END,
            200
        );
    END IF;
    RETURN NULL;
END;
$$;

-- Nur auf den Spalten feuern, die den Lebenszyklus beschreiben. Sonst würde
-- jedes mcp_log_usage() (das last_used_at schreibt) eine Audit-Zeile erzeugen
-- und sich selbst rekursiv aufschaukeln.
DROP TRIGGER IF EXISTS trg_mcp_api_keys_audit ON public.mcp_api_keys;
CREATE TRIGGER trg_mcp_api_keys_audit_insert
    AFTER INSERT ON public.mcp_api_keys
    FOR EACH ROW EXECUTE FUNCTION public.mcp_api_keys_audit();

CREATE TRIGGER trg_mcp_api_keys_audit_update
    AFTER UPDATE OF active, scopes, expires_at, name ON public.mcp_api_keys
    FOR EACH ROW EXECUTE FUNCTION public.mcp_api_keys_audit();

-- ─── 6. Comments ──────────────────────────────────────────────────────────
COMMENT ON TABLE public.mcp_api_keys IS
    'MCP Server API keys — database-backed key storage with scopes, expiration, and usage tracking.';
COMMENT ON TABLE public.mcp_key_usage IS
    'Usage log for MCP API keys — tracks every key action for analytics and abuse detection.';
COMMENT ON COLUMN public.mcp_api_keys.key_hash IS
    'SHA256 hash of the API key. Only the hash is stored; the plain key is shown once at creation.';
COMMENT ON COLUMN public.mcp_api_keys.key_prefix IS
    'Präfix des Keys (rsmcp_ + 8 Hex-Zeichen) für die Anzeige in der UI. Unverschlüsselt — dient nur dazu, dass Nutzer ihre Keys wiedererkennen.';
COMMENT ON COLUMN public.mcp_api_keys.scopes IS
    'Array of allowed scopes (evidence.read, governance.read, runtime.read, etc). Enforced by MCP Server.';

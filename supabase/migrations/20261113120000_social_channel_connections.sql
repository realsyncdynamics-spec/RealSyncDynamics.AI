-- social_channel_connections — mandantenfaehige Social-Kanalkonten
--
-- Ein Mandant kann mehrere Konten desselben Kanals haben (zwei
-- LinkedIn-Organisationsseiten, persoenliche und Unternehmenspraesenz).
-- Dafuer reicht integration_configs nicht: dort ist typischerweise ein
-- Datensatz je Integration und Mandant. Dieses Muster steht neben
-- integration_configs, analog zu m365_connections
-- (20260905100000_microsoft365_connector.sql).
--
-- Zugangsdaten liegen ausschliesslich AES-256-GCM-versiegelt in
-- credentials_enc (_shared/secretBox.ts, Format v1:<iv>:<ciphertext>).
-- Es gibt keine Klartextspalte. RLS ist zeilenbasiert und kann eine
-- Spalte nicht verbergen — deshalb Spaltenrechte wie in
-- 20260824110000_integration_credentials_hardening.sql:
-- authenticated sieht Metadaten, credentials_enc nicht.
-- Schreiben nur ueber die Edge Function social-channel-connect
-- (service_role). Keine Client-Write-Policy, damit ein spaeterer Grant
-- nicht still Schreibrechte oeffnet.
--
-- DSGVO Art. 32. Additiv: keine bestehende Tabelle wird geaendert.

BEGIN;

CREATE TABLE IF NOT EXISTS public.social_channel_connections (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Provider, nicht der Queue-Kanal (linkedin.enterprise / linkedin.legal).
    -- Der Worker mappt den Queue-Kanal auf diesen Wert.
    channel               text NOT NULL
                          CHECK (channel IN ('linkedin', 'instagram', 'facebook', 'tiktok', 'x')),
    account_external_id   text NOT NULL
                          CHECK (char_length(account_external_id) BETWEEN 1 AND 512),
    account_name          text
                          CHECK (account_name IS NULL OR char_length(account_name) <= 200),
    account_kind          text
                          CHECK (account_kind IS NULL OR char_length(account_kind) <= 64),

    status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'connected', 'expired', 'error', 'disabled', 'revoked')),
    token_expires_at      timestamptz,
    scopes                text[],

    -- Access- und Refresh-Token nur hier, nie als Klartextspalte.
    credentials_enc       text,

    last_error            text,
    connected_at          timestamptz,
    created_by            uuid,
    -- Zeiger auf die Registratur, analog m365_connections.registry_id.
    -- Die Klasse steht dort, abgeleitet aus system_type, nicht hier.
    registry_id           uuid REFERENCES public.connector_registry(id) ON DELETE SET NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),

    UNIQUE (tenant_id, channel, account_external_id)
);

COMMENT ON TABLE public.social_channel_connections IS
    'Social-Kanalkonten je Mandant. Mehrere Konten pro Kanal erlaubt. '
    'Zugangsdaten nur in credentials_enc (secretBox); Clients sehen Metadaten.';

COMMENT ON COLUMN public.social_channel_connections.channel IS
    'Provider (linkedin, instagram, tiktok, x). facebook ist in Entwicklung '
    'und hat keinen Queue-Kanal; der Versand ist nicht verfuegbar. Nicht der '
    'Queue-Kanal linkedin.enterprise / linkedin.legal.';

COMMENT ON COLUMN public.social_channel_connections.credentials_enc IS
    'AES-256-GCM-Siegel der OAuth-Tokens (Format v1:<iv>:<ciphertext>). '
    'Nicht an anon/authenticated vergeben; nur service_role liest und entsiegelt. '
    'Der Client schreibt dieses Siegel nicht; das tut ein spaeterer '
    'serverseitiger OAuth-Tausch.';

COMMENT ON COLUMN public.social_channel_connections.last_error IS
    'Letzter Betriebsfehler. Nur service_role. Nicht an authenticated vergeben.';

COMMENT ON COLUMN public.social_channel_connections.registry_id IS
    'Zeiger auf connector_registry. Klasse C, system_type social_channel.';

COMMENT ON COLUMN public.social_channel_connections.account_external_id IS
    'Stabile Plattform-ID aus OAuth, z. B. LinkedIn-Member- oder Org-URN. '
    'Keine Platzhalter.';

CREATE INDEX IF NOT EXISTS social_channel_connections_tenant_channel_idx
    ON public.social_channel_connections (tenant_id, channel, status);

DROP TRIGGER IF EXISTS trg_social_channel_connections_updated_at
    ON public.social_channel_connections;
CREATE TRIGGER trg_social_channel_connections_updated_at
    BEFORE UPDATE ON public.social_channel_connections
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.social_channel_connections ENABLE ROW LEVEL SECURITY;

-- Metadaten: Mitglieder lesen nur Zeilen des eigenen Mandanten.
DROP POLICY IF EXISTS social_channel_connections_tenant_select
    ON public.social_channel_connections;
CREATE POLICY social_channel_connections_tenant_select
    ON public.social_channel_connections
    FOR SELECT
    USING (public.is_tenant_member(tenant_id));

-- Keine Client-Writes. Anlegen, Rotieren und Trennen laufen in der
-- Edge Function mit service_role (umgeht RLS, braucht aber Grants).

REVOKE ALL ON public.social_channel_connections FROM anon;
REVOKE ALL ON public.social_channel_connections FROM authenticated;

-- Nur was eine Verbindungs-UI braucht. scopes, last_error, created_by,
-- credentials_enc, registry_id und die übrigen Betriebsfelder bleiben
-- bei service_role. Spaltenrechte, nicht eine View: RLS kann eine Spalte
-- nicht verbergen (dieselbe Begründung wie 20260824110000).
GRANT SELECT (
    id,
    tenant_id,
    channel,
    account_external_id,
    account_name,
    status,
    token_expires_at,
    updated_at
) ON public.social_channel_connections TO authenticated;

-- service_role behaelt durch Default-Privileges oft schon DML. Der Grant
-- ist explizit, damit credentials_enc nicht an einem spaeteren Revoke
-- der Defaults haengt. authenticated ist oben bereits ohne diese Spalte.
GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.social_channel_connections TO service_role;

-- Klasse C: der Aufruf geht an die API des Anbieters. Wir können ihn
-- unterlassen, aber nichts abfangen, was dort schon geschehen ist.
-- Vollständige CASE-Liste, damit dieser Ersatz keine bestehende
-- Zuordnung verliert. Zwilling: shared/enforcement-classes.ts.
CREATE OR REPLACE FUNCTION public.connector_enforcement_class(p_system_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT CASE p_system_type
        WHEN 'ai_gateway'     THEN 'A'
        WHEN 'agent_runtime'  THEN 'A'
        WHEN 'sdk_preflight'  THEN 'A'
        WHEN 'chatbot'        THEN 'A'
        WHEN 'whatsapp'       THEN 'A'
        WHEN 'voice'          THEN 'A'
        WHEN 'siteos_publish' THEN 'B'
        WHEN 'cicd_gate'      THEN 'B'
        WHEN 'microsoft365'   THEN 'C'
        WHEN 'social_channel' THEN 'C'
        WHEN 'crm'            THEN 'C'
        WHEN 'erp'            THEN 'C'
        WHEN 'warenwirtschaft' THEN 'C'
        WHEN 'logistik'       THEN 'C'
        WHEN 'ticketing'      THEN 'C'
        WHEN 'messaging'      THEN 'C'
        WHEN 'custom_api'     THEN 'C'
        WHEN 'browser_direct' THEN 'D'
        ELSE 'C'
    END;
$$;

GRANT EXECUTE ON FUNCTION public.connector_enforcement_class(TEXT)
    TO authenticated, service_role;

COMMIT;

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

-- Verbindung, Registratur und Audit in einer Transaktion.
-- Eine PL/pgSQL-Funktion läuft in der Transaktion des Aufrufers; eine
-- Exception macht alle drei Schreibe rückgängig. Es gibt keinen
-- Credential-Parameter: der Client kann hier kein Siegel hinterlegen.
-- Nur service_role darf die Funktion ausführen. Der Aufrufer hat die
-- Mitgliedschaft vorher geprüft.
CREATE OR REPLACE FUNCTION public.social_channel_connection_apply(
    p_op text,
    p_tenant_id uuid,
    p_actor_user_id uuid,
    p_actor_email text,
    p_channel text,
    p_account_external_id text,
    p_connection_id uuid,
    p_account_name text,
    p_account_kind text,
    p_scopes text[],
    p_display_name text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $social$
DECLARE
    v_id uuid;
    v_registry_id uuid;
    v_channel text;
    v_account text;
    v_name text;
    v_status text;
    v_expires timestamptz;
    v_updated timestamptz;
    v_display text;
BEGIN
    IF p_op NOT IN ('configure', 'rotate', 'remove')
       OR p_tenant_id IS NULL
       OR p_actor_user_id IS NULL THEN
        RAISE EXCEPTION 'social_channel_invalid';
    END IF;

    IF p_op IN ('configure', 'rotate') THEN
        IF p_scopes IS NULL
           OR cardinality(p_scopes) < 1
           OR cardinality(p_scopes) > 2
           OR EXISTS (
                SELECT 1
                  FROM unnest(p_scopes) AS scope
                 WHERE scope IS NULL OR scope NOT IN ('openid', 'profile')
           ) THEN
            RAISE EXCEPTION 'social_channel_scopes';
        END IF;
    END IF;

    IF p_op = 'configure' THEN
        IF p_channel IS NULL
           OR p_channel NOT IN ('linkedin', 'instagram', 'facebook', 'tiktok', 'x')
           OR p_account_external_id IS NULL
           OR char_length(btrim(p_account_external_id)) < 1
           OR char_length(p_account_external_id) > 512
           OR p_account_external_id ~ '[[:cntrl:]]'
           OR (p_account_name IS NOT NULL AND char_length(p_account_name) > 200)
           OR (p_account_kind IS NOT NULL AND char_length(p_account_kind) > 64) THEN
            RAISE EXCEPTION 'social_channel_invalid';
        END IF;

        -- Zuerst die Verbindung. Die Registratur entsteht erst danach,
        -- in derselben Transaktion: schlägt sie fehl, bleibt keine
        -- verwaiste Registry-Zeile stehen.
        SELECT id, registry_id
          INTO v_id, v_registry_id
          FROM public.social_channel_connections
         WHERE tenant_id = p_tenant_id
           AND channel = p_channel
           AND account_external_id = p_account_external_id;

        IF v_id IS NULL THEN
            INSERT INTO public.social_channel_connections (
                tenant_id, channel, account_external_id, account_name, account_kind,
                status, scopes, credentials_enc, created_by
            ) VALUES (
                p_tenant_id, p_channel, p_account_external_id, p_account_name, p_account_kind,
                'pending', p_scopes, NULL, p_actor_user_id
            )
            RETURNING id INTO v_id;
        ELSE
            UPDATE public.social_channel_connections
               SET account_name = p_account_name,
                   account_kind = p_account_kind,
                   scopes = p_scopes,
                   updated_at = now()
             WHERE id = v_id
               AND tenant_id = p_tenant_id;
        END IF;

        v_display := COALESCE(
            NULLIF(btrim(p_display_name), ''),
            NULLIF(btrim(p_account_name), ''),
            p_channel
        );

        IF v_registry_id IS NULL THEN
            INSERT INTO public.connector_registry (
                tenant_id, system_type, display_name, auth_kind, scope, status
            ) VALUES (
                p_tenant_id, 'social_channel', v_display, 'oauth2', 'OpenID und Profil', 'pending'
            )
            RETURNING id INTO v_registry_id;

            UPDATE public.social_channel_connections
               SET registry_id = v_registry_id
             WHERE id = v_id
               AND tenant_id = p_tenant_id;
        ELSE
            UPDATE public.connector_registry
               SET display_name = v_display,
                   auth_kind = 'oauth2',
                   scope = 'OpenID und Profil'
             WHERE id = v_registry_id
               AND tenant_id = p_tenant_id;
            IF NOT FOUND THEN
                INSERT INTO public.connector_registry (
                    tenant_id, system_type, display_name, auth_kind, scope, status
                ) VALUES (
                    p_tenant_id, 'social_channel', v_display, 'oauth2', 'OpenID und Profil', 'pending'
                )
                RETURNING id INTO v_registry_id;

                UPDATE public.social_channel_connections
                   SET registry_id = v_registry_id
                 WHERE id = v_id
                   AND tenant_id = p_tenant_id;
            END IF;
        END IF;

    ELSIF p_op = 'rotate' THEN
        IF p_connection_id IS NULL THEN
            RAISE EXCEPTION 'social_channel_invalid';
        END IF;
        UPDATE public.social_channel_connections
           SET scopes = p_scopes,
               updated_at = now()
         WHERE id = p_connection_id
           AND tenant_id = p_tenant_id
        RETURNING id INTO v_id;
        IF v_id IS NULL THEN
            RAISE EXCEPTION 'social_channel_not_found';
        END IF;

    ELSE
        IF p_connection_id IS NULL THEN
            RAISE EXCEPTION 'social_channel_invalid';
        END IF;
        UPDATE public.social_channel_connections
           SET status = 'revoked',
               credentials_enc = NULL,
               last_error = NULL,
               updated_at = now()
         WHERE id = p_connection_id
           AND tenant_id = p_tenant_id
        RETURNING id INTO v_id;
        IF v_id IS NULL THEN
            RAISE EXCEPTION 'social_channel_not_found';
        END IF;
    END IF;

    SELECT channel, account_external_id, account_name, status, token_expires_at, updated_at
      INTO v_channel, v_account, v_name, v_status, v_expires, v_updated
      FROM public.social_channel_connections
     WHERE id = v_id
       AND tenant_id = p_tenant_id;

    INSERT INTO public.governance_admin_log (
        tenant_id, actor_user_id, actor_email, action, target_type, target_id, payload
    ) VALUES (
        p_tenant_id,
        p_actor_user_id,
        p_actor_email,
        CASE p_op
            WHEN 'configure' THEN 'social_channel.configure'
            WHEN 'rotate' THEN 'social_channel.rotate'
            ELSE 'social_channel.remove'
        END,
        'social_channel_connection',
        v_id::text,
        jsonb_build_object(
            'channel', v_channel,
            'account_external_id', v_account,
            'credentials_accepted', false
        )
    );

    RETURN jsonb_build_object(
        'id', v_id,
        'tenant_id', p_tenant_id,
        'channel', v_channel,
        'account_external_id', v_account,
        'account_name', v_name,
        'status', v_status,
        'token_expires_at', v_expires,
        'updated_at', v_updated
    );
END;
$social$;

REVOKE ALL ON FUNCTION public.social_channel_connection_apply(
    text, uuid, uuid, text, text, text, uuid, text, text, text[], text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_channel_connection_apply(
    text, uuid, uuid, text, text, text, uuid, text, text, text[], text
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_channel_connection_apply(
    text, uuid, uuid, text, text, text, uuid, text, text, text[], text
) TO service_role;

COMMENT ON FUNCTION public.social_channel_connection_apply(
    text, uuid, uuid, text, text, text, uuid, text, text, text[], text
) IS
    'Social-Verbindung, connector_registry und governance_admin_log in einer Transaktion. '
    'Kein Credential-Parameter. Nur service_role.';

COMMIT;

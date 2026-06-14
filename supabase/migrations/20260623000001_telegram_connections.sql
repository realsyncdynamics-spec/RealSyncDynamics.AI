-- Telegram Workspace-Verknüpfungen.
--
-- Speichert welcher Telegram-Chat (chat_id/user_id) mit welchem
-- RealSync-Workspace (tenant_id/user_id) verbunden ist.
-- Verbindung erfolgt über einmaligen Connection-Token aus /connect.

CREATE TABLE IF NOT EXISTS public.telegram_connections (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid        REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id                uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  telegram_chat_id       text        NOT NULL,
  telegram_user_id       text        NOT NULL,
  telegram_username      text,
  status                 text        NOT NULL DEFAULT 'pending',
  connection_token_hash  text,
  connected_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT telegram_connections_status_check
    CHECK (status IN ('pending', 'connected', 'revoked')),
  CONSTRAINT telegram_connections_telegram_user_id_key
    UNIQUE (telegram_user_id),
  CONSTRAINT telegram_connections_telegram_chat_id_key
    UNIQUE (telegram_chat_id)
);

COMMENT ON TABLE public.telegram_connections IS
  'Verknüpft Telegram-Nutzer/-Chats mit RealSync-Workspaces.';
COMMENT ON COLUMN public.telegram_connections.connection_token_hash IS
  'SHA-256-Hash des kurzlebigen Connect-Tokens; Klartext wird nie gespeichert.';
COMMENT ON COLUMN public.telegram_connections.status IS
  'pending = Token erzeugt, noch nicht bestätigt; connected = aktiv; revoked = widerrufen.';

-- Index für schnelle Lookups beim Webhook
CREATE INDEX telegram_connections_telegram_user_id_idx
  ON public.telegram_connections (telegram_user_id);
CREATE INDEX telegram_connections_tenant_id_idx
  ON public.telegram_connections (tenant_id);
CREATE INDEX telegram_connections_connection_token_hash_idx
  ON public.telegram_connections (connection_token_hash)
  WHERE connection_token_hash IS NOT NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_telegram_connections_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER telegram_connections_updated_at
  BEFORE UPDATE ON public.telegram_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_telegram_connections_updated_at();

-- RLS aktivieren
ALTER TABLE public.telegram_connections ENABLE ROW LEVEL SECURITY;

-- Service-Role darf alles (Edge Functions)
CREATE POLICY telegram_connections_service_role_all
  ON public.telegram_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authentifizierter Nutzer darf nur eigene Verbindungen lesen
CREATE POLICY telegram_connections_user_select
  ON public.telegram_connections
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

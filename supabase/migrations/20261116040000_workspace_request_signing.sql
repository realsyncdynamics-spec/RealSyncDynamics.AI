-- ═══════════════════════════════════════════════════════════════════════════
--  Workspace-Eingang: signierte Requests (HMAC), Replay-Schutz, Anfragelimit
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Baut auf 20261116020000_workspace_events.sql auf und ändert dort nichts.
--
-- Zweck: Der Ingest-Schlüssel (rsd_gov_…) steht in jedem Request. Wer einen
-- Request mitliest oder den Schlüssel aus einem Log zieht, kann damit beliebige
-- Ereignisse einliefern. Ein zweites, nie übertragenes Geheimnis signiert
-- deshalb Zeitstempel, Nonce und Body (HMAC-SHA256).
--
--   * workspace_signing_secrets: je Ingest-Schlüssel der NAME eines Vault-
--     Secrets. Das Geheimnis selbst liegt nur in Supabase Vault.
--   * workspace_request_nonces: jede Nonce gilt je Schlüssel genau einmal.
--   * claim_workspace_request: prüft Zeitfenster, Anfragelimit und Nonce in
--     einer Anweisung (INSERT … ON CONFLICT), nur service_role.
--
-- Clients (anon, authenticated) haben auf nichts davon Zugriff: RLS ist
-- erzwungen, es gibt keine Policy und kein Tabellenrecht.
-- Additiv, nicht destruktiv.

CREATE TABLE IF NOT EXISTS public.workspace_signing_secrets (
  ingest_key_id     uuid PRIMARY KEY REFERENCES public.governance_ingest_keys(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vault_secret_name text NOT NULL UNIQUE CHECK (vault_secret_name ~ '^workspace_signing_[a-z0-9_]{8,64}$'),
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_request_nonces (
  ingest_key_id uuid NOT NULL REFERENCES public.governance_ingest_keys(id) ON DELETE CASCADE,
  nonce         text NOT NULL CHECK (nonce ~ '^[A-Za-z0-9_-]{16,128}$'),
  seen_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ingest_key_id, nonce)
);

CREATE INDEX IF NOT EXISTS workspace_request_nonces_key_seen_idx
  ON public.workspace_request_nonces (ingest_key_id, seen_at);

ALTER TABLE public.workspace_signing_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_request_nonces  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_signing_secrets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_request_nonces  FORCE ROW LEVEL SECURITY;

-- Supabase vergibt neuen Tabellen in public Standardrechte für anon und
-- authenticated. Hier ausdrücklich entziehen; es gibt bewusst keine Policy.
REVOKE ALL ON public.workspace_signing_secrets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workspace_request_nonces  FROM PUBLIC, anon, authenticated;

-- ─── Signatur-Geheimnis auflösen (nur service_role) ───────────────────────
-- NULL heißt: für diesen Schlüssel ist keine Signatur eingerichtet.
-- Ein eingerichtetes, aber fehlendes oder zu kurzes Vault-Secret ist ein
-- Konfigurationsfehler und wird nicht wie „nicht eingerichtet“ behandelt.
CREATE OR REPLACE FUNCTION public.workspace_signing_secret(p_ingest_key_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_name   text;
  v_secret text;
BEGIN
  SELECT s.vault_secret_name INTO v_name
    FROM public.workspace_signing_secrets s
    JOIN public.governance_ingest_keys k ON k.id = s.ingest_key_id
   WHERE s.ingest_key_id = p_ingest_key_id
     AND k.revoked_at IS NULL
     AND k.tenant_id = s.tenant_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT d.decrypted_secret INTO v_secret FROM vault.decrypted_secrets d WHERE d.name = v_name;
  IF v_secret IS NULL OR char_length(v_secret) < 32 THEN
    RAISE EXCEPTION 'workspace_signing_misconfigured' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_secret;
END $$;

REVOKE ALL ON FUNCTION public.workspace_signing_secret(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_signing_secret(uuid) TO service_role;

-- ─── Request anmelden: Zeitfenster, Limit, Nonce (nur service_role) ───────
-- true  = Nonce neu, Request darf weiter.
-- false = Nonce für diesen Schlüssel schon gesehen (Replay).
-- Ausnahme workspace_timestamp_skew: Zeitstempel außerhalb des Fensters
--   (gegen die Datenbankuhr geprüft, unabhängig von der Edge-Runtime).
-- Ausnahme workspace_rate_limited: zu viele signierte Requests dieses
--   Schlüssels in der letzten Minute. Das Limit ist
--   governance_ingest_keys.rate_limit_per_minute; p_per_minute überschreibt es
--   nur für Tests.
-- Ausnahme workspace_key_invalid: Schlüssel unbekannt oder widerrufen.
CREATE OR REPLACE FUNCTION public.claim_workspace_request(
  p_ingest_key_id uuid,
  p_nonce         text,
  p_signed_at     timestamptz,
  p_max_skew      interval DEFAULT interval '5 minutes',
  p_per_minute    integer  DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_limit  integer;
  v_recent integer;
  v_rows   integer;
BEGIN
  IF p_signed_at IS NULL OR p_max_skew <= interval '0' OR p_max_skew > interval '15 minutes'
     OR p_per_minute < 1 THEN
    RAISE EXCEPTION 'workspace_claim_invalid' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(p_per_minute, k.rate_limit_per_minute) INTO v_limit
    FROM public.governance_ingest_keys k
   WHERE k.id = p_ingest_key_id AND k.revoked_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace_key_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF p_signed_at < now() - p_max_skew OR p_signed_at > now() + p_max_skew THEN
    RAISE EXCEPTION 'workspace_timestamp_skew' USING ERRCODE = 'P0001';
  END IF;

  -- Alte Nonces dieses Schlüssels entfernen. Sie sind nach Ablauf des
  -- Zeitfensters wertlos; eine Stunde Puffer, kein eigener Cron nötig.
  DELETE FROM public.workspace_request_nonces
   WHERE ingest_key_id = p_ingest_key_id AND seen_at < now() - interval '1 hour';

  SELECT count(*) INTO v_recent FROM public.workspace_request_nonces
   WHERE ingest_key_id = p_ingest_key_id AND seen_at > now() - interval '1 minute';
  IF v_recent >= v_limit THEN
    RAISE EXCEPTION 'workspace_rate_limited' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.workspace_request_nonces (ingest_key_id, nonce)
  VALUES (p_ingest_key_id, p_nonce)
  ON CONFLICT (ingest_key_id, nonce) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END $$;

REVOKE ALL ON FUNCTION public.claim_workspace_request(uuid, text, timestamptz, interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_workspace_request(uuid, text, timestamptz, interval, integer) TO service_role;

COMMENT ON TABLE public.workspace_signing_secrets IS
  'Je Ingest-Schlüssel der Name des Vault-Secrets für die HMAC-Signatur von Workspace-Requests. Kein Geheimnis in dieser Tabelle. Zugriff nur über workspace_signing_secret (service_role).';
COMMENT ON TABLE public.workspace_request_nonces IS
  'Einmal-Nonces signierter Workspace-Requests je Ingest-Schlüssel (Replay-Schutz und Anfragelimit). Schreiben nur über claim_workspace_request (service_role).';

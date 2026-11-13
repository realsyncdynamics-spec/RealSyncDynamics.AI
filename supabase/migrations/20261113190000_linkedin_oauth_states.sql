-- linkedin_oauth_states — einmaliger CSRF-State fuer den LinkedIn-OAuth.
--
-- Der Authorization-Code-Flow braucht einen State, der an Mandant und
-- Nutzer gebunden, kurzlebig und nur einmal einloesbar ist. Der Rohwert
-- steht nicht in der Tabelle, nur sein SHA-256 (state_hash). Tokens
-- gehoeren hier nicht hin; die liegen versiegelt in
-- social_channel_connections.credentials_enc.
--
-- Zeitstempel 20261113190000: 20261113120000 (#2211), 20261113140000
-- (#2210), 20261113150000 (#2212), 20261113152000 und 20261113153000
-- (offene P0-PRs) und 20261113180000 (#2213) sind belegt.
--
-- RLS an, keine Policy. anon und authenticated haben keine Rechte.
-- Schreiben und Lesen nur service_role aus der Edge Function
-- linkedin-oauth. Additiv: keine bestehende Tabelle wird geaendert.

BEGIN;

CREATE TABLE IF NOT EXISTS public.linkedin_oauth_states (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    state_hash   text NOT NULL UNIQUE
                 CHECK (state_hash ~ '^[0-9a-f]{64}$'),
    tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    -- auth.users.id aus dem geprueften JWT beim Start. Kein FK nach auth,
    -- damit die Tabelle nicht am Auth-Schema haengt.
    user_id      uuid NOT NULL,
    return_url   text NOT NULL
                 CHECK (char_length(return_url) BETWEEN 8 AND 500),
    scopes       text[] NOT NULL
                 CHECK (
                   scopes <@ ARRAY['openid', 'profile', 'w_member_social', 'w_organization_social']::text[]
                   AND 'openid' = ANY (scopes)
                   AND 'profile' = ANY (scopes)
                   AND 'w_member_social' = ANY (scopes)
                 ),
    expires_at   timestamptz NOT NULL,
    consumed_at  timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.linkedin_oauth_states IS
    'Einmaliger LinkedIn-OAuth-State (SHA-256). Keine Tokens. '
    'Nur service_role. Ablauf etwa 10 Minuten.';

COMMENT ON COLUMN public.linkedin_oauth_states.state_hash IS
    'SHA-256 des kryptografischen State, hex. Der Rohwert wird nicht gespeichert.';

COMMENT ON COLUMN public.linkedin_oauth_states.return_url IS
    'Frontend-Ruecksprung, beim Start gegen LINKEDIN_OAUTH_RETURN_URLS geprueft.';

CREATE INDEX IF NOT EXISTS linkedin_oauth_states_expires_idx
    ON public.linkedin_oauth_states (expires_at);

ALTER TABLE public.linkedin_oauth_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.linkedin_oauth_states FROM PUBLIC;
REVOKE ALL ON public.linkedin_oauth_states FROM anon;
REVOKE ALL ON public.linkedin_oauth_states FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.linkedin_oauth_states TO service_role;

COMMIT;

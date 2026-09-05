-- Integrationen beidseitig machen (Zielarchitektur §9).
-- Kern der Beobachtungsseite: supabase/functions/_shared/github-observation.ts
--
-- ## Was hier fehlte
--
-- Die Delta-Zeile nannte `integration_connectors` und `remediation_actions`
-- als Ist-Zustand. Beide Tabellen sind richtig geschnitten — und beide waren
-- **nie angeschlossen**: je genau eine Referenz im Code, beide nur `.select()`.
-- Kein Schreibpfad, keine Beobachtung, kein Ausfallzustand.
--
-- Drei Dinge fehlten, und nur diese drei kommen hinzu:
--
--   1. Ein Ort fuer Zugangsdaten, den der Client nicht lesen kann (§9 Regel 2)
--   2. Ein Beobachtungslauf, dessen Scheitern ein Zustand ist (§9 Regel 4)
--   3. Der Bezug zum Asset, damit Beobachtung am Objekt landet und nicht
--      neben ihm (§4)
--
-- ## Der Grund fuer Tabelle 1 ist ein Befund, kein Entwurf
--
-- `connectors_tenant_read` gibt `authenticated` SELECT auf **die ganze Zeile**
-- von `integration_connectors`, einschliesslich `config JSONB`. Ein Token dort
-- waere aus dem Browser lesbar — genau das, was §9 Regel 2 ausschliesst
-- ("liegen ausschliesslich serverseitig — nie im Client").
--
-- Dieselbe Luecke hat `shopify_shops`: `shopify_shops_tenant_read` reicht
-- `access_token_encrypted` an `authenticated` durch. Das ist das vorhandene
-- Muster im Repo — und der Grund, es hier NICHT zu kopieren. Der Befund zu
-- Shopify ist gemeldet, aber in dieser Migration bewusst nicht angefasst:
-- eine bestehende Policy zu aendern, waehrend ein Schreibpfad daran haengt,
-- gehoert in einen eigenen Schnitt mit eigener Pruefung.

-- ── 1. Zugangsdaten, getrennt vom lesbaren Teil ─────────────────────────────
-- Eine eigene Tabelle statt einer Spalte: Spaltenweise RLS gibt es in
-- PostgreSQL nicht. Solange das Geheimnis in derselben Zeile liegt wie der
-- Anzeigename, entscheidet eine Policy ueber beides zugleich.

CREATE TABLE IF NOT EXISTS public.integration_connector_secrets (
  connector_id UUID PRIMARY KEY
    REFERENCES public.integration_connectors(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Verschluesselt durch die Edge Function, bevor sie hierher schreibt. Die
  -- Datenbank sieht nie den Klartext; der Schluessel liegt in der Function-Env.
  token_encrypted TEXT NOT NULL,

  -- Welche Rechte das Token traegt — fuer die Anzeige "minimal berechtigt"
  -- (§9 Regel 2) und um bei einem 403 unterscheiden zu koennen zwischen
  -- "Recht fehlt" und "Integration kaputt".
  scopes TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at TIMESTAMPTZ
);

ALTER TABLE public.integration_connector_secrets ENABLE ROW LEVEL SECURITY;

-- **Bewusst nur eine Policy.** Es gibt keine fuer `authenticated`, auch keine
-- lesende. Ein Mandantenmitglied erfaehrt ueber `integration_connectors`,
-- DASS eine Verbindung besteht und wie es ihr geht — nie, womit sie sich
-- ausweist.
DROP POLICY IF EXISTS "connector_secrets_service_all" ON public.integration_connector_secrets;
CREATE POLICY "connector_secrets_service_all" ON public.integration_connector_secrets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.integration_connector_secrets IS
  'Zugangsdaten je Connector. Service-Role only, ohne Leserecht fuer '
  'authenticated (§9 Regel 2). Getrennte Tabelle, weil PostgreSQL keine '
  'spaltenweise RLS kennt und integration_connectors vom Client gelesen wird.';

-- ── 2. Der Connector bekommt Asset-Bezug und Betriebszustand ────────────────
-- Additiv, alles nullable: bestehende Zeilen bleiben gueltig.

ALTER TABLE public.integration_connectors
  ADD COLUMN IF NOT EXISTS asset_id         UUID REFERENCES public.governance_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status           TEXT,
  ADD COLUMN IF NOT EXISTS last_observed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error       TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integration_connectors_status_check') THEN
    ALTER TABLE public.integration_connectors
      ADD CONSTRAINT integration_connectors_status_check CHECK (
        status IS NULL OR status IN ('connected', 'error', 'revoked', 'unverified')
      );
  END IF;

  -- §9 Regel 2, im Schema statt in der Codereview durchgesetzt: `config` ist
  -- vom Client lesbar, also darf dort kein Geheimnis stehen. Die Regel greift
  -- nur auf der obersten Ebene — tiefer verschachtelte Schluessel faengt sie
  -- nicht. Das ist eine Schranke gegen den naheliegenden Fehler, kein Beweis
  -- der Abwesenheit; der eigentliche Schutz ist, dass es die Tabelle oben gibt.
  --
  -- NOT VALID: Die Pruefung gilt ab sofort fuer jedes INSERT und UPDATE,
  -- validiert aber den Bestand nicht. Bestandszeilen gibt es heute nicht
  -- (die Tabelle hat keinen Schreibpfad) — aber eine Migration, die an
  -- fremden Altdaten scheitern KANN, blockiert nach CLAUDE.md §5 den
  -- gesamten Deploy, auch fuer unbeteiligte Migrationen. Der Preis dafuer,
  -- das auszuschliessen, ist ein NOT VALID.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integration_connectors_config_no_secrets') THEN
    ALTER TABLE public.integration_connectors
      ADD CONSTRAINT integration_connectors_config_no_secrets CHECK (
        NOT (config ?| ARRAY[
          'token', 'secret', 'password', 'api_key', 'apiKey',
          'access_token', 'accessToken', 'private_key', 'privateKey',
          'client_secret', 'clientSecret'
        ])
      ) NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.integration_connectors.status IS
  'Betriebszustand (§9 Regel 4). "error" wird gesetzt, wenn eine Beobachtung '
  'scheitert — ein Ausfall ist ein bekannter Zustand, kein stiller Verlust.';

COMMENT ON COLUMN public.integration_connectors.asset_id IS
  'Das beobachtete Asset (§4). Bei GitHub ein governance_assets-Eintrag mit '
  'asset_type = repository.';

COMMENT ON CONSTRAINT integration_connectors_config_no_secrets ON public.integration_connectors IS
  '§9 Regel 2: config ist vom Client lesbar (connectors_tenant_read), also '
  'gehoert kein Geheimnis hinein. Zugangsdaten nach '
  'integration_connector_secrets.';

-- ── 3. Der Beobachtungslauf, samt Scheitern ─────────────────────────────────
-- §9 Regel 4: "Ausfall einer Integration ist ein bekannter Zustand mit
-- Ereignis, kein stiller Datenverlust — eine ausgefallene Beobachtung ist
-- beobachtbar."
--
-- Ein Lauf wird deshalb VOR dem Netzaufruf angelegt und danach fortgeschrieben.
-- Wer die Zeile erst nach Erfolg schreibt, hat von einem Timeout keine Spur.

CREATE TABLE IF NOT EXISTS public.integration_observations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES public.integration_connectors(id) ON DELETE CASCADE,
  asset_id     UUID REFERENCES public.governance_assets(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),

  -- Wie viele Befunde der Lauf erzeugt hat. 0 bei `completed` heisst
  -- "nichts gefunden", 0 bei `failed` heisst "nicht nachgesehen" — deshalb
  -- ist der Status und nicht die Zahl die Aussage.
  finding_count INT NOT NULL DEFAULT 0,

  -- Felder, die nicht festgestellt werden konnten (undeterminedFields()).
  -- Ein Lauf kann erfolgreich und trotzdem unvollstaendig sein: ein Token
  -- ohne admin:repo bekommt auf die Branch-Protection einen 403. Ohne diese
  -- Liste liest sich das Ergebnis als Entwarnung.
  undetermined TEXT[] NOT NULL DEFAULT '{}',

  error_code    TEXT,
  error_message TEXT,

  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS integration_observations_connector_idx
  ON public.integration_observations (connector_id, started_at DESC);

CREATE INDEX IF NOT EXISTS integration_observations_tenant_idx
  ON public.integration_observations (tenant_id, started_at DESC);

ALTER TABLE public.integration_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_observations_service_all" ON public.integration_observations;
CREATE POLICY "integration_observations_service_all" ON public.integration_observations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Lesen fuer Mitglieder: Der Ausfall soll sichtbar sein, sonst waere Regel 4
-- eine Notiz im Log statt einer Aussage an den Kunden.
DROP POLICY IF EXISTS "integration_observations_tenant_read" ON public.integration_observations;
CREATE POLICY "integration_observations_tenant_read" ON public.integration_observations
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

COMMENT ON TABLE public.integration_observations IS
  'Beobachtungslauf einer Integration (§9 Regel 1 und 4). Wird vor dem '
  'Netzaufruf angelegt, damit auch ein Timeout eine Zeile hinterlaesst.';

COMMENT ON COLUMN public.integration_observations.undetermined IS
  'Nicht feststellbare Felder. Ein erfolgreicher, aber unvollstaendiger Lauf '
  'ist kein Freispruch — ohne diese Liste liest sich "0 Befunde" falsch.';

-- Warteliste für frühen Zugang (Landingpage /warteliste).
--
-- Zweck: Interessenten für noch nicht allgemein verfügbare Module (Governance
-- Runtime, SiteOS, Evidence Vault, Provenance) einsammeln, bevor Kapazität
-- freigegeben wird. Kein Tenant-Bezug — die Anmeldung erfolgt vor der
-- Registrierung, es gibt also noch keinen Workspace, an dem `tenant_id` hängen
-- könnte. Sobald ein Eintrag konvertiert, wird `converted_tenant_id` gesetzt.
--
-- DSGVO: Art. 6 Abs. 1 lit. b/f — vorvertragliche Kontaktaufnahme. Die
-- Einwilligung wird mit `consent_at`, `ip_hash` (nicht die Klartext-IP) und
-- `user_agent` nachweisbar dokumentiert. Klartext-IPs werden bewusst nicht
-- gespeichert; für Missbrauchsabwehr (Rate-Limit) reicht der Hash.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Fortlaufende Nummer = Wartelistenposition. BIGSERIAL statt COUNT(*), damit
  -- die einmal vergebene Position auch nach Löschungen (Art. 17 DSGVO) stabil
  -- bleibt — sonst würde die Auskunft an bereits Angemeldete inkonsistent.
  position             BIGSERIAL NOT NULL UNIQUE,
  email                TEXT NOT NULL,
  company              TEXT,
  role                 TEXT,
  -- Welches Modul den Ausschlag gab. Freitext-CHECK statt Enum, damit neue
  -- Module ohne Typ-Migration ergänzt werden können.
  interest             TEXT NOT NULL DEFAULT 'runtime'
                         CHECK (interest IN (
                           'runtime', 'siteos', 'evidence', 'provenance', 'audit', 'other'
                         )),
  team_size            TEXT
                         CHECK (team_size IS NULL OR team_size IN (
                           '1-9', '10-49', '50-249', '250-999', '1000+'
                         )),
  note                 TEXT,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'invited', 'converted', 'declined')),
  source               TEXT,
  referrer             TEXT,
  utm                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash              TEXT,
  user_agent           TEXT,
  consent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_at           TIMESTAMPTZ,
  converted_at         TIMESTAMPTZ,
  converted_tenant_id  UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Eine aktive Anmeldung pro Adresse. Abgelehnte Einträge blockieren eine
-- erneute Anmeldung nicht.
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_email_active_idx
  ON public.waitlist_signups (lower(email))
  WHERE status IN ('pending', 'invited', 'converted');

CREATE INDEX IF NOT EXISTS waitlist_signups_status_idx
  ON public.waitlist_signups (status);
CREATE INDEX IF NOT EXISTS waitlist_signups_interest_idx
  ON public.waitlist_signups (interest);
-- Deckt das Rate-Limit-Fenster der Edge Function ab (ip_hash + Zeitfenster).
CREATE INDEX IF NOT EXISTS waitlist_signups_ip_created_idx
  ON public.waitlist_signups (ip_hash, created_at);

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Anon-Clients bekommen bewusst KEINE Insert-Policy: die öffentliche Anmeldung
-- läuft ausschließlich über die Edge Function `waitlist-join` mit
-- Service-Role-Key (dieselbe Trennung wie beim Kontaktformular und beim
-- Newsletter). Damit sind Rate-Limit und Validierung nicht umgehbar.
DROP POLICY IF EXISTS "waitlist super_admin_read" ON public.waitlist_signups;
CREATE POLICY "waitlist super_admin_read"
  ON public.waitlist_signups FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));

DROP POLICY IF EXISTS "waitlist super_admin_update" ON public.waitlist_signups;
CREATE POLICY "waitlist super_admin_update"
  ON public.waitlist_signups FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));

COMMENT ON TABLE public.waitlist_signups IS
  'Warteliste für frühen Modul-Zugang. Öffentliche Inserts nur über Edge Function waitlist-join (Service-Role).';
COMMENT ON COLUMN public.waitlist_signups.position IS
  'Stabile Wartelistenposition — bleibt nach Löschungen anderer Einträge unverändert.';
COMMENT ON COLUMN public.waitlist_signups.ip_hash IS
  'SHA-256 der Client-IP. Datenminimierung: Klartext-IP wird nie gespeichert, Hash reicht für Rate-Limit.';

-- Migration: 20260826000000_siteos_anonymous_drafts.sql
-- SiteOS — anonyme Entwürfe vor dem Konto.
--
-- Additiv. Es werden keine bestehenden Tabellen oder Policies verändert; die
-- einzige Änderung an Bestehendem ist eine erweiterte CHECK-Liste (s.u.).
--
-- ── Warum eine Tabelle ohne tenant_id ────────────────────────────────────
--
-- Der Produktkern lautet: Ein Besucher beschreibt eine Website, sieht sie,
-- ändert sie — und erst wenn er sie behalten will, legt er ein Konto an. Der
-- Entwurf entsteht also zu einem Zeitpunkt, an dem es keinen Mandanten gibt,
-- unter dem er stehen könnte.
--
-- Diese Tabelle ist deshalb bewusst die Ausnahme von der Regel „jede
-- Geschäftstabelle hat tenant_id". Damit die Ausnahme keine Lücke wird, gilt
-- hier **Deny by default**: Es gibt für `authenticated` keine einzige Policy —
-- weder lesend noch schreibend. Nur `service_role` (also ausschliesslich Edge
-- Functions) kommt heran. Dasselbe Muster benutzt bereits
-- `shadow_runtime_events`.
--
-- Der Entwurf ist über einen unratbaren Schlüssel erreichbar und **nicht
-- auflistbar**. Er verfällt von selbst; ohne Übernahme wird er gelöscht. Das
-- ist die Antwort auf DSGVO Art. 5 Abs. 1 lit. e für Inhalte, die jemand ohne
-- Konto hinterlässt — er hat in keine Speicherung eingewilligt.
--
-- Beim Project Claim wandert der Entwurf nach `siteos_blueprints` und bekommt
-- dort Mandant, RLS, Versionskette und Prüfpfad. Erst dann ist er dauerhaft.

-- Der Sicherheits-Gate-Prüfpfad für anonyme Aufrufe kennt bisher vier
-- Operationen. Der Site-Build ist die fünfte. Additiv: Die bestehenden vier
-- bleiben unverändert gültig.
ALTER TABLE public.anon_chat_runs DROP CONSTRAINT IF EXISTS anon_chat_runs_op_check;
ALTER TABLE public.anon_chat_runs ADD CONSTRAINT anon_chat_runs_op_check
  CHECK (op = ANY (ARRAY[
    'chat_anon',
    'start_audit_scan',
    'explain_finding',
    'generate_fix_snippet',
    'anon_site_build'
  ]));

CREATE TABLE IF NOT EXISTS public.siteos_anonymous_drafts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Der einzige Zugangsschutz: 32 Hex-Zeichen aus einem kryptographischen
  -- Zufallsgenerator. Dieselbe Kennung adressiert die Vorschau im
  -- Preview-Worker, damit Entwurf und Vorschau zusammengehören.
  draft_key           TEXT NOT NULL,

  -- Der vollständige Blueprint, so wie ihn packages/siteos-core erzeugt hat.
  blueprint           JSONB NOT NULL,
  -- Kanonischer Hash, identische Berechnung wie siteos_blueprints.
  content_sha256      CHAR(64) NOT NULL,

  -- Herkunft nach Art. 50 EU AI Act. NULL bei deterministischer Erzeugung —
  -- dort war keine generative KI beteiligt, also darf auch keine behauptet
  -- werden.
  origin_model        TEXT,
  prompt_sha256       CHAR(64),

  -- Vorschau im Worker. Kein Pflichtfeld: Schlägt das Ablegen fehl, bleibt
  -- der Entwurf trotzdem bestehen und kann erneut ausgeliefert werden.
  preview_id          TEXT,

  -- Grobe Zuordnung fuer Kontingent und Missbrauchserkennung. Bewusst nur
  -- der Hash, nie die Adresse selbst (Art. 5 Abs. 1 lit. c).
  ip_hash             TEXT,

  -- Verfall. Ohne Übernahme wird der Entwurf entfernt.
  expires_at          TIMESTAMPTZ NOT NULL,

  -- Gesetzt beim Project Claim. Danach ist der Entwurf verbraucht und kann
  -- nicht ein zweites Mal übernommen werden.
  claimed_at          TIMESTAMPTZ,
  claimed_by_tenant   UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  claimed_blueprint   UUID REFERENCES public.siteos_blueprints(id) ON DELETE SET NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT siteos_anonymous_drafts_key_unique UNIQUE (draft_key),
  -- 128 Bit als Hex. Kürzer waere ratbar, laenger waere Zufall ohne Nutzen.
  CONSTRAINT siteos_anonymous_drafts_key_shape
    CHECK (draft_key ~ '^[0-9a-f]{32}$'),
  CONSTRAINT siteos_anonymous_drafts_preview_shape
    CHECK (preview_id IS NULL OR preview_id ~ '^[0-9a-f]{32}$'),
  -- Ein Entwurf ist entweder offen oder übernommen — ein halb übernommener
  -- Zustand waere weder rückholbar noch belegbar.
  CONSTRAINT siteos_anonymous_drafts_claim_complete
    CHECK (
      (claimed_at IS NULL AND claimed_by_tenant IS NULL)
      OR (claimed_at IS NOT NULL AND claimed_by_tenant IS NOT NULL)
    )
);

COMMENT ON TABLE public.siteos_anonymous_drafts IS
  'Entwuerfe, die vor dem Anlegen eines Kontos entstehen. Bewusst ohne tenant_id; Deny-by-default-RLS, ausschliesslich service_role. Verfaellt ohne Uebernahme (DSGVO Art. 5 Abs. 1 lit. e). Beim Claim wandert der Entwurf nach siteos_blueprints.';

CREATE INDEX IF NOT EXISTS siteos_anonymous_drafts_expiry_idx
  ON public.siteos_anonymous_drafts (expires_at)
  WHERE claimed_at IS NULL;

-- Der Zugriffspfad des Kontingents: "wie viele Entwuerfe kamen aus dieser
-- Richtung im Zeitfenster?"
CREATE INDEX IF NOT EXISTS siteos_anonymous_drafts_ip_created_idx
  ON public.siteos_anonymous_drafts (ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

ALTER TABLE public.siteos_anonymous_drafts ENABLE ROW LEVEL SECURITY;

-- Bewusst KEINE Policy. Ohne Policy und mit aktiviertem RLS ist die Tabelle
-- fuer `authenticated` und `anon` vollstaendig gesperrt; nur `service_role`
-- umgeht RLS. Ein Entwurf ohne Mandant darf nicht ueber die API auffindbar
-- sein — er ist nur ueber seinen Schluessel erreichbar, und den kennt nur,
-- wer ihn erzeugt hat.

-- Aufraeumen abgelaufener, nie uebernommener Entwuerfe. Wird vom Scheduler
-- aufgerufen; ohne Aufruf verfaellt kein Entwurf, deshalb steht der Hinweis
-- auch im Funktionskommentar.
CREATE OR REPLACE FUNCTION public.purge_expired_anonymous_drafts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed INTEGER;
BEGIN
  DELETE FROM public.siteos_anonymous_drafts
  WHERE claimed_at IS NULL AND expires_at < NOW();
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

COMMENT ON FUNCTION public.purge_expired_anonymous_drafts() IS
  'Loescht abgelaufene, nie uebernommene Entwuerfe. Muss periodisch aufgerufen werden (pg_cron) — ohne Aufruf verfaellt kein Entwurf, und die Speicherbegrenzung waere nur eine Behauptung.';

REVOKE ALL ON FUNCTION public.purge_expired_anonymous_drafts() FROM PUBLIC;

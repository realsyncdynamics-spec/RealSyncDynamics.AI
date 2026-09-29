-- SiteOS Rebuild-Workflow — Läufe (DISCOVER → ASSESS → REBUILD → … → GOVERN).
--
-- Ein Lauf hält, was vom Lesen einer bestehenden Website bleibt: den
-- Snapshot (abgeleitete Signale und kurze Belegauszüge, KEIN HTML), die
-- Positionierung, die Bewertung, die angebotenen Richtungen — und später die
-- gewählte Richtung samt Blueprint-Kette.
--
-- ## Warum der Snapshot gespeichert wird
--
-- Alles, was danach passiert, wird serverseitig aus diesem Snapshot neu
-- abgeleitet, statt einem Client zu glauben:
--
--   * die Richtung beim Auswählen (`rebuild-select`),
--   * der Backend-Vergleich im Publish Gate (Formularziele, Buchungs- und
--     Zahlungsstrecken der Ausgangsseite ↔ Neubau),
--   * die Begründungen der nächsten Schritte (AUTOMATE / GOVERN).
--
-- Ein Aufrufer kann weder eine andere Ausgangsseite noch einen leeren
-- Vergleich behaupten — beides steht hier, geschrieben von der Edge Function.
--
-- ## Datenminimierung
--
-- Gespeichert werden Auszüge von höchstens 280 Zeichen je Beleg und die
-- SHA-256 der abgerufenen Dokumente, nicht die Dokumente selbst. Personen-
-- bezogen sind allenfalls geschäftliche Kontaktdaten, die die Website selbst
-- veröffentlicht (Telefon, E-Mail, Anschrift im Impressum/Kontakt).
--
-- ## Zugriff
--
-- Lesen: Mitglieder des Mandanten (RLS über `is_tenant_member`).
-- Schreiben: ausschließlich `service_role` (Edge Function `siteos`). Keine
-- INSERT/UPDATE-Policy für `authenticated` — ein Lauf, den der Client
-- schreiben könnte, wäre genau die Autorität, die hier ausgeschlossen ist.
--
-- ## Bindung
--
-- Welcher Lauf zu einer Site gehört, steht nicht hier, sondern im Blueprint
-- selbst (`origin.rebuild = { runId, snapshotSha256 }`, serverseitig beim
-- Übernehmen gesetzt, Teil des Blueprint-Hashes). Publish Gate, Status und
-- Verzicht laden den Lauf über diese Kennung und prüfen den Snapshot-Hash —
-- nie „den zuletzt bearbeiteten Lauf zu diesem Slug".
--
-- ## Freigabe an den Vergleich gebunden
--
-- `siteos_publish_evaluations.backend_sha256` hält fest, welchen
-- Backend-Vergleich (Lauf, Verluste, Verzichte, Ungeprüftes) eine Bewertung
-- gesehen hat. Eine Freigabe gilt für übernommene Sites nur, solange er
-- gleich bleibt. Für alle anderen Sites bleibt die Spalte leer.
--
-- Additiv: neue Tabelle und eine neue, leere Spalte; keine Änderung an
-- bestehenden Daten.

BEGIN;

CREATE TABLE IF NOT EXISTS public.siteos_rebuild_runs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by           uuid,

  source_url           text NOT NULL,
  resolved_url         text NOT NULL,
  host                 text NOT NULL,
  status               text NOT NULL DEFAULT 'analyzed'
                       CHECK (status IN ('analyzed', 'selected')),
  engine_version       text NOT NULL,

  -- SourceSnapshot (packages/siteos-core/src/rebuild/types.ts) und sein
  -- kanonischer Hash. Der Hash ist der Anker im Evidence-Eintrag.
  snapshot             jsonb NOT NULL,
  snapshot_sha256      text NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  positioning          jsonb NOT NULL,
  assessment           jsonb NOT NULL,
  -- Angebotene Richtungen: Plan und Bericht je Richtung (Blueprints werden
  -- beim Auswählen serverseitig neu abgeleitet, nicht aus dieser Spalte).
  directions           jsonb NOT NULL,

  -- governance_evidence-Eintrag der Analyse (Hash-Kette des Mandanten).
  evidence_id          uuid,

  selected_direction   text CHECK (selected_direction IS NULL OR selected_direction IN
                         ('clean-enterprise', 'conversion-focus', 'local-trust', 'premium-advisory')),
  site_slug            text,
  selected_blueprint_id uuid REFERENCES public.siteos_blueprints(id) ON DELETE SET NULL,

  -- Bewusster Verzicht auf einzelne Backend-Funktionen der Ausgangsseite:
  -- [{ key, reason, by, at }]. Zurechnung wie eine Freigabe (Person +
  -- Begründung), nur von der Edge Function geschrieben.
  backend_waivers      jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_siteos_rebuild_runs_tenant_created
  ON public.siteos_rebuild_runs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_siteos_rebuild_runs_tenant_slug
  ON public.siteos_rebuild_runs (tenant_id, site_slug, updated_at DESC)
  WHERE site_slug IS NOT NULL;

COMMENT ON TABLE public.siteos_rebuild_runs IS
  'SiteOS Rebuild-Workflow: Snapshot (ohne HTML), Positionierung, Bewertung und Richtungen je Lauf. '
  'Grundlage für serverseitige Ableitung (Auswahl, Backend-Vergleich im Publish Gate). Schreiben nur service_role.';

ALTER TABLE public.siteos_rebuild_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "siteos_rebuild_runs_tenant_read" ON public.siteos_rebuild_runs;
CREATE POLICY "siteos_rebuild_runs_tenant_read" ON public.siteos_rebuild_runs
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "siteos_rebuild_runs_service" ON public.siteos_rebuild_runs;
CREATE POLICY "siteos_rebuild_runs_service" ON public.siteos_rebuild_runs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.siteos_rebuild_runs FROM anon;
GRANT SELECT ON public.siteos_rebuild_runs TO authenticated;
GRANT ALL ON public.siteos_rebuild_runs TO service_role;

ALTER TABLE public.siteos_publish_evaluations
  ADD COLUMN IF NOT EXISTS backend_sha256 text
    CHECK (backend_sha256 IS NULL OR backend_sha256 ~ '^[0-9a-f]{64}$');

COMMENT ON COLUMN public.siteos_publish_evaluations.backend_sha256 IS
  'Rebuild: Hash des Backend-Vergleichs (Lauf, Verluste, Verzichte, Ungeprüftes), den diese Bewertung gesehen hat. '
  'Eine Freigabe gilt für übernommene Sites nur, solange er gleich bleibt. NULL für alle anderen Sites.';

COMMIT;

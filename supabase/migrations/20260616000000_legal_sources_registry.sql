-- Legal-RAG — additive: legal_sources Crawl-Registry.
--
-- Kontext: Die Foundation (20260614000000) und die Ingestion-Adapter
--   (_shared/legal-ingest.ts) leben mit free-text source_authority auf
--   legal_documents/legal_ingest_runs. Der Cron-Driver, der die regelmäßige
--   EUR-Lex/EDPB/BfDI-Polls auslöst, muss die Liste der Quellen
--   irgendwo aus dem Code laden — diese Migration zentralisiert sie in
--   eine first-class Registry, sodass:
--
--     - Operatoren Quellen ohne Code-Deploy aktivieren/deaktivieren
--     - der Cron WHERE enabled AND now() >= last_polled_at + interval
--       die fälligen Quellen ohne Hardcoded-URL-Liste findet
--     - per-source Polling-Cadence konfigurierbar wird
--     - last_success_at vs. last_polled_at Quell-SLAs beobachtbar macht
--
-- Streng additiv:
--   - neue Tabelle public.legal_sources
--   - neue NULLABLE Spalte legal_ingest_runs.source_id (FK auf legal_sources)
--   - keine Änderungen an legal_documents (source_authority TEXT bleibt
--     primary attribution; Phase 2 kann die Spalten kreuzen)
--   - bestehende RLS/Indizes unberührt
--
-- Phase 2-Pfad: legal_documents.source_id (denormalisiert vom letzten
--   ingest_run) als zusätzliche Spalte einziehen. Nicht jetzt — würde
--   bestehende Inserts brechen, die source_id noch nicht setzen.

-- ─────────────────────────────────────────────────────────────────────
-- legal_sources — Crawl-Registry. Eine Zeile pro pollbare Quelle.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.legal_sources (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stable slug; wird vom Cron-Driver als Adapter-Lookup-Key benutzt
  -- ('eur_lex' → sources/eurLex.ts) und in legal_documents.source_authority
  -- denormalisiert (Phase 2 kann zusätzlich source_id setzen).
  slug                TEXT NOT NULL UNIQUE,
  display_name        TEXT NOT NULL,
  base_url            TEXT NOT NULL,

  -- Adapter-Type — bestimmt, welcher Code-Pfad die Quelle parst.
  source_type         TEXT NOT NULL,

  -- Jurisdiktion entspricht legal_documents.jurisdiction (gleicher Wertebereich).
  jurisdiction        TEXT NOT NULL,

  -- Quellspezifische Polling-Config; Schema dokumentiert pro Adapter.
  --   eur_lex: { celex_filter[], languages[], sparql_endpoint }
  --   edpb:    { rss_url, doc_types[] }
  --   bfdi:    { sitemap_url, html_selector }
  poll_config         JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Polling-Cadence in Minuten. 1440 = täglich; 720 = zweimal täglich.
  poll_interval_min   INTEGER NOT NULL DEFAULT 1440,

  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  last_polled_at      TIMESTAMPTZ,
  last_success_at     TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT legal_sources_source_type_check CHECK (source_type IN (
    'eur_lex', 'edpb', 'bfdi', 'cnil', 'data_protection_authority', 'custom'
  )),
  -- Spiegelt legal_documents_jurisdiction_check.
  CONSTRAINT legal_sources_jurisdiction_check CHECK (jurisdiction IN (
    'eu', 'de', 'at', 'ch', 'fr', 'us', 'uk', 'other'
  )),
  CONSTRAINT legal_sources_base_url_format CHECK (base_url ~ '^https?://'),
  CONSTRAINT legal_sources_poll_interval_positive CHECK (poll_interval_min > 0)
);

COMMENT ON TABLE public.legal_sources IS
  'Crawl-Registry für die Legal-RAG-Pipeline. Cron-Driver liest hier WHERE enabled AND poll-fällig.';
COMMENT ON COLUMN public.legal_sources.poll_config IS
  'Quellspezifische Crawler-Config. Schema dokumentiert in jeweiligem sources/<slug>.ts Adapter.';
COMMENT ON COLUMN public.legal_sources.last_success_at IS
  'Letzter erfolgreicher Polling-Run. Differenz zu last_polled_at = aktueller Fehler-Streak.';

-- Cron-Driver-Hot-Path: aktive Quellen sortiert nach Polling-Fälligkeit.
CREATE INDEX IF NOT EXISTS legal_sources_due_idx
  ON public.legal_sources (last_polled_at NULLS FIRST)
  WHERE enabled = TRUE;

-- ─────────────────────────────────────────────────────────────────────
-- legal_ingest_runs.source_id — Backlink zur Registry.
-- NULLABLE: bestehende Zeilen behalten NULL; neue Runs vom Cron-Driver
-- setzen source_id. source_authority TEXT bleibt als zusätzliches Free-
-- Text-Feld (z. B. für Ad-hoc-Imports ohne Registry-Eintrag).
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.legal_ingest_runs
  ADD COLUMN IF NOT EXISTS source_id UUID
  REFERENCES public.legal_sources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS legal_ingest_runs_source_id_idx
  ON public.legal_ingest_runs (source_id, started_at DESC)
  WHERE source_id IS NOT NULL;

COMMENT ON COLUMN public.legal_ingest_runs.source_id IS
  'Backlink zur legal_sources-Registry. NULL für Ad-hoc/Legacy-Runs ohne Registry-Eintrag.';

-- ─────────────────────────────────────────────────────────────────────
-- updated_at-Trigger — wiederverwendet legal_set_updated_at() aus
-- der Foundation-Migration.
-- ─────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS legal_sources_update_modtime ON public.legal_sources;
CREATE TRIGGER legal_sources_update_modtime
  BEFORE UPDATE ON public.legal_sources
  FOR EACH ROW EXECUTE FUNCTION public.legal_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- RLS — deny-by-default, service-role-only. Identisch zum Foundation-
-- Pattern.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.legal_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legal_sources service-role full" ON public.legal_sources;
CREATE POLICY "legal_sources service-role full"
  ON public.legal_sources FOR ALL
  TO service_role
  USING (TRUE) WITH CHECK (TRUE);

REVOKE ALL ON public.legal_sources FROM PUBLIC;
REVOKE ALL ON public.legal_sources FROM anon, authenticated;
GRANT ALL ON public.legal_sources TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- Seed: Initial-Quellen. Cron-Driver erbt diese auf den ersten Lauf.
-- ON CONFLICT DO NOTHING macht den Insert idempotent.
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO public.legal_sources (slug, display_name, base_url, source_type, jurisdiction, poll_config, poll_interval_min)
VALUES
  ('eur_lex', 'EUR-Lex', 'https://eur-lex.europa.eu', 'eur_lex', 'eu',
   '{"sparql_endpoint":"https://publications.europa.eu/webapi/rdf/sparql","languages":["de","en"],"celex_filter":["32016R0679","32024R1689","32022R2065","32022R0868","32014R0910","32022L2555"]}'::jsonb,
   1440),
  ('edpb', 'European Data Protection Board', 'https://www.edpb.europa.eu', 'edpb', 'eu',
   '{"rss_url":"https://www.edpb.europa.eu/rss.xml","doc_types":["guideline","opinion","decision"]}'::jsonb,
   720),
  ('bfdi', 'Bundesbeauftragter für den Datenschutz', 'https://www.bfdi.bund.de', 'bfdi', 'de',
   '{"sitemap_url":"https://www.bfdi.bund.de/sitemap.xml"}'::jsonb,
   1440)
ON CONFLICT (slug) DO NOTHING;

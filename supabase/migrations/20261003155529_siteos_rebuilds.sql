-- AI Rebuild Workflow: DISCOVER → ASSESS → REBUILD → REFINE → PUBLISH → AUTOMATE → GOVERN.
--
-- ## Was hier liegt
--
-- Der vollständige Workflow-Zustand eines Rebuilds als JSONB — Import mit
-- Belegen, Bewertung, Richtungen, Revisionen, Reifeprüfung, Freigabe,
-- Vorschläge. Der Kern (`packages/siteos-core/src/rebuild`) erzeugt ihn
-- deterministisch; die Edge Function `siteos/rebuild-*` schreibt ihn.
--
-- ## Warum eine eigene Tabelle und nicht `siteos_blueprints`
--
-- Der Blueprint ist das Ergebnis, nicht der Weg dorthin. Ein Rebuild hält
-- drei Richtungen gleichzeitig, eine Bewertung mit 25+ Belegen und eine
-- Revisionsfolge — Dinge, die vor dem ersten Blueprint existieren. Erst die
-- Freigabe (GO) erzeugt über `persistBlueprintVersion` eine Zeile in
-- `siteos_blueprints`, und `blueprint_id` zeigt dann darauf. Ab da laufen
-- Prüfpfad, Gate und Editor wie bei jeder anderen Site.
--
-- ## Autorität
--
-- `tenant_id` und `approved_by` werden ausschließlich serverseitig aus der
-- geprüften Sitzung gesetzt. Der Client behauptet einen Mandanten; die
-- Function prüft die Mitgliedschaft. URL-Parameter und localStorage sind
-- nie Autorität — wie überall in SiteOS.
--
-- RLS: Mitglieder lesen, niemand schreibt über PostgREST (keine
-- INSERT/UPDATE-Policy) — dasselbe Muster wie `siteos_blueprints`.

BEGIN;

CREATE TABLE IF NOT EXISTS public.siteos_rebuilds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  source_url        TEXT NOT NULL,
  source_domain     TEXT NOT NULL,

  -- Stufe des Workflows — aus dem Vokabular des Kerns (REBUILD_STAGES).
  stage             TEXT NOT NULL DEFAULT 'discover'
                    CHECK (stage IN ('discover', 'assess', 'rebuild', 'refine', 'publish', 'automate', 'govern')),

  -- Der Zustand. Kanonisch gehasht; `state_sha256` ist der optimistische
  -- Sperranker für Revisionen (409 bei Abweichung).
  state             JSONB NOT NULL,
  state_sha256      TEXT NOT NULL CHECK (state_sha256 ~ '^[0-9a-f]{64}$'),
  version           INTEGER NOT NULL DEFAULT 1,

  -- Freigabe (GO): nur serverseitig, nur an einen Artefakt-Hash gebunden.
  approved_at       TIMESTAMPTZ,
  approved_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_reason   TEXT,
  artifact_sha256   TEXT CHECK (artifact_sha256 IS NULL OR artifact_sha256 ~ '^[0-9a-f]{64}$'),

  -- Nach der Freigabe: der persistierte Blueprint.
  blueprint_id      UUID REFERENCES public.siteos_blueprints(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS siteos_rebuilds_tenant_updated_idx
  ON public.siteos_rebuilds (tenant_id, updated_at DESC);

ALTER TABLE public.siteos_rebuilds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "siteos_rebuilds tenant-select" ON public.siteos_rebuilds;
CREATE POLICY "siteos_rebuilds tenant-select" ON public.siteos_rebuilds
  FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.siteos_rebuilds IS
  'AI Rebuild Workflow je Ausgangs-URL: Import mit Belegen, Bewertung, Richtungen, Revisionen, Reifeprüfung, Freigabe. Schreiben nur über die Edge Function siteos/rebuild-* (service_role).';
COMMENT ON COLUMN public.siteos_rebuilds.state IS
  'RebuildWorkflowState aus packages/siteos-core/src/rebuild/types.ts. Enthält kein rohes HTML der Quelle — nur extrahierte Felder und Beleg-Auszüge mit Hash.';
COMMENT ON COLUMN public.siteos_rebuilds.state_sha256 IS
  'Kanonischer SHA-256 des Zustands (canonicalHash). Revisionen müssen ihn als base_sha256 mitgeben.';
COMMENT ON COLUMN public.siteos_rebuilds.artifact_sha256 IS
  'Hash des freigegebenen Artefakts (Richtung + Vorschau). Eine Freigabe gilt nur für genau diesen Hash.';

COMMIT;

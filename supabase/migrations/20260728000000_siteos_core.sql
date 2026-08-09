-- Migration: 20260728000000_siteos_core.sql
-- RealSync SiteOS — Kern-Datenmodell.
--
-- Additiv. Es werden keine bestehenden Tabellen, Policies oder Constraints
-- verändert. SiteOS setzt bewusst AUF die vorhandene Website-Operations-Ebene
-- auf, statt sie zu ersetzen: `siteos_blueprints.project_id` verweist optional
-- auf `website_projects`, damit Domains, Deployment-Logs und Cloudflare-
-- Anbindung wiederverwendet werden.
--
-- Tabellen:
--   siteos_blueprints    — versionierte, verkettete Site-Blueprints (append-only)
--   siteos_runtime_scans — Ergebnisse der acht Runtime-Analysen
--   siteos_scores        — die fünf Live-Kennzahlen je Scan
--   siteos_agent_runs    — asynchrone Läufe der sieben Agenten
--
-- RLS: Lesen für Tenant-Mitglieder über public.is_tenant_member(tenant_id).
-- Schreiben ausschließlich über Edge Functions (service_role) — die Ketten
-- (prev_hash/event_hash) und die Versionszählung dürfen nicht clientseitig
-- gesetzt werden, sonst ist der Nachweis wertlos.

-- ============================================================================
-- 1. SITEOS_BLUEPRINTS — versionierte Site-Blueprints, append-only
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.siteos_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Optionale Verklammerung mit der bestehenden Website-Operations-Ebene.
  -- NULL = SiteOS-eigene Site ohne (noch) angelegtes Projekt.
  project_id UUID REFERENCES public.website_projects(id) ON DELETE SET NULL,

  slug VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  industry VARCHAR NOT NULL,

  -- Fortlaufend je (tenant_id, slug); wird von der Edge Function vergeben.
  version INTEGER NOT NULL CHECK (version >= 1),

  -- Der vollständige Blueprint (siehe packages/siteos-core/src/types.ts).
  blueprint JSONB NOT NULL,

  -- Kanonischer SHA-256 des Blueprints. Anker im Evidence Vault und im
  -- Herkunftsnachweis; identische Kanonisierung wie siteos-core/canonical.
  content_sha256 CHAR(64) NOT NULL,
  -- Verkettung über die Versionen einer Site: prev_hash der Vorversion.
  prev_hash CHAR(64),

  -- Herkunft (Art. 50 EU AI Act — generierende KI muss dokumentiert sein).
  origin_source VARCHAR NOT NULL DEFAULT 'ai-builder'
    CHECK (origin_source IN ('ai-builder', 'manual', 'import')),
  origin_model VARCHAR,
  prompt_sha256 CHAR(64),

  status VARCHAR NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'deployed', 'archived')),

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT siteos_blueprints_sha_format CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT siteos_blueprints_prev_format CHECK (prev_hash IS NULL OR prev_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT siteos_blueprints_version_unique UNIQUE (tenant_id, slug, version)
);

CREATE INDEX IF NOT EXISTS idx_siteos_blueprints_tenant ON public.siteos_blueprints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_siteos_blueprints_slug ON public.siteos_blueprints(tenant_id, slug, version DESC);
CREATE INDEX IF NOT EXISTS idx_siteos_blueprints_project ON public.siteos_blueprints(project_id);
CREATE INDEX IF NOT EXISTS idx_siteos_blueprints_status ON public.siteos_blueprints(status);
CREATE INDEX IF NOT EXISTS idx_siteos_blueprints_created ON public.siteos_blueprints(created_at DESC);

ALTER TABLE public.siteos_blueprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "siteos_blueprints tenant-select" ON public.siteos_blueprints;
CREATE POLICY "siteos_blueprints tenant-select" ON public.siteos_blueprints
  FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.siteos_blueprints IS
  'Versionierte SiteOS-Blueprints (append-only, über prev_hash verkettet). Schreiben nur über die Edge Function siteos-builder (service_role).';
COMMENT ON COLUMN public.siteos_blueprints.content_sha256 IS
  'Kanonischer SHA-256 des Blueprints. Muss mit canonicalHash() aus packages/siteos-core übereinstimmen.';
COMMENT ON COLUMN public.siteos_blueprints.project_id IS
  'Optionale Verknüpfung mit website_projects — ermöglicht die Wiederverwendung von Domains und Deployment-Logs.';

-- ============================================================================
-- 2. SITEOS_RUNTIME_SCANS — die acht Runtime-Analysen
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.siteos_runtime_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES public.siteos_blueprints(id) ON DELETE SET NULL,

  -- Geprüfte URL. NULL bei reiner Blueprint-Analyse vor dem Deployment.
  url TEXT,

  -- Was den Scan angestoßen hat.
  trigger VARCHAR NOT NULL DEFAULT 'manual'
    CHECK (trigger IN ('deploy', 'cron', 'manual', 'agent')),

  scope VARCHAR NOT NULL DEFAULT 'blueprint'
    CHECK (scope IN ('blueprint', 'live', 'combined')),

  status VARCHAR NOT NULL DEFAULT 'completed'
    CHECK (status IN ('running', 'completed', 'failed')),

  -- Befunde als Array von RuntimeFinding (siehe siteos-core/types.ts).
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  finding_count INTEGER NOT NULL DEFAULT 0,
  severity_max VARCHAR
    CHECK (severity_max IS NULL OR severity_max IN ('critical', 'high', 'medium', 'low', 'info')),

  -- Rohbeobachtung ohne HTML-Body: Header, Timings, Drittanbieter-Hosts.
  -- Der Body bleibt bewusst draußen (Datenminimierung, Art. 5 Abs. 1 lit. c).
  observation JSONB NOT NULL DEFAULT '{}'::jsonb,

  error_message TEXT,

  -- Verknüpfung in die bestehende Governance-Runtime.
  correlation_id UUID,

  observed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_siteos_scans_tenant ON public.siteos_runtime_scans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_siteos_scans_blueprint ON public.siteos_runtime_scans(blueprint_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_siteos_scans_observed ON public.siteos_runtime_scans(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_siteos_scans_severity ON public.siteos_runtime_scans(severity_max);

ALTER TABLE public.siteos_runtime_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "siteos_runtime_scans tenant-select" ON public.siteos_runtime_scans;
CREATE POLICY "siteos_runtime_scans tenant-select" ON public.siteos_runtime_scans
  FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.siteos_runtime_scans IS
  'Ergebnisse der acht SiteOS-Runtime-Analysen (DSGVO, EU AI Act, TDDDG, Barrierefreiheit, Sicherheit, Performance, SEO, Inhalt).';
COMMENT ON COLUMN public.siteos_runtime_scans.observation IS
  'Rohsignale des Abrufs ohne HTML-Body — Header, TTFB, Transfergröße, Drittanbieter-Hosts, Cookies vor Einwilligung.';

-- ============================================================================
-- 3. SITEOS_SCORES — die fünf Live-Kennzahlen
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.siteos_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scan_id UUID NOT NULL REFERENCES public.siteos_runtime_scans(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES public.siteos_blueprints(id) ON DELETE SET NULL,

  health NUMERIC(5,1) NOT NULL CHECK (health BETWEEN 0 AND 100),
  risk NUMERIC(5,1) NOT NULL CHECK (risk BETWEEN 0 AND 100),
  compliance NUMERIC(5,1) NOT NULL CHECK (compliance BETWEEN 0 AND 100),
  performance NUMERIC(5,1) NOT NULL CHECK (performance BETWEEN 0 AND 100),
  ai_risk NUMERIC(5,1) NOT NULL CHECK (ai_risk BETWEEN 0 AND 100),

  -- Teilscores je Dimension — macht jede Kennzahl im Audit aufschlüsselbar.
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Ein Score-Satz je Scan; Neuberechnung ersetzt ihn nicht, sondern
  -- erzeugt einen neuen Scan.
  CONSTRAINT siteos_scores_scan_unique UNIQUE (scan_id)
);

CREATE INDEX IF NOT EXISTS idx_siteos_scores_tenant ON public.siteos_scores(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_siteos_scores_blueprint ON public.siteos_scores(blueprint_id, created_at DESC);

ALTER TABLE public.siteos_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "siteos_scores tenant-select" ON public.siteos_scores;
CREATE POLICY "siteos_scores tenant-select" ON public.siteos_scores
  FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.siteos_scores IS
  'Health-, Risk-, Compliance-, Performance- und AI-Risk-Score je Runtime-Scan. Berechnung ausschließlich in packages/siteos-core/scoring.';

-- ============================================================================
-- 4. SITEOS_AGENT_RUNS — asynchrone Agentenläufe
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.siteos_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES public.siteos_blueprints(id) ON DELETE SET NULL,
  scan_id UUID REFERENCES public.siteos_runtime_scans(id) ON DELETE SET NULL,

  agent VARCHAR NOT NULL
    CHECK (agent IN ('compliance', 'seo', 'accessibility', 'security', 'performance', 'content', 'monitoring')),

  status VARCHAR NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'awaiting_approval', 'running', 'completed', 'failed', 'cancelled')),

  -- Befund-Codes, die diesen Lauf begründen.
  finding_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  severity_max VARCHAR
    CHECK (severity_max IS NULL OR severity_max IN ('critical', 'high', 'medium', 'low', 'info')),

  requires_approval BOOLEAN NOT NULL DEFAULT false,
  -- Freigabe aus der bestehenden Governance-Ebene.
  approval_id UUID,

  -- Ergebnis des Laufs; bei blueprint-ändernden Agenten die neue Version.
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  produced_blueprint_id UUID REFERENCES public.siteos_blueprints(id) ON DELETE SET NULL,

  error_message TEXT,

  queued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Ein abgeschlossener Lauf braucht einen Endzeitpunkt; ein gescheiterter
  -- zusätzlich eine Begründung.
  CONSTRAINT siteos_agent_runs_terminal_state CHECK (
    (status NOT IN ('completed', 'failed', 'cancelled'))
    OR (completed_at IS NOT NULL)
  ),
  CONSTRAINT siteos_agent_runs_failure_reason CHECK (
    status <> 'failed' OR error_message IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_siteos_agent_runs_tenant ON public.siteos_agent_runs(tenant_id, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_siteos_agent_runs_status ON public.siteos_agent_runs(status, queued_at);
CREATE INDEX IF NOT EXISTS idx_siteos_agent_runs_blueprint ON public.siteos_agent_runs(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_siteos_agent_runs_scan ON public.siteos_agent_runs(scan_id);

ALTER TABLE public.siteos_agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "siteos_agent_runs tenant-select" ON public.siteos_agent_runs;
CREATE POLICY "siteos_agent_runs tenant-select" ON public.siteos_agent_runs
  FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.siteos_agent_runs IS
  'Warteschlange und Prüfpfad der sieben SiteOS-Agenten. Blueprint-ändernde Agenten erzeugen stets eine neue Blueprint-Version (produced_blueprint_id).';

-- ============================================================================
-- 5. LESE-RPC — aktueller Stand je Site
-- ============================================================================

-- Liefert je Slug die jüngste Blueprint-Version samt letztem Score. Als
-- SECURITY INVOKER, damit RLS greift — die Funktion umgeht keine Isolation.
CREATE OR REPLACE FUNCTION public.siteos_site_overview(p_tenant_id UUID)
RETURNS TABLE (
  slug VARCHAR,
  name VARCHAR,
  industry VARCHAR,
  blueprint_id UUID,
  version INTEGER,
  status VARCHAR,
  content_sha256 CHAR(64),
  created_at TIMESTAMP WITH TIME ZONE,
  health NUMERIC,
  risk NUMERIC,
  compliance NUMERIC,
  performance NUMERIC,
  ai_risk NUMERIC,
  severity_max VARCHAR,
  last_scan_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH latest_blueprint AS (
    SELECT DISTINCT ON (b.slug) b.*
    FROM public.siteos_blueprints b
    WHERE b.tenant_id = p_tenant_id
    ORDER BY b.slug, b.version DESC
  ),
  latest_scan AS (
    SELECT DISTINCT ON (s.blueprint_id) s.*
    FROM public.siteos_runtime_scans s
    WHERE s.tenant_id = p_tenant_id
    ORDER BY s.blueprint_id, s.observed_at DESC
  )
  SELECT
    lb.slug, lb.name, lb.industry, lb.id, lb.version, lb.status,
    lb.content_sha256, lb.created_at,
    sc.health, sc.risk, sc.compliance, sc.performance, sc.ai_risk,
    ls.severity_max, ls.observed_at
  FROM latest_blueprint lb
  LEFT JOIN latest_scan ls ON ls.blueprint_id = lb.id
  LEFT JOIN public.siteos_scores sc ON sc.scan_id = ls.id
  ORDER BY lb.created_at DESC;
$$;

COMMENT ON FUNCTION public.siteos_site_overview(UUID) IS
  'Übersicht je Site: jüngste Blueprint-Version mit zugehörigem Score. SECURITY INVOKER — RLS bleibt wirksam.';

GRANT EXECUTE ON FUNCTION public.siteos_site_overview(UUID) TO authenticated;

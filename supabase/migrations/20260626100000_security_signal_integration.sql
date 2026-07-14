-- ============================================================
-- Security Signal Integration Layer
-- ============================================================
-- Additive Migration. Führt externe technische Findings
-- (blacklens.io, Cloudflare, GitHub, SIEM, …) als normalisierte
-- "Security Signals" in das bestehende Governance OS ein und
-- verknüpft sie mit Risk-/Control-Mappings.
--
--   Finding → Risk → Control Mapping → Task → Evidence
--
-- Bestehende Tabellen (governance_evidence, governance_approvals,
-- framework_controls) werden NICHT verändert — der Edge-Layer
-- referenziert sie best-effort. RLS folgt dem etablierten Muster:
-- tenant-scoped über public.is_tenant_member(tenant_id), Ingest
-- ausschließlich über service_role (Edge Functions).

-- Trigger-Helfer (idempotent; existiert bereits in früheren Migrationen)
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 1. security_signal_sources
-- ------------------------------------------------------------
-- Registrierte externe Quellen. Der API-Key verlässt das System
-- genau einmal (bei Erstellung); gespeichert wird nur der sha256-
-- Hash — analog zu governance_ingest_keys.
CREATE TABLE IF NOT EXISTS public.security_signal_sources (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  provider       TEXT NOT NULL CHECK (
                   provider IN ('blacklens', 'cloudflare', 'github', 'siem', 'generic')
                 ),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (
                   status IN ('active', 'paused', 'revoked')
                 ),
  config         JSONB NOT NULL DEFAULT '{}'::jsonb,
  api_key_hash   TEXT UNIQUE,
  api_key_prefix TEXT,
  last_used_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_signal_sources_tenant
  ON public.security_signal_sources(tenant_id);

CREATE INDEX IF NOT EXISTS idx_security_signal_sources_key
  ON public.security_signal_sources(api_key_hash)
  WHERE api_key_hash IS NOT NULL;

DROP TRIGGER IF EXISTS trg_security_signal_sources_updated ON public.security_signal_sources;
CREATE TRIGGER trg_security_signal_sources_updated
  BEFORE UPDATE ON public.security_signal_sources
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

-- ------------------------------------------------------------
-- 2. security_signals
-- ------------------------------------------------------------
-- Normalisierte Findings. Upsert-Schlüssel: (tenant_id, provider,
-- external_id) — derselbe Befund eines Providers aktualisiert die
-- bestehende Zeile (last_seen_at, status, payloads).
CREATE TABLE IF NOT EXISTS public.security_signals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_id          UUID REFERENCES public.security_signal_sources(id) ON DELETE SET NULL,
  provider           TEXT NOT NULL,
  external_id        TEXT NOT NULL,
  event_type         TEXT,
  severity           TEXT NOT NULL DEFAULT 'info' CHECK (
                       severity IN ('critical', 'high', 'medium', 'low', 'info')
                     ),
  title              TEXT NOT NULL,
  description        TEXT,
  asset_ref          TEXT,
  raw_payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status             TEXT NOT NULL DEFAULT 'open' CHECK (
                       status IN ('open', 'acknowledged', 'in_review', 'accepted',
                                  'resolved', 'false_positive')
                     ),
  first_seen_at      TIMESTAMPTZ,
  last_seen_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_security_signals_tenant
  ON public.security_signals(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_signals_tenant_severity
  ON public.security_signals(tenant_id, severity);

CREATE INDEX IF NOT EXISTS idx_security_signals_tenant_status
  ON public.security_signals(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_security_signals_source
  ON public.security_signals(source_id);

DROP TRIGGER IF EXISTS trg_security_signals_updated ON public.security_signals;
CREATE TRIGGER trg_security_signals_updated
  BEFORE UPDATE ON public.security_signals
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

-- ------------------------------------------------------------
-- 3. governance_risk_links
-- ------------------------------------------------------------
-- Verknüpft ein Signal mit einem Risiko und/oder einem Framework-
-- Control. risk_id ist optional (ein Signal kann auf ein Control
-- gemappt sein, bevor ein konkretes Risk-Objekt existiert).
CREATE TABLE IF NOT EXISTS public.governance_risk_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  signal_id      UUID NOT NULL REFERENCES public.security_signals(id) ON DELETE CASCADE,
  risk_id        UUID,
  framework      TEXT,
  control_ref    TEXT,
  mapping_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_risk_links_tenant
  ON public.governance_risk_links(tenant_id);

CREATE INDEX IF NOT EXISTS idx_governance_risk_links_signal
  ON public.governance_risk_links(signal_id);

-- Idempotenz: gleiche (signal, framework, control) nur einmal verlinken.
CREATE UNIQUE INDEX IF NOT EXISTS uq_governance_risk_links_signal_control
  ON public.governance_risk_links(signal_id, framework, control_ref)
  WHERE framework IS NOT NULL AND control_ref IS NOT NULL;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.security_signal_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_signals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_risk_links   ENABLE ROW LEVEL SECURITY;

-- security_signal_sources: Tenant-Mitglieder lesen/verwalten; service_role ingest.
DROP POLICY IF EXISTS "security_signal_sources tenant-select" ON public.security_signal_sources;
CREATE POLICY "security_signal_sources tenant-select"
  ON public.security_signal_sources FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "security_signal_sources tenant-insert" ON public.security_signal_sources;
CREATE POLICY "security_signal_sources tenant-insert"
  ON public.security_signal_sources FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "security_signal_sources tenant-update" ON public.security_signal_sources;
CREATE POLICY "security_signal_sources tenant-update"
  ON public.security_signal_sources FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "security_signal_sources tenant-delete" ON public.security_signal_sources;
CREATE POLICY "security_signal_sources tenant-delete"
  ON public.security_signal_sources FOR DELETE
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "security_signal_sources service-all" ON public.security_signal_sources;
CREATE POLICY "security_signal_sources service-all"
  ON public.security_signal_sources FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- security_signals: Tenant-Mitglieder lesen + Status pflegen; Ingest via service_role.
DROP POLICY IF EXISTS "security_signals tenant-select" ON public.security_signals;
CREATE POLICY "security_signals tenant-select"
  ON public.security_signals FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "security_signals tenant-update" ON public.security_signals;
CREATE POLICY "security_signals tenant-update"
  ON public.security_signals FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "security_signals service-all" ON public.security_signals;
CREATE POLICY "security_signals service-all"
  ON public.security_signals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- governance_risk_links: Tenant-Mitglieder lesen; Schreiben via service_role.
DROP POLICY IF EXISTS "governance_risk_links tenant-select" ON public.governance_risk_links;
CREATE POLICY "governance_risk_links tenant-select"
  ON public.governance_risk_links FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "governance_risk_links service-all" ON public.governance_risk_links;
CREATE POLICY "governance_risk_links service-all"
  ON public.governance_risk_links FOR ALL TO service_role
  USING (true) WITH CHECK (true);

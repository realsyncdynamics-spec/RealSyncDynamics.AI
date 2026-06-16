-- Governance OS Runtime — Monitoring Sources + Alerts
--
-- monitoring_sources: jede überwachte Quelle (Website, KI-System, API, …)
--   mit Scan-Schedule, Scores und Status.
-- governance_alerts: Laufzeit-Alerts aus Scans, Policy-Engine und Events.
--
-- Beide Tabellen sind tenant-scoped + RLS-geschützt.

BEGIN;

-- ── monitoring_sources ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monitoring_sources (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id         UUID REFERENCES public.governance_assets(id) ON DELETE SET NULL,

  type             TEXT NOT NULL DEFAULT 'website'
                   CHECK (type IN ('website','ai_system','api','vendor','repository','workflow','document')),
  name             TEXT NOT NULL,
  url              TEXT,

  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','active','paused','error')),

  last_scan_at     TIMESTAMPTZ,
  next_scan_at     TIMESTAMPTZ,
  scan_frequency   TEXT NOT NULL DEFAULT 'daily'
                   CHECK (scan_frequency IN ('hourly','daily','weekly','monthly')),

  current_score    INT CHECK (current_score >= 0 AND current_score <= 100),
  previous_score   INT CHECK (previous_score >= 0 AND previous_score <= 100),
  last_error       TEXT,
  scan_count       INT NOT NULL DEFAULT 0,

  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_sources_tenant
  ON public.monitoring_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_sources_next_scan
  ON public.monitoring_sources(next_scan_at) WHERE status = 'active';

ALTER TABLE public.monitoring_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ms_service_all" ON public.monitoring_sources;
CREATE POLICY "ms_service_all" ON public.monitoring_sources
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ms_tenant_read" ON public.monitoring_sources;
CREATE POLICY "ms_tenant_read" ON public.monitoring_sources
  FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "ms_tenant_write" ON public.monitoring_sources;
CREATE POLICY "ms_tenant_write" ON public.monitoring_sources
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

DROP POLICY IF EXISTS "ms_tenant_update" ON public.monitoring_sources;
CREATE POLICY "ms_tenant_update" ON public.monitoring_sources
  FOR UPDATE TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

DROP POLICY IF EXISTS "ms_tenant_delete" ON public.monitoring_sources;
CREATE POLICY "ms_tenant_delete" ON public.monitoring_sources
  FOR DELETE TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

CREATE OR REPLACE FUNCTION public.monitoring_sources_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_ms_updated_at ON public.monitoring_sources;
CREATE TRIGGER trg_ms_updated_at BEFORE UPDATE ON public.monitoring_sources
  FOR EACH ROW EXECUTE FUNCTION public.monitoring_sources_set_updated_at();


-- ── governance_alerts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.governance_alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_id        UUID REFERENCES public.monitoring_sources(id) ON DELETE SET NULL,
  risk_id          UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  event_id         UUID REFERENCES public.governance_events(id) ON DELETE SET NULL,

  severity         TEXT NOT NULL DEFAULT 'medium'
                   CHECK (severity IN ('info','low','medium','high','critical')),
  category         TEXT NOT NULL DEFAULT 'compliance'
                   CHECK (category IN (
                     'compliance','privacy','security','ai_governance',
                     'data_breach','policy','scan','evidence'
                   )),

  title            TEXT NOT NULL,
  message          TEXT NOT NULL,

  status           TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','acknowledged','resolved','dismissed')),

  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at  TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_governance_alerts_tenant
  ON public.governance_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_governance_alerts_status
  ON public.governance_alerts(tenant_id, status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_governance_alerts_created
  ON public.governance_alerts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_alerts_severity
  ON public.governance_alerts(tenant_id, severity);

ALTER TABLE public.governance_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ga_service_all" ON public.governance_alerts;
CREATE POLICY "ga_service_all" ON public.governance_alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ga_tenant_read" ON public.governance_alerts;
CREATE POLICY "ga_tenant_read" ON public.governance_alerts
  FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "ga_tenant_update" ON public.governance_alerts;
CREATE POLICY "ga_tenant_update" ON public.governance_alerts
  FOR UPDATE TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = auth.uid() AND role IN ('owner','admin','member')
  ));


-- ── RPC: 24h Governance Status ─────────────────────────────────────────────
-- Liefert alle für das Dashboard benötigten Zähler der letzten 24h in einem
-- einzigen RPC-Call (kein N+1, kein Client-seitiges Aggregieren).
CREATE OR REPLACE FUNCTION public.governance_24h_summary(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since TIMESTAMPTZ := NOW() - INTERVAL '24 hours';
  v_result JSONB;
BEGIN
  -- Zugriffscheck: Aufrufer muss Mitglied des Tenants sein
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE tenant_id = p_tenant_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Zugriff verweigert';
  END IF;

  SELECT jsonb_build_object(
    'new_risks',         COALESCE((
      SELECT COUNT(*) FROM public.incidents
      WHERE tenant_id = p_tenant_id AND created_at >= v_since
    ), 0),
    'resolved_risks',    COALESCE((
      SELECT COUNT(*) FROM public.incidents
      WHERE tenant_id = p_tenant_id AND resolved_at >= v_since
    ), 0),
    'new_evidence',      COALESCE((
      SELECT COUNT(*) FROM public.governance_evidence
      WHERE tenant_id = p_tenant_id AND created_at >= v_since
    ), 0),
    'open_alerts',       COALESCE((
      SELECT COUNT(*) FROM public.governance_alerts
      WHERE tenant_id = p_tenant_id AND status = 'open'
    ), 0),
    'new_alerts_24h',    COALESCE((
      SELECT COUNT(*) FROM public.governance_alerts
      WHERE tenant_id = p_tenant_id AND created_at >= v_since
    ), 0),
    'critical_alerts',   COALESCE((
      SELECT COUNT(*) FROM public.governance_alerts
      WHERE tenant_id = p_tenant_id AND severity IN ('high','critical') AND status = 'open'
    ), 0),
    'failed_scans',      COALESCE((
      SELECT COUNT(*) FROM public.monitoring_sources
      WHERE tenant_id = p_tenant_id AND status = 'error'
        AND updated_at >= v_since
    ), 0),
    'active_sources',    COALESCE((
      SELECT COUNT(*) FROM public.monitoring_sources
      WHERE tenant_id = p_tenant_id AND status = 'active'
    ), 0),
    'pending_sources',   COALESCE((
      SELECT COUNT(*) FROM public.monitoring_sources
      WHERE tenant_id = p_tenant_id AND status = 'pending'
    ), 0),
    'next_scan_at',      (
      SELECT MIN(next_scan_at) FROM public.monitoring_sources
      WHERE tenant_id = p_tenant_id AND status = 'active'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.governance_24h_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.governance_24h_summary(UUID) TO authenticated;


-- ── RPC: alerts_list ───────────────────────────────────────────────────────
-- Paginierte Alert-Liste für ein Tenant.
CREATE OR REPLACE FUNCTION public.governance_alerts_list(
  p_tenant_id  UUID,
  p_status     TEXT DEFAULT NULL,
  p_severity   TEXT DEFAULT NULL,
  p_limit      INT  DEFAULT 50,
  p_offset     INT  DEFAULT 0
)
RETURNS SETOF public.governance_alerts
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE tenant_id = p_tenant_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Zugriff verweigert';
  END IF;

  RETURN QUERY
    SELECT * FROM public.governance_alerts
    WHERE tenant_id = p_tenant_id
      AND (p_status   IS NULL OR status   = p_status)
      AND (p_severity IS NULL OR severity = p_severity)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.governance_alerts_list(UUID, TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.governance_alerts_list(UUID, TEXT, TEXT, INT, INT) TO authenticated;

COMMIT;

-- =========================================================================
-- RealSync Dynamics AI — ADR-001 Mess-Substrat
--
-- Erfüllt die in ADR-001-event-backbone.md §4 dokumentierten Mess-
-- Bausteine, die heute noch fehlen, damit die vier Migrations-Trigger
-- (A/B/C/D) numerisch beobachtbar werden statt nur deklarativ:
--
--   - monitoring-Schema + monitoring.daily_metrics-Tabelle
--     (Cron-Target für die 14-Tage-Sustained-Bedingung)
--   - runtime_edges-Tabelle (Trigger B Graph-Schicht)
--   - monitoring.event_backbone_health-View (Trigger A Quelle)
--   - monitoring.tenant_active_30d-View (Trigger C Quelle)
--   - monitoring.compute_daily_metrics()-Function (von Cron callable)
--
-- Der Cron-Schedule selbst (täglich 00:05 UTC) wird in einer separaten
-- Migration aktiviert, sobald die Aggregations-Logik gegen Production-
-- Daten validiert wurde. Heute reicht die Function manuell zu rufen.
--
-- Alle Tabellen RLS-aktiviert. monitoring-Schema ist intern (service_role
-- only); kein Customer-Bezug, keine PII.
-- =========================================================================

-- 1. Schema
CREATE SCHEMA IF NOT EXISTS monitoring;
COMMENT ON SCHEMA monitoring IS
  'Interne Plattform-Metriken für Capacity-Planning und ADR-001-Migration-Trigger. Service-Role only, keine tenant_id-Spalten.';

-- =========================================================================
-- 2. runtime_edges (Trigger B Graph-Schicht)
--
-- Hybrid Graph Model in Postgres. Heute: leer; sobald Governance-Graphen
-- gebaut werden (Agent → Modell → Endpunkt → Policy → Evidence), schreiben
-- die jeweiligen Edge-Functions hier ein.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.runtime_edges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_id    uuid NOT NULL,
  source_type  text NOT NULL,
  target_id    uuid NOT NULL,
  target_type  text NOT NULL,
  edge_type    text NOT NULL,
  properties   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT runtime_edges_no_self_loop CHECK (source_id <> target_id)
);

CREATE INDEX IF NOT EXISTS runtime_edges_tenant_idx
  ON public.runtime_edges (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS runtime_edges_source_idx
  ON public.runtime_edges (tenant_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS runtime_edges_target_idx
  ON public.runtime_edges (tenant_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS runtime_edges_type_idx
  ON public.runtime_edges (tenant_id, edge_type);

ALTER TABLE public.runtime_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_edges_tenant_select ON public.runtime_edges;
CREATE POLICY runtime_edges_tenant_select
  ON public.runtime_edges
  FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS runtime_edges_tenant_insert ON public.runtime_edges;
CREATE POLICY runtime_edges_tenant_insert
  ON public.runtime_edges
  FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS runtime_edges_tenant_update ON public.runtime_edges;
CREATE POLICY runtime_edges_tenant_update
  ON public.runtime_edges
  FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS runtime_edges_tenant_delete ON public.runtime_edges;
CREATE POLICY runtime_edges_tenant_delete
  ON public.runtime_edges
  FOR DELETE
  USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.runtime_edges IS
  'Hybrid Graph: source → edge_type → target Beziehungen zwischen Runtime-Objekten (ai_systems, ai_policies, ai_evidence_events, tenants, agents). Edge-Type-Beispiele: governs, depends_on, derives_from, classified_by. ADR-001 Trigger B misst Anzahl und Query-Latency.';

-- =========================================================================
-- 3. monitoring.daily_metrics — Cron-Target
-- =========================================================================

CREATE TABLE IF NOT EXISTS monitoring.daily_metrics (
  measured_at                       date PRIMARY KEY,

  -- Trigger A — Event-Bus
  events_per_day                    bigint,
  runtime_events_total              bigint,
  ai_runtime_events_per_day         bigint,
  governance_events_per_day         bigint,

  -- Trigger B — Graph
  runtime_edges_count               bigint,
  runtime_edges_added_per_day       bigint,

  -- Trigger C — Tenancy
  tenants_total                     int,
  tenants_active_30d                int,
  largest_tenant_event_count_30d    bigint,

  -- Trigger D — Compute
  -- (heute nicht messbar aus Postgres allein; bleibt NULL bis VPS-Metriken
  --  via Edge Function eingespeist werden)
  parallel_playwright_workers_max   int,
  worker_vps_count                  int,

  computed_at                       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS monitoring_daily_metrics_recent_idx
  ON monitoring.daily_metrics (measured_at DESC);

ALTER TABLE monitoring.daily_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_daily_metrics ON monitoring.daily_metrics;
CREATE POLICY service_role_all_daily_metrics
  ON monitoring.daily_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE monitoring.daily_metrics IS
  'Eine Zeile pro Tag, befüllt durch monitoring.compute_daily_metrics(). Dient als 14-Tage-Sustained-Beobachtungsbasis für ADR-001-Trigger.';

-- =========================================================================
-- 4. Views — Trigger-Daten-Quellen
-- =========================================================================

CREATE OR REPLACE VIEW monitoring.event_backbone_health
WITH (security_invoker = on) AS
SELECT
  date_trunc('day', occurred_at)::date AS day,
  count(*)                              AS events_today,
  count(*) FILTER (WHERE name LIKE 'risk.%')         AS risk_events,
  count(*) FILTER (WHERE name LIKE 'policy.%')       AS policy_events,
  count(*) FILTER (WHERE name LIKE 'drift.%')        AS drift_events,
  count(DISTINCT tenant_id)              AS distinct_tenants
FROM public.runtime_events
WHERE occurred_at >= now() - interval '7 days'
GROUP BY 1
ORDER BY 1 DESC;

COMMENT ON VIEW monitoring.event_backbone_health IS
  '7-Tage-Aggregat aus runtime_events für ADR-001 Trigger A (Event-Throughput). Latency und LISTEN-Drops sind heute nicht direkt aus Postgres ableitbar — separates Folge-PR mit pg_stat_statements / pg_stat_activity sampling.';

CREATE OR REPLACE VIEW monitoring.tenant_active_30d
WITH (security_invoker = on) AS
SELECT
  count(DISTINCT tenant_id) AS tenants_active_30d
FROM public.runtime_events
WHERE occurred_at >= now() - interval '30 days';

COMMENT ON VIEW monitoring.tenant_active_30d IS
  'Single-Row-View: Anzahl Tenants mit mindestens einem runtime_events-Eintrag in den letzten 30 Tagen. Quelle für ADR-001 Trigger C.';

-- =========================================================================
-- 5. monitoring.compute_daily_metrics() — Aggregator
-- =========================================================================

CREATE OR REPLACE FUNCTION monitoring.compute_daily_metrics()
RETURNS monitoring.daily_metrics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = monitoring, public
AS $$
DECLARE
  v_row monitoring.daily_metrics;
BEGIN
  v_row.measured_at := current_date;

  SELECT count(*) INTO v_row.events_per_day
    FROM public.runtime_events
    WHERE occurred_at >= current_date AND occurred_at < current_date + 1;

  SELECT count(*) INTO v_row.runtime_events_total
    FROM public.runtime_events;

  -- ai_runtime_events und governance_events sind optional — Migration
  -- existiert in 20260510_ai_governance_core.sql / 20260512000000_governance_events.sql
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_runtime_events'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.ai_runtime_events
              WHERE occurred_at >= $1 AND occurred_at < $1 + 1'
      USING current_date
      INTO v_row.ai_runtime_events_per_day;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'governance_events'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.governance_events
              WHERE created_at >= $1 AND created_at < $1 + 1'
      USING current_date
      INTO v_row.governance_events_per_day;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE created_at >= current_date)
    INTO v_row.runtime_edges_count, v_row.runtime_edges_added_per_day
    FROM public.runtime_edges;

  SELECT count(*) INTO v_row.tenants_total FROM public.tenants;

  SELECT tenants_active_30d INTO v_row.tenants_active_30d
    FROM monitoring.tenant_active_30d;

  SELECT coalesce(max(c), 0) INTO v_row.largest_tenant_event_count_30d
    FROM (
      SELECT count(*) AS c
        FROM public.runtime_events
        WHERE occurred_at >= now() - interval '30 days'
        GROUP BY tenant_id
    ) per_tenant;

  v_row.computed_at := now();

  INSERT INTO monitoring.daily_metrics
    (measured_at, events_per_day, runtime_events_total,
     ai_runtime_events_per_day, governance_events_per_day,
     runtime_edges_count, runtime_edges_added_per_day,
     tenants_total, tenants_active_30d, largest_tenant_event_count_30d,
     computed_at)
  VALUES
    (v_row.measured_at, v_row.events_per_day, v_row.runtime_events_total,
     v_row.ai_runtime_events_per_day, v_row.governance_events_per_day,
     v_row.runtime_edges_count, v_row.runtime_edges_added_per_day,
     v_row.tenants_total, v_row.tenants_active_30d, v_row.largest_tenant_event_count_30d,
     v_row.computed_at)
  ON CONFLICT (measured_at) DO UPDATE SET
    events_per_day = excluded.events_per_day,
    runtime_events_total = excluded.runtime_events_total,
    ai_runtime_events_per_day = excluded.ai_runtime_events_per_day,
    governance_events_per_day = excluded.governance_events_per_day,
    runtime_edges_count = excluded.runtime_edges_count,
    runtime_edges_added_per_day = excluded.runtime_edges_added_per_day,
    tenants_total = excluded.tenants_total,
    tenants_active_30d = excluded.tenants_active_30d,
    largest_tenant_event_count_30d = excluded.largest_tenant_event_count_30d,
    computed_at = excluded.computed_at;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION monitoring.compute_daily_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION monitoring.compute_daily_metrics() TO service_role;

COMMENT ON FUNCTION monitoring.compute_daily_metrics() IS
  'Aggregiert die heutigen Metriken aus runtime_events / runtime_edges / tenants / Views und schreibt sie nach monitoring.daily_metrics (upsert). Vom Cron oder manuell aufrufbar. SECURITY DEFINER, GRANT nur auf service_role.';

-- =========================================================================
-- 6. Erstmaliger Run (idempotent: ON CONFLICT in der Function)
-- =========================================================================

DO $$
DECLARE
  v_row monitoring.daily_metrics;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'monitoring' AND p.proname = 'compute_daily_metrics'
  ) THEN
    SELECT * INTO v_row FROM monitoring.compute_daily_metrics();
    RAISE NOTICE 'monitoring.daily_metrics seeded for %, events_per_day=%, tenants_active_30d=%',
      v_row.measured_at, v_row.events_per_day, v_row.tenants_active_30d;
  END IF;
END $$;

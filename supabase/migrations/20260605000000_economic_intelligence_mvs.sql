-- RFC-004 — Materialized Views + Anomaly Detectors + Compliance Signal Pipeline
--
-- Builds on 20260604000000_economic_intelligence.sql which provided the
-- functional core (cost ledger, caps, on-demand risk/RACPO/quadrant
-- functions). This migration adds:
--
--   • Materialized Views for cost aggregation (7d/30d/90d rolling per
--     tenant / per feature / per agent)
--   • Materialized Views for risk + quadrant (cached for dashboards)
--   • security_invoker wrapper views that enforce RLS on the MVs
--     (PG 16 does not support RLS directly on MVs — wrapper pattern
--     gives equivalent isolation)
--   • Anomaly detectors: token explosion, consent regression,
--     cost-per-outcome explosion
--   • Compliance signal pipeline (GDPR / AI Act / NIS2)
--
-- Memory-decay anomaly is intentionally omitted — depends on
-- public.agent_memory which arrives with RFC-003 (post-pilot).

BEGIN;

-- ============================================================
-- 1. Cost Materialized Views
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS public.mv_cost_per_tenant CASCADE;
CREATE MATERIALIZED VIEW public.mv_cost_per_tenant AS
SELECT
    l.tenant_id,

    -- 7d window
    COALESCE(SUM(units) FILTER (WHERE cost_kind = 'llm_input'
                                AND occurred_at >= now() - INTERVAL '7 days'), 0)
        AS tokens_in_7d,
    COALESCE(SUM(units) FILTER (WHERE cost_kind = 'llm_output'
                                AND occurred_at >= now() - INTERVAL '7 days'), 0)
        AS tokens_out_7d,
    COALESCE(SUM(amount_usd) FILTER (WHERE cost_kind IN ('llm_input','llm_output')
                                     AND occurred_at >= now() - INTERVAL '7 days'), 0)
        AS llm_usd_7d,
    COALESCE(SUM(amount_usd) FILTER (WHERE cost_kind = 'storage_gb_hour'
                                     AND occurred_at >= now() - INTERVAL '7 days'), 0)
        AS storage_usd_7d,
    COALESCE(SUM(amount_usd) FILTER (WHERE cost_kind = 'memory_byte_hour'
                                     AND occurred_at >= now() - INTERVAL '7 days'), 0)
        AS memory_usd_7d,
    COALESCE(SUM(amount_usd) FILTER (WHERE cost_kind = 'incident_cost'
                                     AND occurred_at >= now() - INTERVAL '7 days'), 0)
        AS incident_usd_7d,

    -- 30d window
    COALESCE(SUM(units) FILTER (WHERE cost_kind = 'llm_input'
                                AND occurred_at >= now() - INTERVAL '30 days'), 0)
        AS tokens_in_30d,
    COALESCE(SUM(units) FILTER (WHERE cost_kind = 'llm_output'
                                AND occurred_at >= now() - INTERVAL '30 days'), 0)
        AS tokens_out_30d,
    COALESCE(SUM(amount_usd) FILTER (WHERE cost_kind IN ('llm_input','llm_output')
                                     AND occurred_at >= now() - INTERVAL '30 days'), 0)
        AS llm_usd_30d,

    -- 90d total
    COALESCE(SUM(amount_usd) FILTER (WHERE occurred_at >= now() - INTERVAL '90 days'), 0)
        AS total_usd_90d,

    now() AS computed_at
  FROM public.tenant_cost_ledger l
 WHERE is_simulated = false AND settled = true
 GROUP BY l.tenant_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_cost_per_tenant_pk
    ON public.mv_cost_per_tenant (tenant_id);

DROP MATERIALIZED VIEW IF EXISTS public.mv_cost_per_feature CASCADE;
CREATE MATERIALIZED VIEW public.mv_cost_per_feature AS
SELECT
    tenant_id,
    flow_ref,
    cost_kind,
    SUM(units)               AS units_30d,
    SUM(amount_usd)          AS amount_usd_30d,
    COUNT(DISTINCT trace_id) AS distinct_traces_30d,
    now()                    AS computed_at
  FROM public.tenant_cost_ledger
 WHERE is_simulated = false AND settled = true
   AND occurred_at >= now() - INTERVAL '30 days'
   AND flow_ref IS NOT NULL
 GROUP BY tenant_id, flow_ref, cost_kind;

CREATE UNIQUE INDEX IF NOT EXISTS mv_cost_per_feature_pk
    ON public.mv_cost_per_feature (tenant_id, flow_ref, cost_kind);

DROP MATERIALIZED VIEW IF EXISTS public.mv_cost_per_agent CASCADE;
CREATE MATERIALIZED VIEW public.mv_cost_per_agent AS
SELECT
    tenant_id,
    agent_ref,
    SUM(amount_usd)                                       AS amount_usd_30d,
    SUM(amount_usd) / 30.0                                AS amount_usd_daily_avg,
    COUNT(DISTINCT trace_id)                              AS distinct_traces_30d,
    SUM(units) FILTER (WHERE cost_kind = 'llm_input')     AS tokens_in_30d,
    SUM(units) FILTER (WHERE cost_kind = 'llm_output')    AS tokens_out_30d,
    now()                                                 AS computed_at
  FROM public.tenant_cost_ledger
 WHERE is_simulated = false AND settled = true
   AND occurred_at >= now() - INTERVAL '30 days'
   AND agent_ref IS NOT NULL
 GROUP BY tenant_id, agent_ref;

CREATE UNIQUE INDEX IF NOT EXISTS mv_cost_per_agent_pk
    ON public.mv_cost_per_agent (tenant_id, agent_ref);

-- ============================================================
-- 2. Risk + Quadrant Materialized Views
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS public.mv_tenant_risk_score CASCADE;
CREATE MATERIALIZED VIEW public.mv_tenant_risk_score AS
SELECT
    t.id                                            AS tenant_id,
    (r).out_consent_component                        AS consent_component,
    (r).out_ai_loop_component                        AS ai_loop_component,
    (r).out_memory_inflation_component               AS memory_inflation_component,
    (r).out_incident_component                       AS incident_component,
    (r).out_tenant_risk_score                        AS tenant_risk_score,
    (r).out_feature_hash                             AS feature_hash,
    (r).out_model_ref                                AS model_ref,
    (r).out_computed_at                              AS computed_at
  FROM public.tenants t,
       LATERAL public._compute_tenant_risk_score_internal(t.id) r;

CREATE UNIQUE INDEX IF NOT EXISTS mv_tenant_risk_score_pk
    ON public.mv_tenant_risk_score (tenant_id);

DROP MATERIALIZED VIEW IF EXISTS public.mv_tenant_risk_cost_quadrant CASCADE;
CREATE MATERIALIZED VIEW public.mv_tenant_risk_cost_quadrant AS
SELECT
    t.id                                            AS tenant_id,
    (q).out_risk_score                              AS risk_score,
    (q).out_spend_90d                               AS spend_90d,
    (q).out_median_spend                            AS median_spend,
    (q).out_quadrant                                AS quadrant,
    (q).out_computed_at                             AS computed_at
  FROM public.tenants t,
       LATERAL public._compute_tenant_quadrant_internal(t.id) q;

CREATE UNIQUE INDEX IF NOT EXISTS mv_tenant_risk_cost_quadrant_pk
    ON public.mv_tenant_risk_cost_quadrant (tenant_id);

-- ============================================================
-- 3. security_invoker wrapper views
-- ============================================================
-- PG 16 does not natively support RLS on materialized views. We achieve
-- equivalent isolation with a security_invoker view that filters via
-- has_tenant_membership(). The MV itself is locked to service-role.

-- Revoke MV access from authenticated; only service-role refreshes.
REVOKE ALL ON public.mv_cost_per_tenant            FROM PUBLIC, authenticated;
REVOKE ALL ON public.mv_cost_per_feature           FROM PUBLIC, authenticated;
REVOKE ALL ON public.mv_cost_per_agent             FROM PUBLIC, authenticated;
REVOKE ALL ON public.mv_tenant_risk_score          FROM PUBLIC, authenticated;
REVOKE ALL ON public.mv_tenant_risk_cost_quadrant  FROM PUBLIC, authenticated;
GRANT SELECT ON public.mv_cost_per_tenant            TO service_role;
GRANT SELECT ON public.mv_cost_per_feature           TO service_role;
GRANT SELECT ON public.mv_cost_per_agent             TO service_role;
GRANT SELECT ON public.mv_tenant_risk_score          TO service_role;
GRANT SELECT ON public.mv_tenant_risk_cost_quadrant  TO service_role;

CREATE OR REPLACE VIEW public.v_cost_per_tenant
AS
SELECT * FROM public.mv_cost_per_tenant
 WHERE public.has_tenant_membership(tenant_id);

CREATE OR REPLACE VIEW public.v_cost_per_feature
AS
SELECT * FROM public.mv_cost_per_feature
 WHERE public.has_tenant_membership(tenant_id);

CREATE OR REPLACE VIEW public.v_cost_per_agent
AS
SELECT * FROM public.mv_cost_per_agent
 WHERE public.has_tenant_membership(tenant_id);

CREATE OR REPLACE VIEW public.v_tenant_risk_score
AS
SELECT * FROM public.mv_tenant_risk_score
 WHERE public.has_tenant_membership(tenant_id);

CREATE OR REPLACE VIEW public.v_tenant_risk_cost_quadrant
AS
SELECT * FROM public.mv_tenant_risk_cost_quadrant
 WHERE public.has_tenant_membership(tenant_id);

GRANT SELECT ON public.v_cost_per_tenant           TO authenticated;
GRANT SELECT ON public.v_cost_per_feature          TO authenticated;
GRANT SELECT ON public.v_cost_per_agent            TO authenticated;
GRANT SELECT ON public.v_tenant_risk_score         TO authenticated;
GRANT SELECT ON public.v_tenant_risk_cost_quadrant TO authenticated;

-- ============================================================
-- 4. Refresh helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_governance_mvs(
    p_concurrent BOOLEAN DEFAULT true
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT := 0;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    -- CONCURRENTLY requires a unique index AND avoids exclusive locks.
    -- First-run after migration must use non-concurrent (MV is not yet
    -- populated), but subsequent runs use CONCURRENTLY by default.
    IF p_concurrent THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cost_per_tenant;
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cost_per_feature;
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cost_per_agent;
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_risk_score;
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_risk_cost_quadrant;
    ELSE
        REFRESH MATERIALIZED VIEW public.mv_cost_per_tenant;
        REFRESH MATERIALIZED VIEW public.mv_cost_per_feature;
        REFRESH MATERIALIZED VIEW public.mv_cost_per_agent;
        REFRESH MATERIALIZED VIEW public.mv_tenant_risk_score;
        REFRESH MATERIALIZED VIEW public.mv_tenant_risk_cost_quadrant;
    END IF;
    v_count := 5;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_governance_mvs(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_governance_mvs(BOOLEAN) TO service_role;

-- ============================================================
-- 5. Anomaly detectors
-- ============================================================

-- 5.1 Token Explosion — RFC-004 §4.2
-- A trace whose total tokens exceed 30d p99 AND z-score ≥ 4σ.
CREATE OR REPLACE FUNCTION public.detect_token_explosion(
    p_tenant_id UUID,
    p_window    INTERVAL DEFAULT INTERVAL '1 hour'
) RETURNS TABLE (
    trace_id      UUID,
    total_tokens  BIGINT,
    baseline_p99  BIGINT,
    z_score       NUMERIC(6,2),
    detected_at   TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    WITH baseline AS (
        SELECT
            percentile_disc(0.99) WITHIN GROUP (ORDER BY tt)::bigint AS p99,
            stddev_samp(tt) AS stddev,
            avg(tt) AS mean
          FROM (
              SELECT e.trace_id,
                     SUM(((e.payload->>'input_tokens')::int +
                          (e.payload->>'output_tokens')::int))::bigint AS tt
                FROM public.runtime_events e
               WHERE e.tenant_id = p_tenant_id
                 AND e.type LIKE 'ai.%'
                 AND e.ts BETWEEN now() - INTERVAL '30 days' AND now() - p_window
                 AND e.trace_id IS NOT NULL
               GROUP BY e.trace_id) traces
    ),
    cur AS (
        SELECT e.trace_id,
               SUM(((e.payload->>'input_tokens')::int +
                    (e.payload->>'output_tokens')::int))::bigint AS tt
          FROM public.runtime_events e
         WHERE e.tenant_id = p_tenant_id AND e.type LIKE 'ai.%'
           AND e.ts >= now() - p_window AND e.trace_id IS NOT NULL
         GROUP BY e.trace_id
    )
    SELECT c.trace_id, c.tt, b.p99,
           CASE WHEN b.stddev IS NULL OR b.stddev = 0 THEN 0
                ELSE ((c.tt - b.mean) / b.stddev)::numeric(6,2) END,
           now()
      FROM cur c CROSS JOIN baseline b
     WHERE c.tt > b.p99
       AND b.stddev > 0 AND (c.tt - b.mean) / b.stddev >= 4;
END;
$$;

-- 5.2 Consent Regression — RFC-004 §4.3
-- consent.granted followed by tracker.pre_consent_detected for same subject
-- within 1 hour.
CREATE OR REPLACE FUNCTION public.detect_consent_regression(
    p_tenant_id UUID,
    p_window    INTERVAL DEFAULT INTERVAL '24 hours'
) RETURNS TABLE (
    subject_ref       TEXT,
    granted_at        TIMESTAMPTZ,
    regressed_at      TIMESTAMPTZ,
    regression_lag    INTERVAL,
    pre_consent_event UUID
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    WITH grants AS (
        SELECT e.subject_ref, e.ts AS granted_at
          FROM public.runtime_events e
         WHERE e.tenant_id = p_tenant_id AND e.type = 'consent.granted'
           AND e.ts >= now() - p_window
           AND e.subject_ref IS NOT NULL
    ),
    breach AS (
        SELECT e.subject_ref, e.ts AS regressed_at, e.id
          FROM public.runtime_events e
         WHERE e.tenant_id = p_tenant_id
           AND e.type = 'tracker.pre_consent_detected'
           AND e.ts >= now() - p_window
           AND e.subject_ref IS NOT NULL
    )
    SELECT g.subject_ref, g.granted_at, b.regressed_at,
           b.regressed_at - g.granted_at, b.id
      FROM grants g JOIN breach b
        ON b.subject_ref = g.subject_ref
       AND b.regressed_at > g.granted_at
       AND b.regressed_at - g.granted_at < INTERVAL '1 hour';
END;
$$;

-- 5.3 Cost-per-Outcome Explosion — RFC-004 §4.4
-- Today's USD per completed outcome >= 5× rolling 30d for the same flow.
CREATE OR REPLACE FUNCTION public.detect_cost_per_outcome_explosion(
    p_tenant_id UUID
) RETURNS TABLE (
    flow_ref          TEXT,
    cost_per_outcome  NUMERIC(14,6),
    rolling_30d       NUMERIC(14,6),
    multiplier        NUMERIC(6,2)
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    WITH today_spend AS (
        SELECT l.flow_ref, SUM(l.amount_usd)::numeric(14,6) AS s
          FROM public.tenant_cost_ledger l
         WHERE l.tenant_id = p_tenant_id
           AND l.is_simulated = false AND l.settled = true
           AND l.occurred_at >= CURRENT_DATE
           AND l.flow_ref IS NOT NULL
         GROUP BY l.flow_ref
    ),
    today_completed AS (
        SELECT e.payload->>'flow_ref' AS flow_ref,
               COUNT(*)::int AS c
          FROM public.runtime_events e
         WHERE e.tenant_id = p_tenant_id
           AND e.type = 'outcome.completed'
           AND e.ts >= CURRENT_DATE
           AND e.payload ? 'flow_ref'
         GROUP BY e.payload->>'flow_ref'
    ),
    rolling_spend AS (
        SELECT l.flow_ref, SUM(l.amount_usd)::numeric(14,6) AS s
          FROM public.tenant_cost_ledger l
         WHERE l.tenant_id = p_tenant_id
           AND l.is_simulated = false AND l.settled = true
           AND l.occurred_at >= now() - INTERVAL '30 days'
           AND l.flow_ref IS NOT NULL
         GROUP BY l.flow_ref
    ),
    rolling_completed AS (
        SELECT e.payload->>'flow_ref' AS flow_ref,
               COUNT(*)::int AS c
          FROM public.runtime_events e
         WHERE e.tenant_id = p_tenant_id
           AND e.type = 'outcome.completed'
           AND e.ts >= now() - INTERVAL '30 days'
           AND e.payload ? 'flow_ref'
         GROUP BY e.payload->>'flow_ref'
    )
    SELECT
        ts.flow_ref,
        (ts.s / NULLIF(tc.c, 0))::numeric(14,6) AS cost_per_outcome,
        (rs.s / NULLIF(rc.c, 0))::numeric(14,6) AS rolling_30d,
        ((ts.s / NULLIF(tc.c, 0))
            / NULLIF(rs.s / NULLIF(rc.c, 0), 0))::numeric(6,2) AS multiplier
      FROM today_spend ts
      JOIN today_completed     tc ON tc.flow_ref = ts.flow_ref
      JOIN rolling_spend       rs ON rs.flow_ref = ts.flow_ref
      JOIN rolling_completed   rc ON rc.flow_ref = ts.flow_ref
     WHERE tc.c > 0 AND rc.c > 0 AND rs.s > 0
       AND (ts.s / NULLIF(tc.c, 0)) >= 5 * (rs.s / NULLIF(rc.c, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.detect_token_explosion(UUID, INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_consent_regression(UUID, INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_cost_per_outcome_explosion(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_token_explosion(UUID, INTERVAL)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.detect_consent_regression(UUID, INTERVAL)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.detect_cost_per_outcome_explosion(UUID)           TO authenticated, service_role;

-- ============================================================
-- 6. Compliance Signal Pipeline
-- ============================================================

-- Marks an open compliance signal as part of the appropriate framework.
-- Service-role only — pipeline writers, not user code.
CREATE OR REPLACE FUNCTION public.mark_compliance_signal(
    p_tenant_id      UUID,
    p_framework      TEXT,        -- 'gdpr' | 'ai_act' | 'nis2'
    p_root_event     UUID,
    p_subject_ref    TEXT DEFAULT NULL,
    p_severity       TEXT DEFAULT 'medium'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_event_id UUID;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_framework NOT IN ('gdpr','ai_act','nis2') THEN
        RAISE EXCEPTION 'invalid framework: %', p_framework
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    INSERT INTO public.runtime_events
        (tenant_id, type, severity, source, review_status,
         subject_ref, causation_id, payload)
    VALUES
        (p_tenant_id,
         CASE p_framework
            WHEN 'gdpr'   THEN 'compliance.gdpr_signal'
            WHEN 'ai_act' THEN 'compliance.ai_act_signal'
            WHEN 'nis2'   THEN 'compliance.nis2_signal'
         END,
         p_severity, 'compliance', 'pending',
         p_subject_ref, p_root_event,
         jsonb_build_object(
            'framework',   p_framework,
            'root_event',  p_root_event,
            'subject_ref', p_subject_ref))
    RETURNING id INTO v_event_id;
    RETURN v_event_id;
END;
$$;

-- Walks the causation-DAG from a root event and writes
-- compliance.taint_propagated events for every downstream node.
CREATE OR REPLACE FUNCTION public.propagate_compliance_taint(
    p_tenant_id     UUID,
    p_root_event_id UUID,
    p_signal_kind   TEXT,
    p_subject_ref   TEXT DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT := 0;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    WITH RECURSIVE downstream AS (
        SELECT e.id, 0 AS depth
          FROM public.runtime_events e
         WHERE e.id = p_root_event_id AND e.tenant_id = p_tenant_id
        UNION ALL
        SELECT e.id, d.depth + 1
          FROM public.runtime_events e
          JOIN downstream d ON e.causation_id = d.id
         WHERE d.depth < 64 AND e.tenant_id = p_tenant_id
    )
    INSERT INTO public.runtime_events
        (tenant_id, type, severity, source, review_status,
         subject_ref, causation_id, payload)
    SELECT p_tenant_id, 'compliance.taint_propagated', 'medium',
           'compliance', 'auto', p_subject_ref, d.id,
           jsonb_build_object('signal_kind', p_signal_kind,
                              'root_event',  p_root_event_id,
                              'depth',       d.depth)
      FROM downstream d
     WHERE d.depth > 0;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Open compliance signals — aggregated via MV refreshed alongside cost MVs.
DROP MATERIALIZED VIEW IF EXISTS public.mv_compliance_signals_open CASCADE;
CREATE MATERIALIZED VIEW public.mv_compliance_signals_open AS
SELECT
    e.tenant_id,
    CASE
        WHEN e.type = 'compliance.gdpr_signal'   THEN 'gdpr'
        WHEN e.type = 'compliance.ai_act_signal' THEN 'ai_act'
        WHEN e.type = 'compliance.nis2_signal'   THEN 'nis2'
        ELSE 'other'
    END AS framework,
    e.subject_ref,
    e.severity,
    e.ts AS opened_at,
    e.global_seq AS root_global_seq
  FROM public.runtime_events e
 WHERE e.type IN ('compliance.gdpr_signal','compliance.ai_act_signal','compliance.nis2_signal')
   AND NOT EXISTS (
       SELECT 1 FROM public.runtime_events r
        WHERE r.tenant_id = e.tenant_id
          AND r.type = 'compliance.signal_closed'
          AND (r.payload->>'root_global_seq')::bigint = e.global_seq);

CREATE UNIQUE INDEX IF NOT EXISTS mv_compliance_signals_open_pk
    ON public.mv_compliance_signals_open (tenant_id, root_global_seq);

REVOKE ALL ON public.mv_compliance_signals_open FROM PUBLIC, authenticated;
GRANT SELECT ON public.mv_compliance_signals_open TO service_role;

CREATE OR REPLACE VIEW public.v_compliance_signals_open
AS
SELECT * FROM public.mv_compliance_signals_open
 WHERE public.has_tenant_membership(tenant_id);
GRANT SELECT ON public.v_compliance_signals_open TO authenticated;

REVOKE ALL ON FUNCTION public.mark_compliance_signal(UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.propagate_compliance_taint(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_compliance_signal(UUID, TEXT, UUID, TEXT, TEXT)        TO service_role;
GRANT EXECUTE ON FUNCTION public.propagate_compliance_taint(UUID, UUID, TEXT, TEXT)          TO service_role;

-- ============================================================
-- 7. Extend refresh helper to include compliance MV
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_governance_mvs(
    p_concurrent BOOLEAN DEFAULT true
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT := 0;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_concurrent THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cost_per_tenant;
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cost_per_feature;
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cost_per_agent;
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_risk_score;
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_risk_cost_quadrant;
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_compliance_signals_open;
    ELSE
        REFRESH MATERIALIZED VIEW public.mv_cost_per_tenant;
        REFRESH MATERIALIZED VIEW public.mv_cost_per_feature;
        REFRESH MATERIALIZED VIEW public.mv_cost_per_agent;
        REFRESH MATERIALIZED VIEW public.mv_tenant_risk_score;
        REFRESH MATERIALIZED VIEW public.mv_tenant_risk_cost_quadrant;
        REFRESH MATERIALIZED VIEW public.mv_compliance_signals_open;
    END IF;
    v_count := 6;
    RETURN v_count;
END;
$$;

COMMIT;

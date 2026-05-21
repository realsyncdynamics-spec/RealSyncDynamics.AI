-- RFC-004 — Governance Intelligence + Economic Control v1.0 (Phase 1 DDL)
--
-- Phase-1 implementation: schema + on-demand compute. Materialized Views
-- are intentionally NOT created here:
--   • Postgres 16 does not support RLS on materialized views (added in 17).
--   • Pilot scale (≤ 10 tenants × ≤ 50k events) does not yet need caching.
--   • MV refresh + RLS-via-security_invoker wrapper view is a follow-up
--     migration once we have load to justify the operational complexity.
--
-- Depends on:
--   • SPEC-001 (20260602000000_runtime_events_backbone.sql)
--   • RFC-002 (20260603000000_subject_ref_lifecycle.sql) for subject_ref-aware
--     risk components

BEGIN;

-- ============================================================
-- Part B / §5 — tenant_cost_ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_cost_ledger (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    agent_ref        TEXT,
    flow_ref         TEXT,
    trace_id         UUID,
    correlation_id   UUID,
    causation_event  UUID,

    cost_kind        TEXT NOT NULL CHECK (cost_kind IN (
                       'llm_input','llm_output','storage_gb_hour',
                       'edge_invocation','webhook_egress','memory_byte_hour',
                       'incident_cost','replay_simulation','reservation')),
    units            NUMERIC(18,6) NOT NULL,
    unit_price_usd   NUMERIC(12,8) NOT NULL,
    amount_usd       NUMERIC(14,6) NOT NULL GENERATED ALWAYS AS
                       (units * unit_price_usd) STORED,
    vendor           TEXT,
    model_ref        TEXT,

    is_simulated     BOOLEAN NOT NULL DEFAULT false,
    replay_run_id    UUID,

    reservation_id   UUID,
    settled          BOOLEAN NOT NULL DEFAULT true,
    settled_at       TIMESTAMPTZ,
    expires_at       TIMESTAMPTZ,

    raw_metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT cost_ledger_has_attribution CHECK (
        agent_ref IS NOT NULL OR flow_ref IS NOT NULL OR trace_id IS NOT NULL
    ),
    CONSTRAINT cost_ledger_sim_has_run CHECK (
        is_simulated = false OR replay_run_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS tenant_cost_ledger_tenant_time_idx
    ON public.tenant_cost_ledger (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS tenant_cost_ledger_trace_idx
    ON public.tenant_cost_ledger (trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tenant_cost_ledger_agent_idx
    ON public.tenant_cost_ledger (tenant_id, agent_ref, occurred_at DESC);
CREATE INDEX IF NOT EXISTS tenant_cost_ledger_flow_idx
    ON public.tenant_cost_ledger (tenant_id, flow_ref, occurred_at DESC);
CREATE INDEX IF NOT EXISTS tenant_cost_ledger_pending_idx
    ON public.tenant_cost_ledger (expires_at) WHERE settled = false;
CREATE INDEX IF NOT EXISTS tenant_cost_ledger_simulated_idx
    ON public.tenant_cost_ledger (replay_run_id) WHERE is_simulated = true;

ALTER TABLE public.tenant_cost_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_cost_ledger tenant-read" ON public.tenant_cost_ledger;
CREATE POLICY "tenant_cost_ledger tenant-read"
    ON public.tenant_cost_ledger FOR SELECT
    USING (public.has_tenant_membership(tenant_id));
DROP POLICY IF EXISTS "tenant_cost_ledger deny-writes" ON public.tenant_cost_ledger;
CREATE POLICY "tenant_cost_ledger deny-writes"
    ON public.tenant_cost_ledger FOR INSERT WITH CHECK (false);

-- Append-only for SETTLED rows. Unsettled reservations may be DELETEd
-- by the expiry sweeper; settled rows are immutable financial records.
CREATE OR REPLACE FUNCTION public.tenant_cost_ledger_block_settled_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.settled IS TRUE THEN
        RAISE EXCEPTION
            'tenant_cost_ledger is append-only for settled rows (% on tenant_cost_ledger)',
            TG_OP
            USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tenant_cost_ledger_no_delete ON public.tenant_cost_ledger;
CREATE TRIGGER tenant_cost_ledger_no_delete
    BEFORE DELETE ON public.tenant_cost_ledger
    FOR EACH ROW EXECUTE FUNCTION public.tenant_cost_ledger_block_settled_mutation();
-- NOTE: UPDATE is allowed (reservation → settled, units/price patch).
-- Settled-row UPDATEs are forbidden too — add when needed.

-- ============================================================
-- §6 — tenant_cost_caps
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_cost_caps (
    tenant_id           UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    llm_tokens_monthly  BIGINT       NOT NULL DEFAULT 5000000,
    llm_usd_monthly     NUMERIC(10,2) NOT NULL DEFAULT 250.00,
    storage_gb_hours    NUMERIC(12,2) NOT NULL DEFAULT 1000,
    edge_invocations    BIGINT       NOT NULL DEFAULT 1000000,
    replay_simulations  INT          NOT NULL DEFAULT 100,
    memory_per_subject  BIGINT       NOT NULL DEFAULT 10000,
    warn_threshold      NUMERIC(3,2) NOT NULL DEFAULT 0.80,
    override_until      TIMESTAMPTZ,
    notes               TEXT,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
ALTER TABLE public.tenant_cost_caps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_cost_caps tenant-read" ON public.tenant_cost_caps;
CREATE POLICY "tenant_cost_caps tenant-read"
    ON public.tenant_cost_caps FOR SELECT
    USING (public.has_tenant_membership(tenant_id));
DROP POLICY IF EXISTS "tenant_cost_caps deny-writes" ON public.tenant_cost_caps;
CREATE POLICY "tenant_cost_caps deny-writes"
    ON public.tenant_cost_caps FOR ALL USING (false) WITH CHECK (false);

-- ============================================================
-- §6.2 — Pre-check + reservation + settle
-- ============================================================
CREATE OR REPLACE FUNCTION public.cost_check_and_reserve(
    p_tenant_id        UUID,
    p_cost_kind        TEXT,
    p_units_estimate   NUMERIC,
    p_unit_price_usd   NUMERIC,
    p_attribution      JSONB
) RETURNS TABLE (decision TEXT, reservation_id UUID,
                 cap_remaining NUMERIC, cap_used NUMERIC, cap_total NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caps   public.tenant_cost_caps%ROWTYPE;
    v_used   NUMERIC;
    v_est    NUMERIC := p_units_estimate * p_unit_price_usd;
    v_total  NUMERIC;
    v_remain NUMERIC;
    v_rid    UUID := gen_random_uuid();
    v_dec    TEXT;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_caps FROM public.tenant_cost_caps WHERE tenant_id = p_tenant_id;
    IF v_caps.tenant_id IS NULL THEN
        v_caps.llm_usd_monthly     := 250.00;
        v_caps.replay_simulations  := 100;
        v_caps.edge_invocations    := 1000000;
        v_caps.storage_gb_hours    := 1000;
        v_caps.warn_threshold      := 0.80;
    END IF;

    v_total := CASE p_cost_kind
        WHEN 'llm_input'  THEN v_caps.llm_usd_monthly
        WHEN 'llm_output' THEN v_caps.llm_usd_monthly
        WHEN 'replay_simulation' THEN v_caps.replay_simulations::numeric
        WHEN 'edge_invocation'   THEN v_caps.edge_invocations::numeric
        WHEN 'storage_gb_hour'   THEN v_caps.storage_gb_hours
        ELSE 1e12 END;

    SELECT COALESCE(SUM(amount_usd), 0) INTO v_used
      FROM public.tenant_cost_ledger
     WHERE tenant_id = p_tenant_id
       AND cost_kind = ANY(CASE
              WHEN p_cost_kind IN ('llm_input','llm_output')
                  THEN ARRAY['llm_input','llm_output']
              ELSE ARRAY[p_cost_kind] END)
       AND is_simulated = false
       AND occurred_at >= DATE_TRUNC('month', now());

    v_remain := v_total - v_used;

    IF v_used + v_est > v_total THEN
        v_dec := 'throttle';
        INSERT INTO public.runtime_events
            (tenant_id, type, severity, source, review_status, payload)
        VALUES (p_tenant_id, 'cost.cap_violation_blocked', 'critical',
                'economic_control', 'auto',
                jsonb_build_object('cost_kind', p_cost_kind,
                                   'estimate_usd', v_est,
                                   'cap_remaining', v_remain,
                                   'attribution', p_attribution));
        RETURN QUERY SELECT v_dec, NULL::uuid, v_remain, v_used, v_total;
        RETURN;
    ELSIF v_used / NULLIF(v_total, 0) >= v_caps.warn_threshold THEN
        v_dec := 'warn';
    ELSE
        v_dec := 'allow';
    END IF;

    INSERT INTO public.tenant_cost_ledger
        (tenant_id, cost_kind, units, unit_price_usd,
         agent_ref, flow_ref, trace_id, causation_event,
         reservation_id, settled, expires_at)
    VALUES (p_tenant_id, 'reservation', p_units_estimate, p_unit_price_usd,
            p_attribution->>'agent_ref',
            p_attribution->>'flow_ref',
            (p_attribution->>'trace_id')::uuid,
            (p_attribution->>'causation_event')::uuid,
            v_rid, false, now() + INTERVAL '5 minutes');

    RETURN QUERY SELECT v_dec, v_rid, v_remain, v_used, v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.cost_writer_settle(
    p_reservation_id   UUID,
    p_cost_kind        TEXT,
    p_units_actual     NUMERIC,
    p_unit_price_usd   NUMERIC
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id BIGINT;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    UPDATE public.tenant_cost_ledger
       SET cost_kind      = p_cost_kind,
           units          = p_units_actual,
           unit_price_usd = p_unit_price_usd,
           settled        = true,
           settled_at     = now(),
           expires_at     = NULL
     WHERE reservation_id = p_reservation_id
       AND settled        = false
     RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        RAISE EXCEPTION 'reservation % not found or already settled', p_reservation_id
            USING ERRCODE = 'no_data_found';
    END IF;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cost_sweep_expired_reservations()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    WITH expired AS (
        DELETE FROM public.tenant_cost_ledger
              WHERE settled = false AND expires_at < now()
          RETURNING tenant_id, reservation_id
    )
    INSERT INTO public.runtime_events
        (tenant_id, type, severity, source, review_status, payload)
    SELECT e.tenant_id, 'cost.reservation_expired', 'low',
           'economic_control', 'auto',
           jsonb_build_object('reservation_id', e.reservation_id)
      FROM expired e;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cost_check_and_reserve(UUID,TEXT,NUMERIC,NUMERIC,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cost_writer_settle(UUID,TEXT,NUMERIC,NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cost_sweep_expired_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cost_check_and_reserve(UUID,TEXT,NUMERIC,NUMERIC,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.cost_writer_settle(UUID,TEXT,NUMERIC,NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.cost_sweep_expired_reservations() TO service_role;

-- ============================================================
-- §5.1 — Cost propagation along causation-DAG
-- ============================================================
CREATE OR REPLACE FUNCTION public.propagate_cost_attribution(
    p_tenant_id  UUID,
    p_root_event UUID
) RETURNS TABLE (event_id UUID, depth INT, intrinsic NUMERIC(14,6),
                 accumulated NUMERIC(14,6))
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    WITH RECURSIVE walk(event_id, depth, intrinsic, accumulated) AS (
        SELECT e.id, 0,
               COALESCE((e.payload->'cost_units'->>'total')::numeric, 0),
               COALESCE((e.payload->'cost_units'->>'total')::numeric, 0)
          FROM public.runtime_events e
         WHERE e.id = p_root_event AND e.tenant_id = p_tenant_id
        UNION ALL
        SELECT e.id, w.depth + 1,
               COALESCE((e.payload->'cost_units'->>'total')::numeric, 0),
               w.accumulated + COALESCE((e.payload->'cost_units'->>'total')::numeric, 0)
          FROM public.runtime_events e
          JOIN walk w ON e.causation_id = w.event_id
         WHERE w.depth < 64 AND e.tenant_id = p_tenant_id
    )
    SELECT * FROM walk;
END;
$$;

REVOKE ALL ON FUNCTION public.propagate_cost_attribution(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propagate_cost_attribution(UUID,UUID) TO authenticated, service_role;

-- ============================================================
-- Part A / §2 — Risk Scoring (on-demand, no MVs in Phase 1)
-- ============================================================
-- Internal — no membership check; used by service-role pipelines.
CREATE OR REPLACE FUNCTION public._compute_tenant_risk_score_internal(
    p_tenant_id UUID,
    p_as_of TIMESTAMPTZ DEFAULT now()
) RETURNS TABLE (
    out_consent_component          NUMERIC(5,2),
    out_ai_loop_component          NUMERIC(5,2),
    out_memory_inflation_component NUMERIC(5,2),
    out_incident_component         NUMERIC(5,2),
    out_tenant_risk_score          NUMERIC(5,2),
    out_feature_hash               TEXT,
    out_model_ref                  TEXT,
    out_computed_at                TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_consent  NUMERIC(5,2) := 0;
    v_ai_loop  NUMERIC(5,2) := 0;
    v_memory   NUMERIC(5,2) := 0;
    v_incident NUMERIC(5,2) := 0;
BEGIN
    SELECT LEAST(100.0,
              COUNT(*) FILTER (WHERE e.severity IN ('high','critical')) * 5.0
            + COUNT(*) * 0.5)
      INTO v_consent
      FROM public.runtime_events e
     WHERE e.tenant_id = p_tenant_id
       AND e.type IN ('tracker.pre_consent_detected','consent.regression_detected')
       AND e.ts BETWEEN p_as_of - INTERVAL '7 days' AND p_as_of;

    -- COALESCE because LEAST(100.0, NULL) returns 100.0 in PG14+.
    SELECT LEAST(100.0,
              COALESCE(SUM(CASE e.severity
                    WHEN 'critical' THEN 25
                    WHEN 'high'     THEN 10
                    WHEN 'medium'   THEN 3
                    WHEN 'low'      THEN 1
                    ELSE 0 END), 0))
      INTO v_incident
      FROM public.runtime_events e
     WHERE e.tenant_id = p_tenant_id
       AND e.type IN ('incident.opened','incident.escalated','policy.violation_detected')
       AND e.ts BETWEEN p_as_of - INTERVAL '30 days' AND p_as_of;

    RETURN QUERY SELECT
        COALESCE(v_consent, 0),
        v_ai_loop,
        v_memory,
        COALESCE(v_incident, 0),
        ( 0.30 * COALESCE(v_consent, 0)
        + 0.20 * v_ai_loop
        + 0.20 * v_memory
        + 0.30 * COALESCE(v_incident, 0))::numeric(5,2),
        encode(extensions.digest(
            format('tenant=%s|v1.0|c=%s|l=%s|m=%s|i=%s',
                p_tenant_id,
                COALESCE(v_consent, 0), v_ai_loop, v_memory,
                COALESCE(v_incident, 0))::bytea, 'sha256'), 'hex'),
        'tenant-risk-v1.0',
        p_as_of;
END;
$$;

-- Public — membership-gated wrapper.
CREATE OR REPLACE FUNCTION public.compute_tenant_risk_score(
    p_tenant_id UUID,
    p_as_of TIMESTAMPTZ DEFAULT now()
) RETURNS TABLE (
    consent_component         NUMERIC(5,2),
    ai_loop_component         NUMERIC(5,2),
    memory_inflation_component NUMERIC(5,2),
    incident_component        NUMERIC(5,2),
    tenant_risk_score         NUMERIC(5,2),
    feature_hash              TEXT,
    model_ref                 TEXT,
    computed_at               TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY SELECT * FROM public._compute_tenant_risk_score_internal(p_tenant_id, p_as_of);
END;
$$;

-- Internal helper — no membership check. Used by triggers / cron that
-- already operate in a trusted context. Public RPC wraps with membership check.
CREATE OR REPLACE FUNCTION public._compute_subject_risk_score_internal(
    p_tenant_id   UUID,
    p_subject_ref TEXT,
    p_as_of       TIMESTAMPTZ DEFAULT now()
) RETURNS TABLE (
    out_subject_ref     TEXT,
    out_risk_score      NUMERIC(5,2),
    out_consent_signal  NUMERIC(5,2),
    out_incident_signal NUMERIC(5,2),
    out_velocity_signal NUMERIC(5,2),
    out_feature_hash    TEXT,
    out_model_ref       TEXT,
    out_computed_at     TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_consent  NUMERIC(5,2);
    v_incident NUMERIC(5,2);
    v_velocity NUMERIC(5,2);
BEGIN
    SELECT LEAST(100.0, COUNT(*) * 12.0) INTO v_consent
      FROM public.runtime_events e
     WHERE e.tenant_id = p_tenant_id AND e.subject_ref = p_subject_ref
       AND e.type IN ('tracker.pre_consent_detected','consent.regression_detected')
       AND e.ts BETWEEN p_as_of - INTERVAL '30 days' AND p_as_of;

    SELECT LEAST(100.0, COALESCE(SUM(CASE e.severity
                                WHEN 'critical' THEN 30
                                WHEN 'high'     THEN 12
                                WHEN 'medium'   THEN 4
                                ELSE 1 END), 0))
      INTO v_incident
      FROM public.runtime_events e
     WHERE e.tenant_id = p_tenant_id AND e.subject_ref = p_subject_ref
       AND e.type LIKE 'incident.%'
       AND e.ts BETWEEN p_as_of - INTERVAL '90 days' AND p_as_of;

    SELECT LEAST(100.0, COUNT(*) * 3.0) INTO v_velocity
      FROM public.runtime_events e
     WHERE e.tenant_id = p_tenant_id AND e.subject_ref = p_subject_ref
       AND e.ts BETWEEN p_as_of - INTERVAL '5 minutes' AND p_as_of;

    RETURN QUERY SELECT
        p_subject_ref,
        ( 0.40 * COALESCE(v_consent, 0)
        + 0.40 * COALESCE(v_incident, 0)
        + 0.20 * COALESCE(v_velocity, 0))::numeric(5,2),
        COALESCE(v_consent, 0), COALESCE(v_incident, 0), COALESCE(v_velocity, 0),
        encode(extensions.digest(
            format('subj=%s|v1.0|c=%s|i=%s|v=%s', p_subject_ref,
                COALESCE(v_consent, 0), COALESCE(v_incident, 0),
                COALESCE(v_velocity, 0))::bytea, 'sha256'), 'hex'),
        'subject-risk-v1.0', p_as_of;
END;
$$;

-- Public RPC — membership-gated wrapper.
CREATE OR REPLACE FUNCTION public.compute_subject_risk_score(
    p_tenant_id   UUID,
    p_subject_ref TEXT,
    p_as_of       TIMESTAMPTZ DEFAULT now()
) RETURNS TABLE (
    subject_ref     TEXT,
    risk_score      NUMERIC(5,2),
    consent_signal  NUMERIC(5,2),
    incident_signal NUMERIC(5,2),
    velocity_signal NUMERIC(5,2),
    feature_hash    TEXT,
    model_ref       TEXT,
    computed_at     TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY SELECT * FROM public._compute_subject_risk_score_internal(
        p_tenant_id, p_subject_ref, p_as_of
    );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_tenant_risk_score(UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_subject_risk_score(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._compute_tenant_risk_score_internal(UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._compute_subject_risk_score_internal(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_tenant_risk_score(UUID, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compute_subject_risk_score(UUID, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._compute_tenant_risk_score_internal(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public._compute_subject_risk_score_internal(UUID, TEXT, TIMESTAMPTZ) TO service_role;

-- ============================================================
-- §2.6 — Real-time subject risk recompute trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_event_recompute_subject_risk()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_score NUMERIC(5,2);
    v_prev  NUMERIC(5,2);
BEGIN
    IF NEW.subject_ref IS NULL THEN RETURN NEW; END IF;

    -- Use the internal (no-membership-check) helper — we're already in a
    -- trusted INSERT context with RLS-validated tenant_id.
    SELECT (s).out_risk_score INTO v_score
      FROM public._compute_subject_risk_score_internal(NEW.tenant_id, NEW.subject_ref) s;

    SELECT (payload->>'risk_score')::numeric INTO v_prev
      FROM public.runtime_events
     WHERE tenant_id   = NEW.tenant_id
       AND type        = 'governance.risk_score_changed'
       AND subject_ref = NEW.subject_ref
     ORDER BY tenant_seq DESC LIMIT 1;

    IF v_prev IS NULL OR ABS(v_score - v_prev) >= 10 THEN
        INSERT INTO public.runtime_events
            (tenant_id, type, severity, source, review_status,
             subject_ref, trace_id, causation_id, payload)
        VALUES
            (NEW.tenant_id, 'governance.risk_score_changed',
             CASE WHEN v_score >= 75 THEN 'high'
                  WHEN v_score >= 50 THEN 'medium'
                  ELSE 'low' END,
             'intelligence', 'auto',
             NEW.subject_ref, NEW.trace_id, NEW.id,
             jsonb_build_object(
                'risk_score', v_score,
                'previous',   v_prev,
                'delta',      (v_score - COALESCE(v_prev, 0)),
                'model_ref',  'subject-risk-v1.0'));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS runtime_events_subject_risk ON public.runtime_events;
CREATE TRIGGER runtime_events_subject_risk
    AFTER INSERT ON public.runtime_events
    FOR EACH ROW
    WHEN (NEW.subject_ref IS NOT NULL AND NEW.source <> 'intelligence')
    EXECUTE FUNCTION public.on_event_recompute_subject_risk();

-- ============================================================
-- Part C / §8 — RACPO + §9 Quadrant
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_racpo(
    p_tenant_id UUID,
    p_flow_ref  TEXT,
    p_as_of     TIMESTAMPTZ DEFAULT now()
) RETURNS TABLE (
    raw_cost_per_completed NUMERIC(14,6),
    tenant_risk_score      NUMERIC(5,2),
    incident_pressure      NUMERIC(5,2),
    racpo                  NUMERIC(14,6),
    feature_hash           TEXT,
    model_ref              TEXT,
    computed_at            TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_spend      NUMERIC(14,6);
    v_completed  INT;
    v_raw        NUMERIC(14,6);
    v_risk       NUMERIC(5,2);
    v_pressure   NUMERIC(5,2);
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT SUM(amount_usd)::numeric(14,6)
      INTO v_spend
      FROM public.tenant_cost_ledger
     WHERE tenant_id = p_tenant_id
       AND flow_ref  = p_flow_ref
       AND is_simulated = false AND settled = true
       AND occurred_at >= p_as_of - INTERVAL '7 days';

    SELECT COUNT(*)::int INTO v_completed
      FROM public.runtime_events
     WHERE tenant_id = p_tenant_id
       AND type = 'outcome.completed'
       AND payload->>'flow_ref' = p_flow_ref
       AND ts >= p_as_of - INTERVAL '7 days';

    v_raw := COALESCE(v_spend, 0) / NULLIF(v_completed, 0);

    SELECT (r).tenant_risk_score INTO v_risk
      FROM public.compute_tenant_risk_score(p_tenant_id, p_as_of) r;

    SELECT LEAST(100.0,
              COALESCE(SUM(CASE severity
                    WHEN 'critical' THEN 25
                    WHEN 'high'     THEN 10
                    WHEN 'medium'   THEN 3
                    WHEN 'low'      THEN 1
                    ELSE 0 END), 0))::numeric(5,2)
      INTO v_pressure
      FROM public.runtime_events
     WHERE tenant_id = p_tenant_id
       AND type IN ('incident.opened','policy.violation_detected')
       AND payload->>'flow_ref' = p_flow_ref
       AND ts >= p_as_of - INTERVAL '30 days';

    RETURN QUERY SELECT
        v_raw,
        COALESCE(v_risk, 0),
        COALESCE(v_pressure, 0),
        (COALESCE(v_raw, 0)
            * (1 + COALESCE(v_risk, 0) / 100)
            * (1 + COALESCE(v_pressure, 0) / 100))::numeric(14,6),
        encode(extensions.digest(
            format('%s|%s|risk=%s|press=%s', p_tenant_id, p_flow_ref,
                COALESCE(v_risk, 0), COALESCE(v_pressure, 0))::bytea,
            'sha256'), 'hex'),
        'racpo-v1.0', p_as_of;
END;
$$;

-- Internal — used by emit_quadrant_changes loop. No membership check.
CREATE OR REPLACE FUNCTION public._compute_tenant_quadrant_internal(
    p_tenant_id UUID,
    p_as_of     TIMESTAMPTZ DEFAULT now()
) RETURNS TABLE (
    out_risk_score    NUMERIC(5,2),
    out_spend_90d     NUMERIC(14,6),
    out_median_spend  NUMERIC(14,6),
    out_quadrant      TEXT,
    out_computed_at   TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_risk    NUMERIC(5,2);
    v_spend   NUMERIC(14,6);
    v_median  NUMERIC(14,6);
    v_quad    TEXT;
BEGIN
    SELECT (r).out_tenant_risk_score INTO v_risk
      FROM public._compute_tenant_risk_score_internal(p_tenant_id, p_as_of) r;

    SELECT COALESCE(SUM(amount_usd), 0)::numeric(14,6) INTO v_spend
      FROM public.tenant_cost_ledger
     WHERE tenant_id = p_tenant_id
       AND is_simulated = false AND settled = true
       AND occurred_at >= p_as_of - INTERVAL '90 days';

    SELECT COALESCE(
        percentile_cont(0.5) WITHIN GROUP (ORDER BY t)::numeric(14,6),
        0)
      INTO v_median
      FROM (
          SELECT SUM(amount_usd)::numeric(14,6) AS t
            FROM public.tenant_cost_ledger
           WHERE is_simulated = false AND settled = true
             AND occurred_at >= p_as_of - INTERVAL '90 days'
           GROUP BY tenant_id
      ) all_tenants;

    -- A tenant counts as "cost_high" only if (a) there is meaningful
    -- cohort data (median > 0) and (b) its own spend is strictly above
    -- 1.5× that median. Without (a) we cannot distinguish premium from
    -- baseline, so default to cost_low. Without (b) zero-spend tenants
    -- never trigger premium_review even when the cohort is empty.
    DECLARE
        v_cost_high BOOLEAN := (v_median > 0 AND v_spend > 0
                                AND v_spend >= v_median * 1.5);
    BEGIN
        v_quad := CASE
            WHEN v_risk >= 50 AND v_cost_high       THEN 'red_alert'
            WHEN v_risk >= 50 AND NOT v_cost_high   THEN 'investigate'
            WHEN v_risk <  50 AND v_cost_high       THEN 'premium_review'
            ELSE 'reserved_capacity'
        END;
    END;

    RETURN QUERY SELECT v_risk, v_spend, v_median, v_quad, p_as_of;
END;
$$;

-- Public — membership-gated wrapper.
CREATE OR REPLACE FUNCTION public.compute_tenant_quadrant(
    p_tenant_id UUID,
    p_as_of     TIMESTAMPTZ DEFAULT now()
) RETURNS TABLE (
    risk_score    NUMERIC(5,2),
    spend_90d     NUMERIC(14,6),
    median_spend  NUMERIC(14,6),
    quadrant      TEXT,
    computed_at   TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY SELECT * FROM public._compute_tenant_quadrant_internal(p_tenant_id, p_as_of);
END;
$$;

REVOKE ALL ON FUNCTION public.compute_racpo(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_tenant_quadrant(UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._compute_tenant_quadrant_internal(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_racpo(UUID, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compute_tenant_quadrant(UUID, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._compute_tenant_quadrant_internal(UUID, TIMESTAMPTZ) TO service_role;

-- ============================================================
-- §9 — Quadrant change detector (emits joint.tenant_quadrant_changed)
-- ============================================================
CREATE OR REPLACE FUNCTION public.emit_quadrant_changes()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
    r       RECORD;
    v_prev  TEXT;
    v_cur   TEXT;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    FOR r IN SELECT id AS tenant_id FROM public.tenants LOOP
        SELECT (q).out_quadrant INTO v_cur
          FROM public._compute_tenant_quadrant_internal(r.tenant_id) q;
        IF v_cur IS NULL THEN CONTINUE; END IF;

        SELECT payload->>'current' INTO v_prev
          FROM public.runtime_events
         WHERE tenant_id = r.tenant_id
           AND type = 'joint.tenant_quadrant_changed'
         ORDER BY tenant_seq DESC LIMIT 1;

        IF v_prev IS DISTINCT FROM v_cur THEN
            INSERT INTO public.runtime_events
                (tenant_id, type, severity, source, review_status, payload)
            VALUES (r.tenant_id, 'joint.tenant_quadrant_changed',
                    CASE v_cur WHEN 'red_alert'   THEN 'critical'
                               WHEN 'investigate' THEN 'high'
                               ELSE 'info' END,
                    'joint_intelligence', 'auto',
                    jsonb_build_object('previous', v_prev, 'current', v_cur));
            v_count := v_count + 1;
        END IF;
    END LOOP;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_quadrant_changes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emit_quadrant_changes() TO service_role;

COMMIT;

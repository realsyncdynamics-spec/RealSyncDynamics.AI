-- A3: make the existing cost ledger's LLM reservation RPC race-safe.
-- Source body is unchanged from 20261028170000 except for the
-- transaction-scoped per-tenant advisory lock and fail-closed input guards.
-- No new cap table, plan value, Stripe meter, or ledger mutation.
-- This relies on READ COMMITTED (the default for the Supabase RPC).
-- Non-LLM kinds are explicitly rejected until their separate unit-based
-- budget logic and expiry semantics are audited.
--
-- A2's sweep remains operationally unscheduled; enable its scheduler only
-- through a separately approved operational change.
CREATE OR REPLACE FUNCTION public.cost_check_and_reserve(
    p_tenant_id        UUID,
    p_cost_kind        TEXT,
    p_units_estimate   NUMERIC,
    p_unit_price_usd   NUMERIC,
    p_attribution      JSONB
) RETURNS TABLE (decision TEXT, reservation_id UUID,
                 cap_remaining NUMERIC, cap_used NUMERIC, cap_total NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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

    -- Only the LLM path is safe in this RPC. Other resources have separate
    -- unit-based caps; this function currently sums USD for them and the
    -- A2 sweeper would misclassify their reservations as LLM estimates.
    -- Fail closed rather than silently charging a different dimension.
    IF p_tenant_id IS NULL OR p_cost_kind IS NULL
       OR p_cost_kind NOT IN ('llm_input', 'llm_output') THEN
        RAISE EXCEPTION 'cost_check_and_reserve: unsupported tenant or cost kind'
            USING ERRCODE = '22023';
    END IF;
    IF p_units_estimate IS NULL OR p_unit_price_usd IS NULL
       OR p_units_estimate < 0 OR p_unit_price_usd < 0
       OR p_units_estimate::text IN ('NaN', 'Infinity', '-Infinity')
       OR p_unit_price_usd::text IN ('NaN', 'Infinity', '-Infinity') THEN
        RAISE EXCEPTION 'cost_check_and_reserve: invalid cost estimate'
            USING ERRCODE = '22023';
    END IF;

    -- Transaction-scoped lock, acquired BEFORE reading the budget and
    -- held through INSERT/commit. A concurrent request for this tenant
    -- must wait and then count the preceding committed reservation.
    -- Do NOT replace this with a SELECT FOR UPDATE on tenant_cost_caps:
    -- tenants without an explicit caps row have no row to lock.
    PERFORM pg_advisory_xact_lock(
        hashtextextended('tenant_cost_ledger:llm:' || p_tenant_id::text, 0)
    );

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

    -- Offene Reservierungen zählen für den LLM-Deckel mit (Pkt. 6 oben).
    SELECT COALESCE(SUM(amount_usd), 0) INTO v_used
      FROM public.tenant_cost_ledger
     WHERE tenant_id = p_tenant_id
       AND (
            cost_kind = ANY(CASE
              WHEN p_cost_kind IN ('llm_input','llm_output')
                  THEN ARRAY['llm_input','llm_output','llm_estimate']
              ELSE ARRAY[p_cost_kind] END)
         OR (p_cost_kind IN ('llm_input','llm_output')
             AND cost_kind = 'reservation' AND settled = false)
       )
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

REVOKE ALL ON FUNCTION public.cost_check_and_reserve(UUID,TEXT,NUMERIC,NUMERIC,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cost_check_and_reserve(UUID,TEXT,NUMERIC,NUMERIC,JSONB) TO service_role;

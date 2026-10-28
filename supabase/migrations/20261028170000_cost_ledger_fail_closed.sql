-- PR A2 — fix/cost-ledger-fail-closed
-- Grundlagen: claude/auftrag-pr-a2-cost-ledger-fail-closed-2026-10-28.md (2. Stand),
--             Nachtrag Blocker 3 (3. Stand) §3 Pkt. 7, Abnahme 21/35/36.
--
-- ADDITIV. Keine bestehende Zeile wird umgeschrieben oder gelöscht.
--
-- 1. Neue Spalten value_basis ('gemessen' | 'geschaetzt' | 'korrigiert')
--    und corrects_id. Ohne Default: Bestandszeilen bleiben NULL
--    (= vor A2 geschrieben; Bedeutung wie bisher aus cost_kind/settled).
-- 2. Neuer cost_kind 'llm_estimate' für geschätzt verbuchten LLM-Verbrauch.
--    count_ai_tokens_by_tenant (Stripe-Token-Metering) filtert auf
--    cost_kind IN ('llm_input','llm_output') und liest diese Zeilen daher
--    nachweislich nicht (Abnahme 36). stripe-token-meter-sync bleibt unverändert.
-- 3. cost_check_and_reserve zählt 'llm_estimate' gegen den LLM-Deckel.
--    Sonst wäre die geschätzte Verbuchung budgetseitig wirkungslos.
-- 4. cost_sweep_expired_reservations löscht nicht mehr, sondern verbucht
--    abgelaufene, nicht abgerechnete Reservierungen zum reservierten
--    Höchstbetrag als 'llm_estimate' / 'geschaetzt'. Idempotent.
-- 5. cost_writer_settle: Kommt die echte Abrechnung nach einer geschätzten
--    Verbuchung, entstehen zwei NEUE Zeilen mit corrects_id:
--      a) Storno der Schätzung (llm_estimate, negative units, 'korrigiert')
--      b) gemessener Verbrauch (p_cost_kind, 'korrigiert')
--    Summe = gemessener Wert, keine Doppelzählung. Ein zweiter Settle
--    auf dieselbe Reservierung schlägt weiterhin fehl.
--
-- Nicht enthalten: Scheduler für den Sweep (es existiert keiner; Einplanung
-- ist eine eigene Entscheidung), Zählung offener Reservierungen im Deckel
-- (A3 zieht die Budgetprüfung auf bot_usage_* um), Stripe, Preise, Entitlements.

ALTER TABLE public.tenant_cost_ledger
    ADD COLUMN IF NOT EXISTS value_basis TEXT,
    ADD COLUMN IF NOT EXISTS corrects_id BIGINT
        REFERENCES public.tenant_cost_ledger(id);

ALTER TABLE public.tenant_cost_ledger
    DROP CONSTRAINT IF EXISTS tenant_cost_ledger_value_basis_check;
ALTER TABLE public.tenant_cost_ledger
    ADD CONSTRAINT tenant_cost_ledger_value_basis_check CHECK (
        value_basis IS NULL
        OR value_basis IN ('gemessen', 'geschaetzt', 'korrigiert')
    );

COMMENT ON COLUMN public.tenant_cost_ledger.value_basis IS
    'gemessen | geschaetzt | korrigiert. NULL = Zeile vor PR A2 oder offene '
    'Reservierung. geschaetzt wird nie an Stripe gemeldet (cost_kind llm_estimate).';
COMMENT ON COLUMN public.tenant_cost_ledger.corrects_id IS
    'Bei value_basis=korrigiert: id der korrigierten (geschätzten) Zeile.';

CREATE INDEX IF NOT EXISTS tenant_cost_ledger_corrects_idx
    ON public.tenant_cost_ledger (corrects_id) WHERE corrects_id IS NOT NULL;

-- cost_kind-Whitelist additiv erweitern (Muster 20260608100000).
ALTER TABLE public.tenant_cost_ledger
    DROP CONSTRAINT IF EXISTS tenant_cost_ledger_cost_kind_check;
ALTER TABLE public.tenant_cost_ledger
    ADD CONSTRAINT tenant_cost_ledger_cost_kind_check CHECK (
        cost_kind IN (
            'llm_input', 'llm_output', 'llm_estimate',
            'storage_gb_hour', 'edge_invocation',
            'webhook_egress', 'replay_simulation', 'reservation'
        )
    );

-- Produktion hat genau eine cost_kind-CHECK (tenant_cost_ledger_cost_kind_check,
-- geprüft 28.10.2026 lesend); sie wird oben durch dieselbe Liste plus
-- 'llm_estimate' ersetzt. Keine weitere Erweiterung.

-- ------------------------------------------------------------
-- 3. Reserve: 'llm_estimate' zählt gegen den LLM-Deckel.
--    Body unverändert aus 20260604000000, nur das ARRAY erweitert.
-- ------------------------------------------------------------
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
                  THEN ARRAY['llm_input','llm_output','llm_estimate']
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

-- ------------------------------------------------------------
-- 4. Sweep: verbuchen statt löschen.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cost_sweep_expired_reservations()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_count INT;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    WITH expired AS (
        UPDATE public.tenant_cost_ledger
           SET cost_kind   = 'llm_estimate',
               value_basis = 'geschaetzt',
               settled     = true,
               settled_at  = now(),
               expires_at  = NULL
         WHERE cost_kind = 'reservation'
           AND settled = false
           AND expires_at < now()
     RETURNING tenant_id, reservation_id, amount_usd
    )
    INSERT INTO public.runtime_events
        (tenant_id, type, severity, source, review_status, payload)
    SELECT e.tenant_id, 'cost.reservation_expired', 'low',
           'economic_control', 'auto',
           jsonb_build_object('reservation_id', e.reservation_id,
                              'booked_as', 'geschaetzt',
                              'amount_usd', e.amount_usd)
      FROM expired e;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ------------------------------------------------------------
-- 5. Settle: gemessen, oder Korrektur nach geschätzter Verbuchung.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cost_writer_settle(
    p_reservation_id   UUID,
    p_cost_kind        TEXT,
    p_units_actual     NUMERIC,
    p_unit_price_usd   NUMERIC
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_id  BIGINT;
    v_est public.tenant_cost_ledger%ROWTYPE;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    UPDATE public.tenant_cost_ledger
       SET cost_kind      = p_cost_kind,
           units          = p_units_actual,
           unit_price_usd = p_unit_price_usd,
           value_basis    = 'gemessen',
           settled        = true,
           settled_at     = now(),
           expires_at     = NULL
     WHERE reservation_id = p_reservation_id
       AND settled        = false
     RETURNING id INTO v_id;

    IF v_id IS NOT NULL THEN
        RETURN v_id;
    END IF;

    -- Bereits geschätzt verbucht und noch nicht korrigiert?
    SELECT * INTO v_est
      FROM public.tenant_cost_ledger l
     WHERE l.reservation_id = p_reservation_id
       AND l.cost_kind      = 'llm_estimate'
       AND l.value_basis    = 'geschaetzt'
       AND NOT EXISTS (SELECT 1 FROM public.tenant_cost_ledger c
                        WHERE c.corrects_id = l.id)
     FOR UPDATE;

    IF v_est.id IS NULL THEN
        RAISE EXCEPTION 'reservation % not found or already settled', p_reservation_id
            USING ERRCODE = 'no_data_found';
    END IF;

    -- a) Storno der Schätzung
    INSERT INTO public.tenant_cost_ledger
        (tenant_id, cost_kind, units, unit_price_usd,
         agent_ref, flow_ref, trace_id, causation_event,
         reservation_id, settled, settled_at, value_basis, corrects_id)
    VALUES (v_est.tenant_id, 'llm_estimate', -v_est.units, v_est.unit_price_usd,
            v_est.agent_ref, v_est.flow_ref, v_est.trace_id, v_est.causation_event,
            p_reservation_id, true, now(), 'korrigiert', v_est.id);

    -- b) gemessener Verbrauch
    INSERT INTO public.tenant_cost_ledger
        (tenant_id, cost_kind, units, unit_price_usd,
         agent_ref, flow_ref, trace_id, causation_event,
         reservation_id, settled, settled_at, value_basis, corrects_id)
    VALUES (v_est.tenant_id, p_cost_kind, p_units_actual, p_unit_price_usd,
            v_est.agent_ref, v_est.flow_ref, v_est.trace_id, v_est.causation_event,
            p_reservation_id, true, now(), 'korrigiert', v_est.id)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cost_check_and_reserve(UUID,TEXT,NUMERIC,NUMERIC,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cost_writer_settle(UUID,TEXT,NUMERIC,NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cost_sweep_expired_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cost_check_and_reserve(UUID,TEXT,NUMERIC,NUMERIC,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.cost_writer_settle(UUID,TEXT,NUMERIC,NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.cost_sweep_expired_reservations() TO service_role;

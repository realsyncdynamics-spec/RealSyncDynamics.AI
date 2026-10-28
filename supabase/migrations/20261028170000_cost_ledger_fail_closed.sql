-- PR A2 fix/cost-ledger-fail-closed — Altledger gibt Budget nicht mehr ohne Nachweis frei
--
-- Befund (Bestandsaufnahme 28.10.2026):
--   1. cost_sweep_expired_reservations() LOESCHT abgelaufene, nicht
--      abgerechnete Reservierungen. Ob beim Anbieter Kosten entstanden sind,
--      ist dann nicht mehr nachvollziehbar.
--   2. cost_check_and_reserve() zaehlt nur abgerechnete llm_input/llm_output-
--      Zeilen. Offene Reservierungen (cost_kind='reservation') belasten den
--      Kostendeckel nicht.
--   3. count_ai_tokens_by_tenant() (Leser von stripe-token-meter-sync) summiert
--      units aller llm_input/llm_output-Zeilen ohne Statusunterscheidung. Eine
--      Schaetzung unter llm_input wuerde an Stripe gemeldet.
--
-- Regel (Owner-Entscheid, Budget-Regel bei Fehlern): Freigabe nur bei
-- nachweislich nicht entstandenem Verbrauch. Unklarer Verbrauch wird intern
-- zum reservierten Hoechstbetrag als „geschaetzt" angerechnet, nicht
-- automatisch fakturiert. Korrekturen als neue Eintraege mit Bezug, ohne
-- Doppelzaehlung.
--
-- Umsetzung (ADDITIV, keine bestehende Zeile wird umgeschrieben):
--   * Spalte consumption_status gemessen/geschaetzt/korrigiert (Default
--     'gemessen' beschreibt alle bisherigen abgerechneten Zeilen korrekt; fuer
--     offene Reservierungen hat der Wert erst nach Abschluss Bedeutung).
--   * Spalte corrects_id — Bezug einer Korrektur auf die geschaetzte Zeile.
--   * Neue Kostenart 'llm_estimated'. Sie liegt bewusst AUSSERHALB von
--     ('llm_input','llm_output'): count_ai_tokens_by_tenant, ai_token_daily_totals
--     und die Token-Spalten der MVs lesen sie nicht. Damit erreicht eine
--     Schaetzung keinen Abrechnungspfad (Abnahme 13/36).
--   * Sweep: verbucht statt zu loeschen (Hoechstbetrag, 'geschaetzt').
--   * Settle nach Sweep: zwei neue Zeilen 'korrigiert' — Storno der Schaetzung
--     (llm_estimated, units negativ) und gemessener Verbrauch (llm_input).
--     Summe = gemessener Wert; hoechstens eine Korrektur je Schaetzung.
--   * Kostendeckel: zaehlt offene Reservierungen und llm_estimated mit.
--     Das verschaerft nur — Budgetwerte (Default 250 USD, tenant_cost_caps)
--     bleiben unveraendert.
--
-- Nicht enthalten: Cron-Job fuer den Sweep (in Produktion nicht eingeplant,
-- bleibt unveraendert), Umzug auf bot_usage_* (A3), Aenderungen an
-- stripe-token-meter-sync, count_ai_tokens_by_tenant, Preisen, Entitlements.

-- ── 1. Spalten ──────────────────────────────────────────────────────────────
ALTER TABLE public.tenant_cost_ledger
    ADD COLUMN IF NOT EXISTS consumption_status TEXT NOT NULL DEFAULT 'gemessen',
    ADD COLUMN IF NOT EXISTS corrects_id        BIGINT
        REFERENCES public.tenant_cost_ledger(id);

ALTER TABLE public.tenant_cost_ledger
    DROP CONSTRAINT IF EXISTS tenant_cost_ledger_consumption_status_check;
ALTER TABLE public.tenant_cost_ledger
    ADD CONSTRAINT tenant_cost_ledger_consumption_status_check CHECK (
        consumption_status IN ('gemessen', 'geschaetzt', 'korrigiert')
    );

-- Eine Korrektur verweist immer auf eine Zeile und traegt den Status 'korrigiert'.
ALTER TABLE public.tenant_cost_ledger
    DROP CONSTRAINT IF EXISTS tenant_cost_ledger_correction_ref_check;
ALTER TABLE public.tenant_cost_ledger
    ADD CONSTRAINT tenant_cost_ledger_correction_ref_check CHECK (
        (corrects_id IS NULL) = (consumption_status <> 'korrigiert')
    );

COMMENT ON COLUMN public.tenant_cost_ledger.consumption_status IS
    'gemessen = aus Anbieterdaten abgerechnet; geschaetzt = unklarer Verbrauch zum '
    'reservierten Hoechstbetrag (nur interne Budgetkontrolle, nie fakturiert); '
    'korrigiert = neuer Eintrag mit corrects_id, der eine Schaetzung ersetzt. '
    'Fuer offene Reservierungen (settled=false) erst nach Abschluss aussagekraeftig.';
COMMENT ON COLUMN public.tenant_cost_ledger.corrects_id IS
    'Bezug einer Korrektur (consumption_status=korrigiert) auf die geschaetzte Zeile.';

-- ── 2. Kostenart llm_estimated (CHECK additiv erweitert) ────────────────────
ALTER TABLE public.tenant_cost_ledger
    DROP CONSTRAINT IF EXISTS tenant_cost_ledger_cost_kind_check;
ALTER TABLE public.tenant_cost_ledger
    ADD CONSTRAINT tenant_cost_ledger_cost_kind_check CHECK (
        cost_kind IN (
            'llm_input', 'llm_output',
            'storage_gb_hour', 'edge_invocation',
            'webhook_egress', 'replay_simulation',
            'reservation', 'llm_estimated'
        )
    );

COMMENT ON COLUMN public.tenant_cost_ledger.cost_kind IS
    'Cost dimension. ''reservation'' = offene Reservierung aus cost_check_and_reserve. '
    '''llm_estimated'' = vom Sweep geschaetzt verbuchte Reservierung bzw. deren Storno; '
    'zaehlt fuer den Kostendeckel, nie fuer Token-Metering/Stripe.';

-- Hoechstens ein Storno je geschaetzter Zeile (auch bei parallelem Settle).
CREATE UNIQUE INDEX IF NOT EXISTS tenant_cost_ledger_one_correction_idx
    ON public.tenant_cost_ledger (corrects_id)
    WHERE corrects_id IS NOT NULL AND cost_kind = 'llm_estimated';

CREATE INDEX IF NOT EXISTS tenant_cost_ledger_reservation_idx
    ON public.tenant_cost_ledger (reservation_id)
    WHERE reservation_id IS NOT NULL;

-- ── 3. Kostendeckel: offene Reservierungen und Schaetzungen zaehlen mit ─────
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
    v_llm    BOOLEAN := p_cost_kind IN ('llm_input', 'llm_output');
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

    -- A2: Fuer den LLM-Deckel zaehlen neben abgerechneten Zeilen auch
    -- geschaetzte Zeilen (inkl. Storno) und noch offene Reservierungen —
    -- unklarer Verbrauch belastet das Budget, bis er nachweislich geklaert ist.
    SELECT COALESCE(SUM(l.amount_usd), 0) INTO v_used
      FROM public.tenant_cost_ledger l
     WHERE l.tenant_id = p_tenant_id
       AND l.is_simulated = false
       AND l.occurred_at >= DATE_TRUNC('month', now())
       AND (
            (v_llm AND l.cost_kind IN ('llm_input', 'llm_output', 'llm_estimated'))
         OR (v_llm AND l.cost_kind = 'reservation' AND l.settled = false)
         OR (NOT v_llm AND l.cost_kind = p_cost_kind)
       );

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

-- ── 4. Sweep: verbuchen statt loeschen ──────────────────────────────────────
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
    -- Ob beim Anbieter Kosten entstanden sind, ist unbekannt: zum reservierten
    -- Hoechstbetrag (units/unit_price bleiben) als 'geschaetzt' verbuchen.
    -- Idempotent: ein zweiter Lauf findet keine offene Zeile mehr.
    WITH estimated AS (
        UPDATE public.tenant_cost_ledger
           SET cost_kind          = 'llm_estimated',
               consumption_status = 'geschaetzt',
               settled            = true,
               settled_at         = now(),
               expires_at         = NULL
         WHERE settled = false
           AND cost_kind = 'reservation'
           AND expires_at < now()
     RETURNING tenant_id, reservation_id, amount_usd
    )
    INSERT INTO public.runtime_events
        (tenant_id, type, severity, source, review_status, payload)
    SELECT e.tenant_id, 'cost.reservation_expired', 'low',
           'economic_control', 'auto',
           jsonb_build_object('reservation_id', e.reservation_id,
                              'booked_as', 'geschaetzt',
                              'estimated_usd', e.amount_usd)
      FROM estimated e;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ── 5. Settle: auch nach Sweep, als Korrektur ohne Doppelzaehlung ───────────
CREATE OR REPLACE FUNCTION public.cost_writer_settle(
    p_reservation_id   UUID,
    p_cost_kind        TEXT,
    p_units_actual     NUMERIC,
    p_unit_price_usd   NUMERIC
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id  BIGINT;
    v_est public.tenant_cost_ledger%ROWTYPE;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    -- Regelfall: offene Reservierung wird zur gemessenen Zeile.
    UPDATE public.tenant_cost_ledger
       SET cost_kind          = p_cost_kind,
           units              = p_units_actual,
           unit_price_usd     = p_unit_price_usd,
           consumption_status = 'gemessen',
           settled            = true,
           settled_at         = now(),
           expires_at         = NULL
     WHERE reservation_id = p_reservation_id
       AND settled        = false
     RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN
        RETURN v_id;
    END IF;

    -- Reservierung wurde bereits vom Sweep geschaetzt verbucht: die Schaetzung
    -- bleibt unveraendert; zwei neue Eintraege ersetzen sie (Summe = gemessen).
    SELECT * INTO v_est
      FROM public.tenant_cost_ledger
     WHERE reservation_id     = p_reservation_id
       AND cost_kind          = 'llm_estimated'
       AND consumption_status = 'geschaetzt'
     FOR UPDATE;
    IF v_est.id IS NULL THEN
        RAISE EXCEPTION 'reservation % not found or already settled', p_reservation_id
            USING ERRCODE = 'no_data_found';
    END IF;

    BEGIN
        INSERT INTO public.tenant_cost_ledger
            (tenant_id, cost_kind, units, unit_price_usd,
             agent_ref, flow_ref, trace_id, causation_event,
             reservation_id, settled, settled_at,
             consumption_status, corrects_id)
        VALUES (v_est.tenant_id, 'llm_estimated', -v_est.units, v_est.unit_price_usd,
                v_est.agent_ref, v_est.flow_ref, v_est.trace_id, v_est.causation_event,
                p_reservation_id, true, now(),
                'korrigiert', v_est.id);
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'reservation % not found or already settled', p_reservation_id
            USING ERRCODE = 'no_data_found';
    END;

    INSERT INTO public.tenant_cost_ledger
        (tenant_id, cost_kind, units, unit_price_usd,
         agent_ref, flow_ref, trace_id, causation_event,
         reservation_id, settled, settled_at,
         consumption_status, corrects_id)
    VALUES (v_est.tenant_id, p_cost_kind, p_units_actual, p_unit_price_usd,
            v_est.agent_ref, v_est.flow_ref, v_est.trace_id, v_est.causation_event,
            p_reservation_id, true, now(),
            'korrigiert', v_est.id)
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

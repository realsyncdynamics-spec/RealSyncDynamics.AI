# RFC-005 — Economic Control & Cost Attribution v1.0

**Status:** Draft v1.0 — Policy, Semantics, SQL artefacts
**Owner:** Governance Runtime
**Created:** 2026-05-21
**Companion to:** SPEC-001 (`runtime_events`), Kernel-RFC §P4,
RFC-003 (Memory Policy), RFC-004 (Intelligence Kernel)

**Scope:** Konkretes Modell für Cost-Ledger, Hard-Caps, Unit Economics
und Cost-Attribution-Algebra mit Propagation durch die causation-DAG.
Liefert Materialized Views, Stored Procedures, RPCs, RLS-Verträge.

---

## §1 Zielbild

Vier zusammenhängende Strukturen:

1. **`tenant_cost_ledger`** als Single-Source-of-Truth für jeden
   verbrauchten Resource-Unit.
2. **MV-Aggregate** für per-Tenant / per-Feature / per-Agent / 7-30-90d.
3. **`tenant_cost_caps`** + Enforcement-RPC mit Backpressure
   (kein Hard-Kill).
4. **Unit-Economics-Views** für „Cost per Outcome" / „wer subventioniert wen".

---

## §2 Cost Domains & Schema

### §2.1 Schema-Konsolidierung (aus Kernel-RFC §P4.2)

```sql
CREATE TABLE IF NOT EXISTS public.tenant_cost_ledger (
    id               BIGSERIAL    PRIMARY KEY,
    tenant_id        UUID         NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    occurred_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    -- Attribution (mindestens eines MUSS gesetzt sein — App-Layer-Enforcement)
    agent_ref        TEXT,
    flow_ref         TEXT,
    trace_id         UUID,
    correlation_id   UUID,
    causation_event  UUID,             -- runtime_events.id, falls applicable

    -- Cost dimension
    cost_kind        TEXT         NOT NULL CHECK (cost_kind IN (
                       'llm_input','llm_output','storage_gb_hour',
                       'edge_invocation','webhook_egress','memory_byte_hour',
                       'incident_cost','replay_simulation','reservation'
                     )),
    units            NUMERIC(18,6) NOT NULL,
    unit_price_usd   NUMERIC(12,8) NOT NULL,
    amount_usd       NUMERIC(14,6) NOT NULL GENERATED ALWAYS AS
                       (units * unit_price_usd) STORED,
    vendor           TEXT,
    model_ref        TEXT,

    -- Replay isolation
    is_simulated     BOOLEAN      NOT NULL DEFAULT false,
    replay_run_id    UUID,

    -- Reservation lifecycle (Pre-Check / Settlement)
    reservation_id   UUID,
    settled          BOOLEAN      NOT NULL DEFAULT true,
    settled_at       TIMESTAMPTZ,
    expires_at       TIMESTAMPTZ,        -- für ungesettelte Reservations

    raw_metadata     JSONB        NOT NULL DEFAULT '{}'::jsonb,

    -- Hard rule: at least one attribution axis
    CONSTRAINT cost_ledger_has_attribution CHECK (
        agent_ref IS NOT NULL
        OR flow_ref IS NOT NULL
        OR trace_id IS NOT NULL
    ),
    -- Hard rule: simulated rows must reference a replay_run_id
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
    ON public.tenant_cost_ledger (expires_at)
    WHERE settled = false;
CREATE INDEX IF NOT EXISTS tenant_cost_ledger_simulated_idx
    ON public.tenant_cost_ledger (replay_run_id)
    WHERE is_simulated = true;

ALTER TABLE public.tenant_cost_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_cost_ledger tenant-read" ON public.tenant_cost_ledger;
CREATE POLICY "tenant_cost_ledger tenant-read"
    ON public.tenant_cost_ledger FOR SELECT
    USING (public.has_tenant_membership(tenant_id));

-- INSERTs nur durch service-role (bypasst RLS); UPDATE/DELETE blockiert.
DROP POLICY IF EXISTS "tenant_cost_ledger deny-writes" ON public.tenant_cost_ledger;
CREATE POLICY "tenant_cost_ledger deny-writes"
    ON public.tenant_cost_ledger FOR INSERT
    WITH CHECK (false);
```

### §2.2 Cost-Caps-Tabelle

```sql
CREATE TABLE IF NOT EXISTS public.tenant_cost_caps (
    tenant_id           UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    -- monatliche Caps
    llm_tokens_monthly  BIGINT       NOT NULL DEFAULT 5000000,
    llm_usd_monthly     NUMERIC(10,2) NOT NULL DEFAULT 250.00,
    storage_gb_hours    NUMERIC(12,2) NOT NULL DEFAULT 1000,
    edge_invocations    BIGINT       NOT NULL DEFAULT 1000000,
    replay_simulations  INT          NOT NULL DEFAULT 100,
    memory_per_subject  BIGINT       NOT NULL DEFAULT 10000,
    -- Backpressure-Schwelle (Anteil des Caps, ab dem wir warned)
    warn_threshold      NUMERIC(3,2) NOT NULL DEFAULT 0.80,
    -- Override / Trial-Flags
    override_until      TIMESTAMPTZ,
    notes               TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_cost_caps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_cost_caps tenant-read" ON public.tenant_cost_caps;
CREATE POLICY "tenant_cost_caps tenant-read"
    ON public.tenant_cost_caps FOR SELECT
    USING (public.has_tenant_membership(tenant_id));

DROP POLICY IF EXISTS "tenant_cost_caps deny-writes" ON public.tenant_cost_caps;
CREATE POLICY "tenant_cost_caps deny-writes"
    ON public.tenant_cost_caps FOR ALL
    USING (false) WITH CHECK (false);
```

---

## §3 Materialized Views (Aggregation)

### §3.1 Per-Tenant Cost Breakdown (rolling 7d / 30d / 90d)

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_cost_per_tenant AS
SELECT
    l.tenant_id,
    -- 7d
    SUM(units)         FILTER (WHERE cost_kind = 'llm_input'   AND occurred_at >= now() - INTERVAL '7 days') AS tokens_in_7d,
    SUM(units)         FILTER (WHERE cost_kind = 'llm_output'  AND occurred_at >= now() - INTERVAL '7 days') AS tokens_out_7d,
    SUM(amount_usd)    FILTER (WHERE cost_kind IN ('llm_input','llm_output') AND occurred_at >= now() - INTERVAL '7 days') AS llm_usd_7d,
    SUM(amount_usd)    FILTER (WHERE cost_kind = 'storage_gb_hour'  AND occurred_at >= now() - INTERVAL '7 days') AS storage_usd_7d,
    SUM(amount_usd)    FILTER (WHERE cost_kind = 'memory_byte_hour' AND occurred_at >= now() - INTERVAL '7 days') AS memory_usd_7d,
    SUM(amount_usd)    FILTER (WHERE cost_kind = 'incident_cost'    AND occurred_at >= now() - INTERVAL '7 days') AS incident_usd_7d,
    -- 30d
    SUM(units)         FILTER (WHERE cost_kind = 'llm_input'   AND occurred_at >= now() - INTERVAL '30 days') AS tokens_in_30d,
    SUM(units)         FILTER (WHERE cost_kind = 'llm_output'  AND occurred_at >= now() - INTERVAL '30 days') AS tokens_out_30d,
    SUM(amount_usd)    FILTER (WHERE cost_kind IN ('llm_input','llm_output') AND occurred_at >= now() - INTERVAL '30 days') AS llm_usd_30d,
    -- 90d
    SUM(amount_usd)    FILTER (WHERE occurred_at >= now() - INTERVAL '90 days') AS total_usd_90d,
    now()              AS computed_at
  FROM public.tenant_cost_ledger l
 WHERE is_simulated = false
   AND settled = true
 GROUP BY l.tenant_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_cost_per_tenant_pk
    ON public.mv_cost_per_tenant (tenant_id);
```

### §3.2 Per-Feature Cost Breakdown

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_cost_per_feature AS
SELECT
    tenant_id,
    flow_ref,
    cost_kind,
    SUM(units)        AS units_30d,
    SUM(amount_usd)   AS amount_usd_30d,
    COUNT(DISTINCT trace_id) AS distinct_traces_30d,
    now()             AS computed_at
  FROM public.tenant_cost_ledger
 WHERE is_simulated = false AND settled = true
   AND occurred_at >= now() - INTERVAL '30 days'
   AND flow_ref IS NOT NULL
 GROUP BY tenant_id, flow_ref, cost_kind;

CREATE UNIQUE INDEX IF NOT EXISTS mv_cost_per_feature_pk
    ON public.mv_cost_per_feature (tenant_id, flow_ref, cost_kind);
```

### §3.3 Per-Agent Cost Attribution

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_cost_per_agent AS
SELECT
    tenant_id,
    agent_ref,
    SUM(amount_usd)               AS amount_usd_30d,
    SUM(amount_usd) / 30.0        AS amount_usd_daily_avg,
    COUNT(DISTINCT trace_id)      AS distinct_traces_30d,
    SUM(units) FILTER (WHERE cost_kind = 'llm_input')  AS tokens_in_30d,
    SUM(units) FILTER (WHERE cost_kind = 'llm_output') AS tokens_out_30d,
    now()                         AS computed_at
  FROM public.tenant_cost_ledger
 WHERE is_simulated = false AND settled = true
   AND occurred_at >= now() - INTERVAL '30 days'
   AND agent_ref IS NOT NULL
 GROUP BY tenant_id, agent_ref;

CREATE UNIQUE INDEX IF NOT EXISTS mv_cost_per_agent_pk
    ON public.mv_cost_per_agent (tenant_id, agent_ref);
```

---

## §4 Cost Attribution Algebra

### §4.1 Vertrag

Jedes `runtime_event`, das eine Cost-Quelle anstößt, schreibt
**zusätzlich** ein `cost_units`-JSONB-Snapshot in `payload`. Das ist das
**propagierende** Cost-Signal entlang der causation-DAG:

```json
{
  "cost_units": {
    "token_cost":    0.0420,
    "storage_cost":  0.0000,
    "incident_cost": 0.0000,
    "memory_cost":   0.0002,
    "total":         0.0422
  }
}
```

### §4.2 Propagationsregel

Ein nachgelagertes Event akkumuliert `cost_units` aller Vorfahren:

```text
event_X.cost_units = event_X.intrinsic_cost
                   + sum(parent.cost_units for parent in causation-DAG path)
```

Damit hat jedes Event eine **Gesamtkostenzuordnung bis zu sich selbst**.
Idempotenz: wenn dasselbe Event reprozessiert wird (selber `id`), wird der
Wert nicht doppelt addiert — Schutz über `supersedes_id` aus RFC-003.

### §4.3 SQL — Propagations-RPC

```sql
CREATE OR REPLACE FUNCTION public.propagate_cost_attribution(
    p_tenant_id   UUID,
    p_root_event  UUID
) RETURNS TABLE (
    event_id     UUID,
    depth        INT,
    intrinsic    NUMERIC(14,6),
    accumulated  NUMERIC(14,6)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH RECURSIVE walk(event_id, depth, intrinsic, accumulated) AS (
        SELECT
            e.id,
            0,
            COALESCE((e.payload->'cost_units'->>'total')::numeric, 0),
            COALESCE((e.payload->'cost_units'->>'total')::numeric, 0)
          FROM public.runtime_events e
         WHERE e.id = p_root_event
           AND e.tenant_id = p_tenant_id
        UNION ALL
        SELECT
            e.id,
            w.depth + 1,
            COALESCE((e.payload->'cost_units'->>'total')::numeric, 0),
            w.accumulated + COALESCE((e.payload->'cost_units'->>'total')::numeric, 0)
          FROM public.runtime_events e
          JOIN walk w ON e.causation_id = w.event_id
         WHERE w.depth < 64
           AND e.tenant_id = p_tenant_id
    )
    SELECT * FROM walk;
END;
$$;

REVOKE ALL ON FUNCTION public.propagate_cost_attribution(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propagate_cost_attribution(UUID, UUID)
    TO authenticated, service_role;
```

### §4.4 Cost-Writer (mit Cap-Check)

```sql
CREATE OR REPLACE FUNCTION public.cost_writer_settle(
    p_tenant_id        UUID,
    p_cost_kind        TEXT,
    p_units            NUMERIC,
    p_unit_price_usd   NUMERIC,
    p_attribution      JSONB,        -- {agent_ref, flow_ref, trace_id, causation_event}
    p_vendor           TEXT DEFAULT NULL,
    p_model_ref        TEXT DEFAULT NULL,
    p_reservation_id   UUID DEFAULT NULL,
    p_is_simulated     BOOLEAN DEFAULT false,
    p_replay_run_id    UUID DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id BIGINT;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    -- Reservation finalisieren, wenn p_reservation_id gesetzt ist
    IF p_reservation_id IS NOT NULL THEN
        UPDATE public.tenant_cost_ledger
           SET settled    = true,
               settled_at = now(),
               units      = p_units,
               unit_price_usd = p_unit_price_usd
         WHERE reservation_id = p_reservation_id
         RETURNING id INTO v_id;
        IF v_id IS NULL THEN
            RAISE EXCEPTION 'reservation % not found', p_reservation_id;
        END IF;
        RETURN v_id;
    END IF;

    INSERT INTO public.tenant_cost_ledger
        (tenant_id, cost_kind, units, unit_price_usd,
         agent_ref, flow_ref, trace_id, causation_event,
         vendor, model_ref,
         is_simulated, replay_run_id,
         settled, settled_at)
    VALUES
        (p_tenant_id, p_cost_kind, p_units, p_unit_price_usd,
         p_attribution->>'agent_ref',
         p_attribution->>'flow_ref',
         (p_attribution->>'trace_id')::uuid,
         (p_attribution->>'causation_event')::uuid,
         p_vendor, p_model_ref,
         p_is_simulated, p_replay_run_id,
         true, now())
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;
```

---

## §5 Hard Caps Enforcement

### §5.1 Pre-Check + Reservation

```sql
CREATE OR REPLACE FUNCTION public.cost_check_and_reserve(
    p_tenant_id        UUID,
    p_cost_kind        TEXT,
    p_units_estimate   NUMERIC,
    p_unit_price_usd   NUMERIC,
    p_attribution      JSONB
) RETURNS TABLE (
    decision        TEXT,           -- 'allow' | 'warn' | 'throttle'
    reservation_id  UUID,
    cap_remaining   NUMERIC,
    cap_used        NUMERIC,
    cap_total       NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caps         public.tenant_cost_caps%ROWTYPE;
    v_used         NUMERIC;
    v_estimate     NUMERIC := p_units_estimate * p_unit_price_usd;
    v_cap_total    NUMERIC;
    v_remaining    NUMERIC;
    v_reservation  UUID    := gen_random_uuid();
    v_decision     TEXT;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_caps FROM public.tenant_cost_caps WHERE tenant_id = p_tenant_id;
    IF v_caps.tenant_id IS NULL THEN
        -- Default-Caps falls keine Override
        v_caps := ROW(p_tenant_id, 5000000, 250.00, 1000, 1000000, 100, 10000, 0.80, NULL, NULL, now());
    END IF;

    -- Wählt das relevante Limit basierend auf cost_kind
    v_cap_total := CASE
        WHEN p_cost_kind IN ('llm_input','llm_output') THEN v_caps.llm_usd_monthly
        WHEN p_cost_kind = 'replay_simulation'         THEN v_caps.replay_simulations::numeric
        WHEN p_cost_kind = 'edge_invocation'           THEN v_caps.edge_invocations::numeric
        WHEN p_cost_kind = 'storage_gb_hour'           THEN v_caps.storage_gb_hours
        ELSE 1e12
    END;

    -- Aktueller Monats-Verbrauch (settled + reservations)
    SELECT COALESCE(SUM(amount_usd), 0) INTO v_used
      FROM public.tenant_cost_ledger
     WHERE tenant_id = p_tenant_id
       AND cost_kind = ANY(CASE
              WHEN p_cost_kind IN ('llm_input','llm_output') THEN ARRAY['llm_input','llm_output']
              ELSE ARRAY[p_cost_kind]
           END)
       AND is_simulated = false
       AND occurred_at >= DATE_TRUNC('month', now());

    v_remaining := v_cap_total - v_used;

    IF v_used + v_estimate > v_cap_total THEN
        -- Backpressure, nicht Hard-Kill
        v_decision := 'throttle';
        -- Audit-Event vermerkt die Blockade
        INSERT INTO public.runtime_events
            (tenant_id, type, severity, source, review_status, payload)
        VALUES
            (p_tenant_id, 'cost.cap_violation_blocked', 'critical',
             'economic_control', 'auto',
             jsonb_build_object(
                 'cost_kind',     p_cost_kind,
                 'estimate_usd',  v_estimate,
                 'cap_remaining', v_remaining,
                 'attribution',   p_attribution
             ));
        RETURN QUERY SELECT v_decision, NULL::uuid, v_remaining, v_used, v_cap_total;
        RETURN;
    ELSIF v_used / v_cap_total >= v_caps.warn_threshold THEN
        v_decision := 'warn';
    ELSE
        v_decision := 'allow';
    END IF;

    -- Reservation schreiben
    INSERT INTO public.tenant_cost_ledger
        (tenant_id, cost_kind, units, unit_price_usd,
         agent_ref, flow_ref, trace_id, causation_event,
         reservation_id, settled, expires_at)
    VALUES
        (p_tenant_id, 'reservation', p_units_estimate, p_unit_price_usd,
         p_attribution->>'agent_ref',
         p_attribution->>'flow_ref',
         (p_attribution->>'trace_id')::uuid,
         (p_attribution->>'causation_event')::uuid,
         v_reservation, false, now() + INTERVAL '5 minutes');

    RETURN QUERY SELECT v_decision, v_reservation, v_remaining, v_used, v_cap_total;
END;
$$;
```

### §5.2 Backpressure-Semantik (kein Hard-Kill)

| Decision | Verhalten Edge-Function | Audit-Event |
|---|---|---|
| `allow` | normal weiter | (kein extra Event) |
| `warn` | normal weiter, optional `Retry-After`-Header | `cost.threshold_crossed` einmal pro Übergang |
| `throttle` | 429 mit `X-Backpressure: <seconds>` | `cost.cap_violation_blocked` |

**Hard-Regel:** Throttle ist ein **kooperatives** Signal. Kunden-Workloads
sollen sich verlangsamen, nicht abstürzen. Edge-Functions MÜSSEN den
429-Pfad mit Hint-Header bedienen.

### §5.3 Reservation-Expiry-Sweeper

```sql
CREATE OR REPLACE FUNCTION public.cost_sweep_expired_reservations()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    WITH expired AS (
        DELETE FROM public.tenant_cost_ledger
              WHERE settled = false
                AND expires_at < now()
          RETURNING tenant_id, reservation_id
    )
    INSERT INTO public.runtime_events
        (tenant_id, type, severity, source, review_status, payload)
    SELECT
        e.tenant_id,
        'cost.reservation_expired', 'low',
        'economic_control', 'auto',
        jsonb_build_object('reservation_id', e.reservation_id)
      FROM expired e;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

SELECT cron.schedule(
    'cost_reservation_sweep_1min',
    '* * * * *',
    $$ SELECT public.cost_sweep_expired_reservations(); $$
);
```

---

## §6 Unit Economics Dashboard

### §6.1 Cost per Successful Outcome

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_unit_economics_outcome AS
WITH outcomes AS (
    SELECT
        tenant_id,
        payload->>'flow_ref'                  AS flow_ref,
        DATE_TRUNC('day', ts)                 AS day,
        COUNT(*) FILTER (WHERE type = 'outcome.completed') AS completed,
        COUNT(*) FILTER (WHERE type = 'outcome.failed')    AS failed
      FROM public.runtime_events
     WHERE ts >= now() - INTERVAL '90 days'
       AND payload ? 'flow_ref'
     GROUP BY 1,2,3
),
spend AS (
    SELECT
        tenant_id,
        flow_ref,
        DATE_TRUNC('day', occurred_at) AS day,
        SUM(amount_usd)                AS amount_usd
      FROM public.tenant_cost_ledger
     WHERE is_simulated = false AND settled = true
       AND occurred_at >= now() - INTERVAL '90 days'
       AND flow_ref IS NOT NULL
     GROUP BY 1,2,3
)
SELECT
    o.tenant_id,
    o.flow_ref,
    o.day,
    o.completed,
    o.failed,
    s.amount_usd,
    (s.amount_usd / NULLIF(o.completed, 0))::numeric(14,6) AS cost_per_completed,
    (s.amount_usd / NULLIF(o.completed + o.failed, 0))::numeric(14,6) AS cost_per_attempt,
    now() AS computed_at
  FROM outcomes o
  LEFT JOIN spend s USING (tenant_id, flow_ref, day);

CREATE UNIQUE INDEX IF NOT EXISTS mv_unit_economics_outcome_pk
    ON public.mv_unit_economics_outcome (tenant_id, flow_ref, day);
```

### §6.2 Cost per Incident Prevented

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_cost_per_incident_prevented AS
WITH prevention AS (
    SELECT
        tenant_id,
        DATE_TRUNC('week', ts) AS week,
        COUNT(*) FILTER (WHERE type = 'policy.violation_prevented') AS prevented,
        COUNT(*) FILTER (WHERE type = 'incident.opened')             AS occurred
      FROM public.runtime_events
     WHERE ts >= now() - INTERVAL '90 days'
     GROUP BY 1,2
),
spend AS (
    SELECT
        tenant_id,
        DATE_TRUNC('week', occurred_at) AS week,
        SUM(amount_usd) AS amount_usd
      FROM public.tenant_cost_ledger
     WHERE is_simulated = false AND settled = true
       AND occurred_at >= now() - INTERVAL '90 days'
     GROUP BY 1,2
)
SELECT
    p.tenant_id,
    p.week,
    p.prevented,
    p.occurred,
    s.amount_usd,
    (s.amount_usd / NULLIF(p.prevented, 0))::numeric(14,6) AS usd_per_prevention,
    now() AS computed_at
  FROM prevention p
  LEFT JOIN spend s USING (tenant_id, week);

CREATE UNIQUE INDEX IF NOT EXISTS mv_cost_per_incident_prevented_pk
    ON public.mv_cost_per_incident_prevented (tenant_id, week);
```

### §6.3 „Wer subventioniert wen?" (nur Super-Admin)

```sql
CREATE OR REPLACE VIEW public.v_cross_tenant_subsidy
WITH (security_invoker = true)
AS
SELECT
    f.tenant_id,
    f.flow_ref,
    f.amount_usd_30d,
    f.distinct_traces_30d,
    -- Cohort-Average pro Flow (alle Tenants)
    AVG(f.amount_usd_30d) OVER (PARTITION BY f.flow_ref) AS cohort_avg_usd,
    (f.amount_usd_30d
     / NULLIF(AVG(f.amount_usd_30d) OVER (PARTITION BY f.flow_ref), 0)
    )::numeric(6,3)                                       AS subsidy_ratio
  FROM (
      SELECT
          tenant_id,
          flow_ref,
          SUM(amount_usd) AS amount_usd_30d,
          COUNT(DISTINCT trace_id) AS distinct_traces_30d
        FROM public.tenant_cost_ledger
       WHERE is_simulated = false AND settled = true
         AND occurred_at >= now() - INTERVAL '30 days'
       GROUP BY 1,2
  ) f;
```

**Hard-Regel:** `v_cross_tenant_subsidy` ist **nicht** RLS-isoliert — sie
ist explizit für Super-Admin gedacht. Edge-Function-Gating über separaten
RBAC-Check verhindert Tenant-Read. Kein direkter Client-Zugriff.

### §6.4 „Welches Feature ist underwater?"

```sql
CREATE OR REPLACE VIEW public.v_underwater_features
WITH (security_invoker = true)
AS
SELECT
    tenant_id,
    flow_ref,
    cost_per_completed,
    -- Schwelle: doppelter cohort-median = underwater
    cost_per_completed
      / NULLIF(percentile_cont(0.5) WITHIN GROUP (ORDER BY cost_per_completed)
                  OVER (PARTITION BY flow_ref), 0)
    AS multiple_of_median,
    completed,
    amount_usd
  FROM public.mv_unit_economics_outcome
 WHERE day >= now() - INTERVAL '14 days'
   AND completed > 0;
```

---

## §7 Refresh-Schedule

```sql
SELECT cron.schedule(
    'mv_cost_refresh_15min',
    '*/15 * * * *',
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cost_per_tenant;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cost_per_feature;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cost_per_agent;
    $$
);

SELECT cron.schedule(
    'mv_unit_economics_hourly',
    '0 * * * *',
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_unit_economics_outcome;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cost_per_incident_prevented;
    $$
);
```

---

## §8 RLS & Grants

```sql
-- MVs sind RLS-fähig in PG 16+. Falls niedriger: wrap in security_invoker view.
ALTER MATERIALIZED VIEW public.mv_cost_per_tenant                 ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_cost_per_feature                ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_cost_per_agent                  ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_unit_economics_outcome          ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_cost_per_incident_prevented     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mv_cost_per_tenant tenant-read" ON public.mv_cost_per_tenant;
CREATE POLICY "mv_cost_per_tenant tenant-read"
    ON public.mv_cost_per_tenant FOR SELECT
    USING (public.has_tenant_membership(tenant_id));
-- analog für die anderen MVs

REVOKE ALL ON FUNCTION public.cost_check_and_reserve(
    UUID, TEXT, NUMERIC, NUMERIC, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cost_check_and_reserve(
    UUID, TEXT, NUMERIC, NUMERIC, JSONB
) TO service_role;

REVOKE ALL ON FUNCTION public.cost_writer_settle(
    UUID, TEXT, NUMERIC, NUMERIC, JSONB, TEXT, TEXT, UUID, BOOLEAN, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cost_writer_settle(
    UUID, TEXT, NUMERIC, NUMERIC, JSONB, TEXT, TEXT, UUID, BOOLEAN, UUID
) TO service_role;
```

---

## §9 Compliance Mapping

| Anforderung | Quelle | Umsetzung |
|---|---|---|
| Mißbrauchsprävention | EU AI Liability Directive Draft | Hard-Caps §5 + `cost.cap_violation_blocked`-Trail |
| Auditierbarkeit der Kosten | AI Act Art. 12 | Ledger ist append-only, Trail im `runtime_events` |
| Datensparsamkeit auf Cost-Daten | DSGVO Art. 5 | `tenant_cost_ledger` enthält **keinen** Klartext-PII; nur `subject_ref`-Hinweise via causation-DAG-Anker |
| Replay ohne Cost-Inflation | interne Hygiene | `is_simulated`-Flag isoliert §10 |
| Backpressure statt Hard-Kill | NIS2 Art. 21 | §5.2 |

---

## §10 Acceptance Criteria

- [ ] `tenant_cost_ledger` ist append-only (kein UPDATE/DELETE für Nicht-Service)
- [ ] Reservation/Settle-Lifecycle §5.1 atomar
- [ ] Throttle = Backpressure, kein Hard-Kill (§5.2)
- [ ] Cost-Propagation entlang causation-DAG (§4.2/§4.3) idempotent
- [ ] Jeder Ledger-Insert hat mindestens eine Attribution-Achse (§4.4)
- [ ] Simulated Cost-Zeilen sind aus Cap-Aggregaten ausgeschlossen
- [ ] MVs §3, §6 mit RLS, Refresh-Cron §7 idempotent
- [ ] Cross-Tenant-View §6.3 nur über Super-Admin-RPC
- [ ] T0-Audit-Events bei Cap-Violation + Threshold-Crossing
- [ ] Reservation-Expiry-Sweeper läuft minutely, schreibt T2-Event

---

## §11 Open Questions

1. **Vendor-Pricing-Tabelle** — eigene RFC: `vendor_pricing(effective_from, effective_to, model_ref, kind, unit_price_usd)` — replay-sicher durch `unit_price_usd`-Snapshot in jeder Ledger-Zeile.

2. **Incident-Cost Berechnung** — wie wird `incident_cost` quantifiziert? Vorschlag: pauschal pro Severity (low=10 USD, medium=50, high=200, critical=1000) als Default-Modell, override pro Tenant über `tenant_cost_caps.notes` (separater Spalten-Refactor).

3. **Memory-Cost Berechnung** — `memory_byte_hour` ist intuitiv, aber wie messen wir „Memory inflation cost"? Vorschlag: bytes_in_use × hours_held × USD/GB·h aus Storage-Preisliste.

4. **PG-16-Voraussetzung für RLS auf MVs** — falls niedriger, ersetze MVs durch `security_invoker` Views auf einer materialized base. Supabase liefert aktuell 15+; check Plattform-Version.

5. **Replay-Cost-Vergleich UI** — separates Surface braucht eigene RFC.

6. **Cap-Recovery nach Monatsturnus** — passiert „natürlich" durch das `DATE_TRUNC('month', now())`-Fenster, aber wir brauchen ein `cost.cap_reset`-Event pro Monatsstart für Audit-Trail-Vollständigkeit.

7. **Storage-Cap-Aktion** — derzeit nur warn. Wenn Storage explodiert, brauchen wir auch Throttle? Vorschlag: Phase 2 — derzeit Storage als „Soft-Signal" behandeln, blockiert nicht.

---

## §12 Was diese RFC NICHT entscheidet

- ❌ Edge-Function-Implementierung der Middleware
- ❌ UI-Surfaces für Cost-Dashboard / Unit-Economics
- ❌ Konkrete Vendor-Pricing-Werte (eigene Tabelle, eigene RFC)
- ❌ Billing-Integration mit Stripe
- ❌ Cross-Tenant-Reporting für Sales-Team
- ❌ Cost-Forecasting / ML-Vorhersagen

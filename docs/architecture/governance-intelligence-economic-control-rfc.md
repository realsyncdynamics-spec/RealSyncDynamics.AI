# RFC-004 — Governance Intelligence + Economic Control v1.0

**Status:** Draft v1.0 — Policy, Semantics, SQL artefacts
**Owner:** Governance Runtime
**Created:** 2026-05-21
**Companion to:** SPEC-001 (`runtime_events`), Kernel-RFC §P4,
RFC-002 (`subject_ref`), RFC-003 (Memory Policy)

---

## §0 Warum **ein** RFC, nicht zwei

Intelligence und Economics sind im Produkt-Sinn **eine** Schicht.
Auseinandergerissen entstehen drei Pathologien:

1. **Intelligence ohne Economics ist blind.**
   Ein Tenant mit Risk-Score 95/100 ist ohne Cost-Kontext entweder ein
   abdriftender Demo-Account oder ein zahlender Großkunde, dessen Workload
   in einem Hochrisiko-Sektor läuft. Die Reaktion auf beide ist diametral
   entgegengesetzt — eine **Plattform-Entscheidung**, die ohne Economics
   nicht zu treffen ist.

2. **Economics ohne Intelligence ist willkürlich.**
   Eine Hard-Cap auf `tokens_per_month` killt jeden Kunden, der eine
   legitime Lastspitze fährt (Wahlkampf, Black-Friday). Ohne Anomaly-Kontext
   kennen wir den Unterschied zwischen „bösartig" und „erfolgreich" nicht.

3. **Der Moat liegt im kombinierten Graphen.**
   `Risk × Cost × Outcome` ist eine prädiktive Größe, die aus den
   Einzelfaktoren nicht ableitbar ist. Wer Risk und Cost in zwei
   Datenmodellen pflegt, **kann das Quadranten-Modell aus §16 nicht
   bauen**.

Diese RFC entscheidet die Layer als **eine** Sache. Tabellen, MVs und
RPCs tragen Suffixe, die ihre Domäne anzeigen, leben aber im selben
Daten-Graphen und auf demselben Backbone (`runtime_events`).

---

## §1 Zielbild

```text
                ┌──────────────────────────┐
                │   runtime_events (T0/T1) │  ← SPEC-001 (hash-chained)
                └──────────────────────────┘
                       │   │
       Reader (Part A) │   │ Reader (Part B)
             ┌─────────┘   └────────┐
             ▼                       ▼
   ┌──────────────────┐    ┌────────────────────────┐
   │  Intelligence    │    │  Economic Control      │
   │  - risk_scores   │    │  - cost_ledger         │
   │  - anomalies     │    │  - cost_caps           │
   │  - compliance    │    │  - cost_per_outcome    │
   └──────────────────┘    └────────────────────────┘
              \                       /
               \                     /
                ▼                   ▼
            ┌─────────────────────────────┐
            │   Part C — Joint Surfaces   │
            │  risk-adjusted cost,        │
            │  tenant quadrants,          │
            │  deprecation triggers       │
            └─────────────────────────────┘
                       │
                       │ emit governance.*, economic.*, joint.*
                       ▼
                ┌──────────────────────────┐
                │   runtime_events (T0/T1) │
                └──────────────────────────┘
```

**Prinzip:** Jede Aussage (egal ob Risk, Cost oder Joint) ist als Event
zurück im Bus. Reproduzierbar, signiert (Hash-Chain), tenant-isoliert.

---

# Part A — Governance Intelligence

## §2 Risk Scoring Algebra

### §2.1 Tenant Risk Score

Komposition aus vier Komponenten, jede 0..100, gewichtete Summe:

| Component | Gewicht | Quelle |
|---|---|---|
| Consent Violations | 0.30 | `tracker.pre_consent_detected`, `consent.regression_detected` / 7d |
| AI Loop Depth | 0.20 | max causation-DAG-Tiefe in einem `trace_id` / 24h |
| Memory Inflation Rate | 0.20 | Δ memory rows / 24h gegen Vortag |
| Incident Freq × Severity | 0.30 | rolling 30d, severity-gewichtet |

```sql
-- Component 1
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_risk_consent_7d AS
SELECT
    tenant_id,
    COUNT(*) AS violations,
    COUNT(*) FILTER (WHERE severity IN ('high','critical')) AS severe,
    LEAST(100.0,
          COUNT(*) FILTER (WHERE severity IN ('high','critical')) * 5.0
        + COUNT(*) * 0.5
    )::numeric(5,2) AS component_score,
    now() AS computed_at
  FROM public.runtime_events
 WHERE type IN ('tracker.pre_consent_detected','consent.regression_detected')
   AND ts >= now() - INTERVAL '7 days'
 GROUP BY tenant_id;
CREATE UNIQUE INDEX IF NOT EXISTS mv_risk_consent_7d_pk ON public.mv_risk_consent_7d (tenant_id);

-- Component 2 — AI Loop Depth
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_risk_ai_loop_24h AS
WITH RECURSIVE chain(global_seq, root, depth, tenant_id) AS (
    SELECT e.global_seq, e.global_seq, 0, e.tenant_id
      FROM public.runtime_events e
     WHERE e.causation_id IS NULL
       AND e.ts >= now() - INTERVAL '24 hours'
       AND e.type LIKE 'ai.%'
    UNION ALL
    SELECT e.global_seq, c.root, c.depth + 1, e.tenant_id
      FROM public.runtime_events e
      JOIN chain c ON e.causation_id::text = c.global_seq::text
     WHERE c.depth < 32
       AND e.ts >= now() - INTERVAL '24 hours'
)
SELECT tenant_id,
       MAX(depth) AS max_loop_depth,
       LEAST(100.0, MAX(depth) * 10.0)::numeric(5,2) AS component_score,
       now() AS computed_at
  FROM chain
 GROUP BY tenant_id;
CREATE UNIQUE INDEX IF NOT EXISTS mv_risk_ai_loop_24h_pk ON public.mv_risk_ai_loop_24h (tenant_id);

-- Component 3 — Memory Inflation
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_risk_memory_inflation_24h AS
SELECT
    m.tenant_id,
    COUNT(*) FILTER (WHERE m.created_at >= now() - INTERVAL '24 hours') AS new_rows,
    COUNT(*) FILTER (WHERE m.created_at >= now() - INTERVAL '48 hours'
                       AND m.created_at <  now() - INTERVAL '24 hours') AS prev_rows,
    LEAST(100.0, GREATEST(0,
        (COUNT(*) FILTER (WHERE m.created_at >= now() - INTERVAL '24 hours')
       - COUNT(*) FILTER (WHERE m.created_at >= now() - INTERVAL '48 hours'
                            AND m.created_at <  now() - INTERVAL '24 hours'))
        / NULLIF(COUNT(*) FILTER (WHERE m.created_at >= now() - INTERVAL '48 hours'
                                    AND m.created_at <  now() - INTERVAL '24 hours'), 0)
        * 50.0
    ))::numeric(5,2) AS component_score,
    now() AS computed_at
  FROM public.agent_memory m
 GROUP BY m.tenant_id;
CREATE UNIQUE INDEX IF NOT EXISTS mv_risk_memory_inflation_24h_pk
    ON public.mv_risk_memory_inflation_24h (tenant_id);

-- Component 4 — Incident severity-weighted (30d)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_risk_incident_30d AS
SELECT
    tenant_id,
    COUNT(*) AS incident_count,
    LEAST(100.0,
        SUM(CASE severity
                WHEN 'critical' THEN 25
                WHEN 'high'     THEN 10
                WHEN 'medium'   THEN 3
                WHEN 'low'      THEN 1
                ELSE 0
            END)
    )::numeric(5,2) AS component_score,
    now() AS computed_at
  FROM public.runtime_events
 WHERE type IN ('incident.opened','incident.escalated','policy.violation_detected')
   AND ts >= now() - INTERVAL '30 days'
 GROUP BY tenant_id;
CREATE UNIQUE INDEX IF NOT EXISTS mv_risk_incident_30d_pk ON public.mv_risk_incident_30d (tenant_id);

-- Composite (with feature_hash for replay)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_tenant_risk_score AS
SELECT
    t.id AS tenant_id,
    COALESCE(c.component_score, 0) AS consent_component,
    COALESCE(l.component_score, 0) AS ai_loop_component,
    COALESCE(m.component_score, 0) AS memory_inflation_component,
    COALESCE(i.component_score, 0) AS incident_component,
    (  0.30 * COALESCE(c.component_score, 0)
     + 0.20 * COALESCE(l.component_score, 0)
     + 0.20 * COALESCE(m.component_score, 0)
     + 0.30 * COALESCE(i.component_score, 0)
    )::numeric(5,2) AS tenant_risk_score,
    encode(digest(
        format('tenant=%s|v1.0|c=%s|l=%s|m=%s|i=%s',
            t.id,
            COALESCE(c.component_score, 0),
            COALESCE(l.component_score, 0),
            COALESCE(m.component_score, 0),
            COALESCE(i.component_score, 0))::bytea,
        'sha256'
    ), 'hex') AS feature_hash,
    'tenant-risk-v1.0' AS model_ref,
    now() AS computed_at
  FROM public.tenants t
  LEFT JOIN public.mv_risk_consent_7d           c ON c.tenant_id = t.id
  LEFT JOIN public.mv_risk_ai_loop_24h          l ON l.tenant_id = t.id
  LEFT JOIN public.mv_risk_memory_inflation_24h m ON m.tenant_id = t.id
  LEFT JOIN public.mv_risk_incident_30d         i ON i.tenant_id = t.id;
CREATE UNIQUE INDEX IF NOT EXISTS mv_tenant_risk_score_pk
    ON public.mv_tenant_risk_score (tenant_id);
```

### §2.2 Subject Risk Score (real-time)

```sql
CREATE OR REPLACE FUNCTION public.compute_subject_risk_score(
    p_tenant_id    UUID,
    p_subject_ref  TEXT,
    p_as_of        TIMESTAMPTZ DEFAULT now()
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
DECLARE
    v_consent  NUMERIC(5,2);
    v_incident NUMERIC(5,2);
    v_velocity NUMERIC(5,2);
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT LEAST(100.0, COUNT(*) * 12.0) INTO v_consent
      FROM public.runtime_events
     WHERE tenant_id = p_tenant_id AND subject_ref = p_subject_ref
       AND type IN ('tracker.pre_consent_detected','consent.regression_detected')
       AND ts BETWEEN p_as_of - INTERVAL '30 days' AND p_as_of;

    SELECT LEAST(100.0, SUM(CASE severity
                                WHEN 'critical' THEN 30
                                WHEN 'high' THEN 12
                                WHEN 'medium' THEN 4
                                ELSE 1 END)) INTO v_incident
      FROM public.runtime_events
     WHERE tenant_id = p_tenant_id AND subject_ref = p_subject_ref
       AND type LIKE 'incident.%'
       AND ts BETWEEN p_as_of - INTERVAL '90 days' AND p_as_of;

    SELECT LEAST(100.0, COUNT(*) * 3.0) INTO v_velocity
      FROM public.runtime_events
     WHERE tenant_id = p_tenant_id AND subject_ref = p_subject_ref
       AND ts BETWEEN p_as_of - INTERVAL '5 minutes' AND p_as_of;

    RETURN QUERY SELECT
        p_subject_ref,
        ( 0.40 * COALESCE(v_consent,0)
        + 0.40 * COALESCE(v_incident,0)
        + 0.20 * COALESCE(v_velocity,0))::numeric(5,2),
        COALESCE(v_consent,0), COALESCE(v_incident,0), COALESCE(v_velocity,0),
        encode(digest(
            format('subj=%s|v1.0|c=%s|i=%s|v=%s', p_subject_ref,
                COALESCE(v_consent,0), COALESCE(v_incident,0),
                COALESCE(v_velocity,0))::bytea, 'sha256'
        ), 'hex'),
        'subject-risk-v1.0', p_as_of;
END;
$$;
```

AFTER-INSERT-Trigger emittiert `governance.risk_score_changed`, wenn der
Score-Delta ≥ 10 ist; `WHEN (NEW.source <> 'intelligence')` verhindert
Recompute-Loops.

## §3 Compliance Signal Pipeline

| Framework | Trigger-Events | Severity |
|---|---|---|
| GDPR | `dsr.access_requested`, `dsr.erasure_requested`, `dsr.export_completed` | medium → high bei `erasure_*` |
| AI Act | `ai.high_risk_use_case_detected`, `ai.classification_changed` | high → critical bei Hochrisiko |
| NIS2 | `incident.escalated`, `security.breach_*` | max(source, 'high') |

**Taint-Propagation entlang causation-DAG** (synchron, schreibt
`compliance.taint_propagated` pro nachgelagertem Knoten):

```sql
CREATE OR REPLACE FUNCTION public.propagate_compliance_taint(
    p_tenant_id   UUID,
    p_subject_ref TEXT,
    p_signal_kind TEXT,    -- 'gdpr' | 'ai_act' | 'nis2'
    p_root_event_id UUID
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT := 0;
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    WITH RECURSIVE downstream AS (
        SELECT e.id, 0 AS depth
          FROM public.runtime_events e
         WHERE e.id = p_root_event_id
        UNION ALL
        SELECT e.id, d.depth + 1
          FROM public.runtime_events e
          JOIN downstream d ON e.causation_id = d.id
         WHERE d.depth < 64
    )
    INSERT INTO public.runtime_events
        (tenant_id, type, severity, source, review_status,
         subject_ref, causation_id, payload)
    SELECT p_tenant_id, 'compliance.taint_propagated', 'medium',
           'intelligence', 'auto', p_subject_ref, d.id,
           jsonb_build_object('signal_kind', p_signal_kind,
                              'root_event', p_root_event_id,
                              'depth', d.depth)
      FROM downstream d
     WHERE d.depth > 0;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
```

Offene Signale werden in `mv_compliance_signals_open` aggregiert
(Anti-Join gegen `compliance.signal_closed`-Events).

## §4 Anomaly Detection Rules

| Anomaly | Signature | Severity |
|---|---|---|
| Token Explosion | total_tokens / trace > p99(30d) AND z-score ≥ 4 | high |
| Memory Decay Anomaly | Δ memory state transitions / 24h > 3× baseline | medium |
| Consent Regression | `consent.granted` gefolgt von `tracker.pre_consent_detected` < 1h | high |
| Cost-per-Outcome Explosion | today's USD/completion ≥ 5× rolling 30d | high |

```sql
-- Token Explosion
CREATE OR REPLACE FUNCTION public.detect_token_explosion(
    p_tenant_id UUID,
    p_window    INTERVAL DEFAULT INTERVAL '1 hour'
) RETURNS TABLE (
    trace_id UUID, total_tokens BIGINT, baseline_p99 BIGINT,
    z_score NUMERIC(6,2), detected_at TIMESTAMPTZ
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
            stddev_samp(tt) AS stddev, avg(tt) AS mean
          FROM (
              SELECT trace_id,
                     SUM(((payload->>'input_tokens')::int +
                          (payload->>'output_tokens')::int))::bigint AS tt
                FROM public.runtime_events
               WHERE tenant_id = p_tenant_id
                 AND type LIKE 'ai.%'
                 AND ts BETWEEN now() - INTERVAL '30 days' AND now() - p_window
                 AND trace_id IS NOT NULL
               GROUP BY trace_id) traces
    ),
    cur AS (
        SELECT trace_id,
               SUM(((payload->>'input_tokens')::int +
                    (payload->>'output_tokens')::int))::bigint AS tt
          FROM public.runtime_events
         WHERE tenant_id = p_tenant_id AND type LIKE 'ai.%'
           AND ts >= now() - p_window AND trace_id IS NOT NULL
         GROUP BY trace_id
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

-- Consent Regression
CREATE OR REPLACE FUNCTION public.detect_consent_regression(
    p_tenant_id UUID, p_window INTERVAL DEFAULT INTERVAL '24 hours'
) RETURNS TABLE (
    subject_ref TEXT, granted_at TIMESTAMPTZ, regressed_at TIMESTAMPTZ,
    regression_lag INTERVAL, pre_consent_event UUID
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
        SELECT subject_ref, ts AS granted_at
          FROM public.runtime_events
         WHERE tenant_id = p_tenant_id AND type = 'consent.granted'
           AND ts >= now() - p_window
    ),
    breach AS (
        SELECT subject_ref, ts AS regressed_at, id
          FROM public.runtime_events
         WHERE tenant_id = p_tenant_id AND type = 'tracker.pre_consent_detected'
           AND ts >= now() - p_window
    )
    SELECT g.subject_ref, g.granted_at, b.regressed_at,
           b.regressed_at - g.granted_at, b.id
      FROM grants g JOIN breach b
        ON b.subject_ref = g.subject_ref
       AND b.regressed_at > g.granted_at
       AND b.regressed_at - g.granted_at < INTERVAL '1 hour';
END;
$$;
```

Cron emittiert die Detector-Outputs als `governance.anomaly_detected`
T1-Events.

---

# Part B — Economic Control

## §5 Cost Attribution Ledger

```sql
CREATE TABLE IF NOT EXISTS public.tenant_cost_ledger (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Attribution (≥ 1 muss gesetzt sein)
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

    -- Reservation lifecycle
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
```

### §5.1 Cost-Propagation entlang causation-DAG

Jedes Event trägt einen `cost_units`-Snapshot im Payload:

```json
{ "cost_units": {
    "token_cost":    0.0420,
    "storage_cost":  0.0000,
    "incident_cost": 0.0000,
    "memory_cost":   0.0002,
    "total":         0.0422
} }
```

Akkumulation:

```sql
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
```

Idempotenz: `supersedes_id` (RFC-003) verhindert Doppel-Akkumulation
beim Re-Processing.

## §6 Hard Caps Semantics

### §6.1 Cap-Tabelle

```sql
CREATE TABLE IF NOT EXISTS public.tenant_cost_caps (
    tenant_id           UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    llm_tokens_monthly  BIGINT NOT NULL DEFAULT 5000000,
    llm_usd_monthly     NUMERIC(10,2) NOT NULL DEFAULT 250.00,
    storage_gb_hours    NUMERIC(12,2) NOT NULL DEFAULT 1000,
    edge_invocations    BIGINT NOT NULL DEFAULT 1000000,
    replay_simulations  INT NOT NULL DEFAULT 100,
    memory_per_subject  BIGINT NOT NULL DEFAULT 10000,
    warn_threshold      NUMERIC(3,2) NOT NULL DEFAULT 0.80,
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
    ON public.tenant_cost_caps FOR ALL USING (false) WITH CHECK (false);
```

### §6.2 Pre-Check + Reservation + Settle (Backpressure, kein Kill)

```sql
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
        v_caps := ROW(p_tenant_id, 5000000, 250.00, 1000, 1000000,
                      100, 10000, 0.80, NULL, NULL, now());
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
    ELSIF v_used / v_total >= v_caps.warn_threshold THEN
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
```

| Decision | Edge-Function-Verhalten | Audit |
|---|---|---|
| `allow` | normal weiter | (kein extra Event) |
| `warn` | normal, optional `Retry-After`-Header | `cost.threshold_crossed` einmal pro Übergang |
| `throttle` | 429 mit `X-Backpressure` | `cost.cap_violation_blocked` |

**T0-Events bypassen Throttle** — Audit-Pflicht überschreibt Budget.

Reservation-Sweeper (cron, minutely):

```sql
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
```

## §7 Unit Economics Queries

### §7.1 Aggregat-MVs

```sql
-- Per Tenant
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_cost_per_tenant AS
SELECT
    l.tenant_id,
    SUM(units)      FILTER (WHERE cost_kind = 'llm_input'  AND occurred_at >= now() - INTERVAL '7 days')  AS tokens_in_7d,
    SUM(units)      FILTER (WHERE cost_kind = 'llm_output' AND occurred_at >= now() - INTERVAL '7 days')  AS tokens_out_7d,
    SUM(amount_usd) FILTER (WHERE cost_kind IN ('llm_input','llm_output') AND occurred_at >= now() - INTERVAL '7 days')  AS llm_usd_7d,
    SUM(amount_usd) FILTER (WHERE cost_kind = 'storage_gb_hour'  AND occurred_at >= now() - INTERVAL '7 days') AS storage_usd_7d,
    SUM(amount_usd) FILTER (WHERE cost_kind = 'memory_byte_hour' AND occurred_at >= now() - INTERVAL '7 days') AS memory_usd_7d,
    SUM(amount_usd) FILTER (WHERE cost_kind = 'incident_cost'    AND occurred_at >= now() - INTERVAL '7 days') AS incident_usd_7d,
    SUM(units)      FILTER (WHERE cost_kind = 'llm_input'  AND occurred_at >= now() - INTERVAL '30 days') AS tokens_in_30d,
    SUM(units)      FILTER (WHERE cost_kind = 'llm_output' AND occurred_at >= now() - INTERVAL '30 days') AS tokens_out_30d,
    SUM(amount_usd) FILTER (WHERE cost_kind IN ('llm_input','llm_output') AND occurred_at >= now() - INTERVAL '30 days') AS llm_usd_30d,
    SUM(amount_usd) FILTER (WHERE occurred_at >= now() - INTERVAL '90 days') AS total_usd_90d,
    now() AS computed_at
  FROM public.tenant_cost_ledger l
 WHERE is_simulated = false AND settled = true
 GROUP BY l.tenant_id;
CREATE UNIQUE INDEX IF NOT EXISTS mv_cost_per_tenant_pk ON public.mv_cost_per_tenant (tenant_id);

-- Per Feature
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_cost_per_feature AS
SELECT tenant_id, flow_ref, cost_kind,
       SUM(units) AS units_30d, SUM(amount_usd) AS amount_usd_30d,
       COUNT(DISTINCT trace_id) AS distinct_traces_30d,
       now() AS computed_at
  FROM public.tenant_cost_ledger
 WHERE is_simulated = false AND settled = true
   AND occurred_at >= now() - INTERVAL '30 days'
   AND flow_ref IS NOT NULL
 GROUP BY tenant_id, flow_ref, cost_kind;
CREATE UNIQUE INDEX IF NOT EXISTS mv_cost_per_feature_pk
    ON public.mv_cost_per_feature (tenant_id, flow_ref, cost_kind);

-- Per Agent
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_cost_per_agent AS
SELECT tenant_id, agent_ref,
       SUM(amount_usd) AS amount_usd_30d,
       SUM(amount_usd) / 30.0 AS amount_usd_daily_avg,
       COUNT(DISTINCT trace_id) AS distinct_traces_30d,
       SUM(units) FILTER (WHERE cost_kind = 'llm_input')  AS tokens_in_30d,
       SUM(units) FILTER (WHERE cost_kind = 'llm_output') AS tokens_out_30d,
       now() AS computed_at
  FROM public.tenant_cost_ledger
 WHERE is_simulated = false AND settled = true
   AND occurred_at >= now() - INTERVAL '30 days'
   AND agent_ref IS NOT NULL
 GROUP BY tenant_id, agent_ref;
CREATE UNIQUE INDEX IF NOT EXISTS mv_cost_per_agent_pk
    ON public.mv_cost_per_agent (tenant_id, agent_ref);

-- Cost per Outcome
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_unit_economics_outcome AS
WITH outcomes AS (
    SELECT tenant_id, payload->>'flow_ref' AS flow_ref,
           DATE_TRUNC('day', ts) AS day,
           COUNT(*) FILTER (WHERE type = 'outcome.completed') AS completed,
           COUNT(*) FILTER (WHERE type = 'outcome.failed')    AS failed
      FROM public.runtime_events
     WHERE ts >= now() - INTERVAL '90 days' AND payload ? 'flow_ref'
     GROUP BY 1,2,3
),
spend AS (
    SELECT tenant_id, flow_ref, DATE_TRUNC('day', occurred_at) AS day,
           SUM(amount_usd) AS amount_usd
      FROM public.tenant_cost_ledger
     WHERE is_simulated = false AND settled = true
       AND occurred_at >= now() - INTERVAL '90 days'
       AND flow_ref IS NOT NULL
     GROUP BY 1,2,3
)
SELECT o.tenant_id, o.flow_ref, o.day, o.completed, o.failed,
       s.amount_usd,
       (s.amount_usd / NULLIF(o.completed, 0))::numeric(14,6) AS cost_per_completed,
       (s.amount_usd / NULLIF(o.completed + o.failed, 0))::numeric(14,6) AS cost_per_attempt,
       now() AS computed_at
  FROM outcomes o LEFT JOIN spend s USING (tenant_id, flow_ref, day);
CREATE UNIQUE INDEX IF NOT EXISTS mv_unit_economics_outcome_pk
    ON public.mv_unit_economics_outcome (tenant_id, flow_ref, day);

-- Cost per Incident Prevented
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_cost_per_incident_prevented AS
WITH prev AS (
    SELECT tenant_id, DATE_TRUNC('week', ts) AS week,
           COUNT(*) FILTER (WHERE type = 'policy.violation_prevented') AS prevented,
           COUNT(*) FILTER (WHERE type = 'incident.opened') AS occurred
      FROM public.runtime_events
     WHERE ts >= now() - INTERVAL '90 days'
     GROUP BY 1,2
),
spend AS (
    SELECT tenant_id, DATE_TRUNC('week', occurred_at) AS week,
           SUM(amount_usd) AS amount_usd
      FROM public.tenant_cost_ledger
     WHERE is_simulated = false AND settled = true
       AND occurred_at >= now() - INTERVAL '90 days'
     GROUP BY 1,2
)
SELECT p.tenant_id, p.week, p.prevented, p.occurred, s.amount_usd,
       (s.amount_usd / NULLIF(p.prevented, 0))::numeric(14,6) AS usd_per_prevention,
       now() AS computed_at
  FROM prev p LEFT JOIN spend s USING (tenant_id, week);
CREATE UNIQUE INDEX IF NOT EXISTS mv_cost_per_incident_prevented_pk
    ON public.mv_cost_per_incident_prevented (tenant_id, week);
```

---

# Part C — Integration (Risk × Cost)

> **Hier wird die RFC interessant.** Part A und Part B sind notwendige
> Voraussetzungen; Part C ist das, was eine reine Cost-Plattform und eine
> reine Compliance-Plattform **nicht** liefern können.

## §8 Risk-Adjusted Cost per Outcome (RACPO)

### §8.1 Formel

```
RACPO(flow) = cost_per_completed(flow) × (1 + risk_score / 100) × (1 + incident_pressure / 100)

incident_pressure = severity-gewichtete Σ Incidents im Window auf demselben flow_ref,
                    normalisiert auf 0..100 (siehe §2 Component 4 für Skala)
```

**Interpretation:**

- Flow mit `cost_per_completed = 0.10 USD` und `risk_score = 0` → RACPO = 0.10 USD
- Flow mit `cost_per_completed = 0.10 USD` und `risk_score = 50`, `incident_pressure = 20` → RACPO = 0.10 × 1.50 × 1.20 = **0.18 USD**

Das ist die **wirtschaftliche Wahrheit** über den Flow. Ohne diese
Anpassung subventioniert das Unternehmen unentdeckte Risiken.

### §8.2 SQL — Joint MV

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_risk_adjusted_cost_per_outcome AS
WITH risk_per_tenant AS (
    SELECT tenant_id, tenant_risk_score FROM public.mv_tenant_risk_score
),
incident_per_flow AS (
    SELECT e.tenant_id,
           e.payload->>'flow_ref' AS flow_ref,
           LEAST(100.0, SUM(CASE e.severity
                                WHEN 'critical' THEN 25
                                WHEN 'high'     THEN 10
                                WHEN 'medium'   THEN 3
                                WHEN 'low'      THEN 1
                                ELSE 0 END))::numeric(5,2) AS incident_pressure
      FROM public.runtime_events e
     WHERE e.type IN ('incident.opened','policy.violation_detected')
       AND e.ts >= now() - INTERVAL '30 days'
       AND e.payload ? 'flow_ref'
     GROUP BY 1,2
),
recent_outcome AS (
    SELECT tenant_id, flow_ref,
           SUM(amount_usd) FILTER (WHERE day >= CURRENT_DATE - 7) AS spend_7d,
           SUM(completed)  FILTER (WHERE day >= CURRENT_DATE - 7) AS completed_7d
      FROM public.mv_unit_economics_outcome
     GROUP BY 1,2
)
SELECT
    o.tenant_id,
    o.flow_ref,
    o.spend_7d,
    o.completed_7d,
    (o.spend_7d / NULLIF(o.completed_7d, 0))::numeric(14,6)
        AS raw_cost_per_completed,
    COALESCE(r.tenant_risk_score, 0)         AS tenant_risk_score,
    COALESCE(i.incident_pressure, 0)         AS incident_pressure,
    -- The actual RACPO
    ((o.spend_7d / NULLIF(o.completed_7d, 0))
        * (1 + COALESCE(r.tenant_risk_score, 0) / 100)
        * (1 + COALESCE(i.incident_pressure, 0) / 100)
    )::numeric(14,6)                          AS racpo,
    'racpo-v1.0'                              AS model_ref,
    encode(digest(
        format('%s|%s|risk=%s|press=%s', o.tenant_id, o.flow_ref,
            COALESCE(r.tenant_risk_score, 0),
            COALESCE(i.incident_pressure, 0))::bytea,
        'sha256'), 'hex')                     AS feature_hash,
    now()                                     AS computed_at
  FROM recent_outcome o
  LEFT JOIN risk_per_tenant   r ON r.tenant_id = o.tenant_id
  LEFT JOIN incident_per_flow i ON i.tenant_id = o.tenant_id
                               AND i.flow_ref  = o.flow_ref;

CREATE UNIQUE INDEX IF NOT EXISTS mv_racpo_pk
    ON public.mv_risk_adjusted_cost_per_outcome (tenant_id, flow_ref);
```

## §9 Tenant Quadrants

> Vier Quadranten aus `tenant_risk_score` (Schwelle 50) × `30d-spend`
> (Schwelle = cohort-median × 1.5).

| Quadrant | Risk | Cost | Plattform-Reaktion |
|---|---|---|---|
| **Reserved Capacity** | low | low | Default-Caps, evtl. proaktive Upsell-Signale (Sales) |
| **Investigate** | high | low | Anomaly-Audit, Demo-Account-Verdacht, mögliche Spam-Pipeline |
| **Premium Review** | low | high | Pricing-Review, Multi-Tenant-Subsidy-Check (siehe §11) |
| **Red Alert** | high | high | Eskalation an Compliance + CSM, automatischer Throttle-Hint, Incident-Audit |

```sql
CREATE OR REPLACE VIEW public.v_tenant_risk_cost_quadrant
WITH (security_invoker = true)
AS
WITH spend AS (
    SELECT tenant_id, total_usd_90d FROM public.mv_cost_per_tenant
),
cohort AS (
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY total_usd_90d) AS median_spend
      FROM spend
),
risk AS (
    SELECT tenant_id, tenant_risk_score FROM public.mv_tenant_risk_score
)
SELECT
    t.id AS tenant_id,
    COALESCE(r.tenant_risk_score, 0) AS risk_score,
    COALESCE(s.total_usd_90d, 0)     AS spend_90d,
    c.median_spend,
    CASE
        WHEN COALESCE(r.tenant_risk_score, 0) >= 50
             AND COALESCE(s.total_usd_90d, 0) >= c.median_spend * 1.5
            THEN 'red_alert'
        WHEN COALESCE(r.tenant_risk_score, 0) >= 50
             AND COALESCE(s.total_usd_90d, 0) <  c.median_spend * 1.5
            THEN 'investigate'
        WHEN COALESCE(r.tenant_risk_score, 0) <  50
             AND COALESCE(s.total_usd_90d, 0) >= c.median_spend * 1.5
            THEN 'premium_review'
        ELSE 'reserved_capacity'
    END AS quadrant,
    'tenant-quadrant-v1.0' AS model_ref,
    now() AS computed_at
  FROM public.tenants t
  CROSS JOIN cohort c
  LEFT JOIN risk  r ON r.tenant_id = t.id
  LEFT JOIN spend s ON s.tenant_id = t.id;
```

**Audit-Event-Emission:** Bei Quadranten-Wechsel emittiert ein Cron-Job
ein `joint.tenant_quadrant_changed`-Event mit Vorher/Nachher:

```sql
CREATE OR REPLACE FUNCTION public.emit_quadrant_changes()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT := 0; r RECORD; v_prev TEXT;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    FOR r IN SELECT tenant_id, quadrant FROM public.v_tenant_risk_cost_quadrant LOOP
        SELECT payload->>'quadrant' INTO v_prev
          FROM public.runtime_events
         WHERE tenant_id = r.tenant_id
           AND type = 'joint.tenant_quadrant_changed'
         ORDER BY tenant_seq DESC LIMIT 1;

        IF v_prev IS DISTINCT FROM r.quadrant THEN
            INSERT INTO public.runtime_events
                (tenant_id, type,
                 severity, source, review_status, payload)
            VALUES (r.tenant_id, 'joint.tenant_quadrant_changed',
                    CASE r.quadrant WHEN 'red_alert' THEN 'critical'
                                    WHEN 'investigate' THEN 'high'
                                    ELSE 'info' END,
                    'joint_intelligence', 'auto',
                    jsonb_build_object('previous', v_prev, 'current', r.quadrant));
            v_count := v_count + 1;
        END IF;
    END LOOP;
    RETURN v_count;
END;
$$;
```

## §10 Feature Deprecation Trigger

> Welcher Flow ist **unprofitabel UND riskant**? Den deprecaten wir.

```sql
CREATE OR REPLACE VIEW public.v_features_to_deprecate
WITH (security_invoker = true)
AS
SELECT
    r.tenant_id,
    r.flow_ref,
    r.raw_cost_per_completed,
    r.tenant_risk_score,
    r.incident_pressure,
    r.racpo,
    -- Cohort-Median des Flows über alle Tenants
    percentile_cont(0.5) WITHIN GROUP (ORDER BY r.raw_cost_per_completed)
        OVER (PARTITION BY r.flow_ref) AS cohort_median_cost,
    (r.racpo
        / NULLIF(percentile_cont(0.5) WITHIN GROUP (ORDER BY r.raw_cost_per_completed)
                    OVER (PARTITION BY r.flow_ref), 0)
    )::numeric(6,2) AS racpo_multiple,
    CASE
        WHEN r.racpo
             >= 3 * percentile_cont(0.5) WITHIN GROUP (ORDER BY r.raw_cost_per_completed)
                       OVER (PARTITION BY r.flow_ref)
         AND r.tenant_risk_score >= 50
        THEN 'deprecate'
        WHEN r.racpo
             >= 2 * percentile_cont(0.5) WITHIN GROUP (ORDER BY r.raw_cost_per_completed)
                       OVER (PARTITION BY r.flow_ref)
        THEN 'flag'
        ELSE 'ok'
    END AS recommendation
  FROM public.mv_risk_adjusted_cost_per_outcome r;
```

**Hard-Regel:** „deprecate" ist eine **Empfehlung**, kein Auto-Disable.
Eine echte Deprecation läuft über das Policy-Engine + Change-Management,
nicht durch RACPO direkt. Audit-Event `joint.feature_flagged_for_deprecation`
wird automatisch erzeugt.

## §11 Cross-Tenant Subsidy (Super-Admin)

```sql
CREATE OR REPLACE VIEW public.v_cross_tenant_subsidy
WITH (security_invoker = true)
AS
SELECT
    f.tenant_id, f.flow_ref, f.amount_usd_30d, f.distinct_traces_30d,
    AVG(f.amount_usd_30d) OVER (PARTITION BY f.flow_ref) AS cohort_avg_usd,
    (f.amount_usd_30d
     / NULLIF(AVG(f.amount_usd_30d) OVER (PARTITION BY f.flow_ref), 0)
    )::numeric(6,3) AS subsidy_ratio
  FROM (
      SELECT tenant_id, flow_ref,
             SUM(amount_usd) AS amount_usd_30d,
             COUNT(DISTINCT trace_id) AS distinct_traces_30d
        FROM public.tenant_cost_ledger
       WHERE is_simulated = false AND settled = true
         AND occurred_at >= now() - INTERVAL '30 days'
       GROUP BY 1,2
  ) f;
```

**Not RLS-isolated** — Zugriff nur via Super-Admin-RPC, separater RBAC-Layer.

## §12 Joint-Event-Taxonomie

| Event-Type | Tier | Severity | Wann |
|---|---|---|---|
| `joint.tenant_quadrant_changed` | T1 | red_alert→critical, sonst severity ∝ Quadrant | Quadranten-Wechsel |
| `joint.feature_flagged_for_deprecation` | T1 | medium | RACPO ≥ 3× Median |
| `joint.subsidy_threshold_crossed` | T1 | high | subsidy_ratio ≥ 2.5 |
| `joint.racpo_anomaly` | T0 | high | RACPO-Delta woche-über-woche ≥ 100% |

Alle joint-Events tragen einen `evidence`-Block, der auf:
- die Risk-MV-Zeile (`mv_tenant_risk_score`)
- die Cost-MV-Zeile (`mv_cost_per_tenant`)
- den RACPO-Eintrag (`mv_risk_adjusted_cost_per_outcome`)

verweist — Provenance ist vollständig reproduzierbar.

---

# Part D — Refresh & Cron

```sql
SELECT cron.schedule('mv_risk_refresh_15min', '*/15 * * * *',
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_risk_consent_7d;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_risk_ai_loop_24h;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_risk_memory_inflation_24h;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_risk_incident_30d;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_risk_score; $$);

SELECT cron.schedule('mv_cost_refresh_15min', '*/15 * * * *',
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cost_per_tenant;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cost_per_feature;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cost_per_agent; $$);

SELECT cron.schedule('mv_joint_refresh_hourly', '0 * * * *',
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_unit_economics_outcome;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cost_per_incident_prevented;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_risk_adjusted_cost_per_outcome; $$);

SELECT cron.schedule('emit_quadrant_changes_hourly', '0 * * * *',
    $$ SELECT public.emit_quadrant_changes(); $$);

SELECT cron.schedule('cost_reservation_sweep_1min', '* * * * *',
    $$ SELECT public.cost_sweep_expired_reservations(); $$);
```

---

# Part E — Cross-Cutting

## §13 RLS & Grants

```sql
ALTER MATERIALIZED VIEW public.mv_tenant_risk_score                  ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_cost_per_tenant                    ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_cost_per_feature                   ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_cost_per_agent                     ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_unit_economics_outcome             ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_cost_per_incident_prevented        ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_risk_adjusted_cost_per_outcome     ENABLE ROW LEVEL SECURITY;

-- Pattern für alle: tenant_members lesen ihre Zeilen.
DROP POLICY IF EXISTS "racpo tenant-read" ON public.mv_risk_adjusted_cost_per_outcome;
CREATE POLICY "racpo tenant-read"
    ON public.mv_risk_adjusted_cost_per_outcome FOR SELECT
    USING (public.has_tenant_membership(tenant_id));
-- analog für die anderen.

REVOKE ALL ON FUNCTION public.cost_check_and_reserve(UUID,TEXT,NUMERIC,NUMERIC,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.propagate_cost_attribution(UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.propagate_compliance_taint(UUID,TEXT,TEXT,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_token_explosion(UUID,INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_consent_regression(UUID,INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emit_quadrant_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cost_sweep_expired_reservations() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cost_check_and_reserve(UUID,TEXT,NUMERIC,NUMERIC,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.propagate_cost_attribution(UUID,UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.propagate_compliance_taint(UUID,TEXT,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.detect_token_explosion(UUID,INTERVAL) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.detect_consent_regression(UUID,INTERVAL) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.emit_quadrant_changes() TO service_role;
GRANT EXECUTE ON FUNCTION public.cost_sweep_expired_reservations() TO service_role;
```

## §14 Compliance Mapping

| Anforderung | Quelle | Umsetzung in dieser RFC |
|---|---|---|
| Risk-Management dokumentiert | AI Act Art. 9 | §2 + RACPO §8 |
| Auditprotokoll Modell-Outputs | AI Act Art. 12 | Conclusions tragen `model_ref` + `feature_hash` + `derived_from` |
| Reproduzierbarkeit | AI Act Art. 13 | Determinismus-Vertrag §15 |
| Mißbrauchsprävention | EU AI Liability Directive Draft | Hard-Caps §6 + Backpressure |
| Auditierbarkeit Kosten | AI Act Art. 12 | Ledger append-only, Trail im `runtime_events` |
| Speicherbegrenzung | DSGVO Art. 5 (1) e | RFC-003 (Memory), Ledger ohne Klartext-PII |
| Backpressure statt Kill | NIS2 Art. 21 | §6.2 |
| Recht auf Erklärung | DSGVO Art. 22 | jeder joint-Event referenziert seine Quelle-MV-Zeilen |

## §15 Determinismus-Vertrag

Jeder Reader (Risk, Cost, Joint) ist **bit-identisch** reproduzierbar:

- kein `now()` innerhalb der Aggregat-Logik außer als `as_of`-Parameter
- kein Random ohne `replay_seed`
- keine externen HTTP-Calls ohne Cache + Hash
- Tie-Breaking explizit (z. B. „bei Score-Gleichstand niedrigeres
  `tenant_id`-UUID zuerst")

Verletzung ⇒ P0-Bug. Konsumenten zeigen `model_ref` + `feature_hash`
neben jedem Score; bei Hash-Mismatch ist die Aussage „unverified".

---

## §16 Acceptance Criteria

- [ ] Risk-Score-Komposition §2.1 normativ
- [ ] Subject-Risk real-time via AFTER-INSERT-Trigger
- [ ] Compliance-Taint-Propagation entlang causation-DAG §3
- [ ] Vier Anomaly-Detectoren §4
- [ ] Ledger append-only mit Attribution-Constraint §5
- [ ] Cost-Propagation entlang causation-DAG §5.1 idempotent
- [ ] Pre-Check + Reservation + Settle §6 atomar, Backpressure statt Kill
- [ ] T0-Events bypassen Throttle
- [ ] **RACPO §8.1 ist die normative Cost-Größe** — UI zeigt RACPO neben raw cost
- [ ] **Quadranten §9 sind Plattform-Entscheidungstool, nicht UI-Gimmick**
- [ ] Deprecation-Trigger §10 schreibt Audit-Event (nicht Auto-Disable)
- [ ] Cross-Tenant-View §11 nur über Super-Admin
- [ ] Joint-Events §12 verlinken auf alle Quell-MVs
- [ ] Cron Schedule §Part D idempotent
- [ ] RLS für **jede** MV (§13)
- [ ] Compliance-Matrix §14 ins `docs/compliance/`
- [ ] Determinismus-Vertrag §15 in CI getestet

---

## §17 Open Questions

1. **RACPO-Gewichtung** — `1 + risk_score/100` ist linear. Soll Risk
   quadratisch eingehen (exponentielle Bestrafung hoher Risiken)?
   Vorschlag: erst empirisch messen, dann tunen.

2. **Quadranten-Schwellen** — Risk-Schwelle 50 und Cost-Schwelle
   `1.5 × cohort_median`. Empirisch validieren nach 90 Tagen Daten.

3. **Vendor-Pricing-Tabelle** — separater RFC. RACPO hängt von
   `unit_price_usd`-Snapshot ab, der replay-stabil ist.

4. **Incident-Cost-Berechnung** — pauschal (low=10, medium=50, high=200,
   critical=1000 USD) oder tenant-konfigurierbar? v1.0: pauschal,
   v1.1 Override-Mechanismus.

5. **Memory-Cost-Berechnung** — `memory_byte_hour` × Storage-Tarif. Wie
   messen wir Memory-Cost-Anteile von Conversation vs. Knowledge?
   v1.0: einheitlich pro Bytes.

6. **RACPO bei sehr kleinen Tenants** — wenn `completed_7d < 10`,
   ist der Quotient instabil. Vorschlag: RACPO wird NULL ausgewiesen,
   wenn Sample-Größe < Threshold. Quadranten-Berechnung weicht dann
   auf 30d aus.

7. **Cap-Recovery nach Monatsturnus** — auto über `DATE_TRUNC`, aber
   `cost.cap_reset`-Audit-Event pro Monatsstart fehlt noch.

8. **PG-Version für RLS-auf-MV** — Supabase 15+ stützt das, ältere
   Versionen brauchen `security_invoker` Views.

---

## §18 Was diese RFC NICHT entscheidet

- ❌ Edge-Function-Implementierung der Cap-Middleware
- ❌ UI-Surfaces (Cost-Dashboard, Quadranten-Cockpit)
- ❌ Konkrete Vendor-Pricing-Tabelle (eigene RFC)
- ❌ Billing-Integration mit Stripe
- ❌ ML-Modell-Spec für Anomaly Detection
- ❌ Auto-Deprecation von Features (manueller Change-Prozess)

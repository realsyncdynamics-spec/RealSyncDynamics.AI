# RFC-004 — Governance Intelligence Kernel v1.0

**Status:** Draft v1.0 — Policy, Semantics, SQL artefacts
**Owner:** Governance Runtime
**Created:** 2026-05-21
**Companion to:** SPEC-001 (`runtime_events`), RFC-002 (`subject_ref`),
RFC-003 (Memory Policy), RFC-005 (Economic Control)

**Scope:** Konkretes Modell für Risk Scoring, Compliance Signals und
Anomaly Detection auf Basis des Event Backbones. Liefert Materialized
Views, Stored Procedures, RPCs, RLS-Verträge. Implementierung
(Edge-Functions, Cron, UI) folgt in eigenen PRs.

---

## §1 Zielbild

Drei Output-Streams, gespeist aus `runtime_events` + RFC-003-Memory:

1. **Risk Scoring** — kontinuierliche Skalare pro Tenant / Feature /
   Subject (real-time, nicht batch).
2. **Compliance Signals** — gerichtete Hinweise auf DSGVO/AI-Act/NIS2-
   Relevanz mit Taint-Propagation.
3. **Anomaly Detection** — punktuelle Auffälligkeiten (Token, Memory,
   Consent, Cost).

Alle drei schreiben Conclusions zurück als T0/T1-Events; nichts mutiert
am Backbone.

---

## §2 Risk Scoring Engine

### §2.1 Tenant Risk Score (0..100)

Komposition (gewichtete Summe, jeder Component normiert auf 0..100):

| Component | Gewicht | Quelle |
|---|---|---|
| Consent Violations | 0.30 | `tracker.pre_consent_detected` / 7d, korreliert mit Support-Tickets |
| AI Loop Depth | 0.20 | max `causation` DAG depth in einem `trace_id` |
| Memory Inflation Rate | 0.20 | Δ memory rows / Tenant / 24h |
| Incident Frequency × Severity | 0.30 | rolling 30d, `severity` als Multiplikator |

Formel:

```
tenant_risk_score =
    0.30 * consent_component +
    0.20 * ai_loop_component +
    0.20 * memory_inflation_component +
    0.30 * incident_component
```

Jeder Component-Wert ist clamp'd auf `[0, 100]`. Tie-Breaking
deterministisch: zuerst niedrigeres `tenant_id` UUID.

### §2.2 Per-Feature Risk

Identische Algebra, aber Group-By `flow_ref` statt `tenant_id`. Damit
sehen wir „welcher Flow ist riskant" pro Tenant.

### §2.3 Real-Time vs. Batch

| Aufgabe | Modus | Latenz-SLO |
|---|---|---|
| `subject_risk_score` (Refresh on `runtime_events` insert) | Trigger-based | < 500 ms p99 |
| `tenant_risk_score` | Materialized View, REFRESH every 15 min | 15 min |
| `feature_risk_score` | MV, REFRESH hourly | 1 h |

**Hard-Regel:** „Real-time" hier bedeutet **on-event** für Subject-Scoring,
nicht „sub-sekundlich für alle Aggregate". Aggregate brauchen MVs, sonst
kollabiert die Query-Performance.

### §2.4 SQL — Materialized Views

```sql
-- Component 1: Consent Violations / 7d
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_risk_consent_7d AS
SELECT
    tenant_id,
    COUNT(*)                                           AS violations,
    COUNT(*) FILTER (WHERE severity IN ('high','critical')) AS severe_violations,
    LEAST(100.0,
          COUNT(*) FILTER (WHERE severity IN ('high','critical')) * 5.0
        + COUNT(*) * 0.5
    )::numeric(5,2)                                    AS component_score,
    now()                                              AS computed_at
  FROM public.runtime_events
 WHERE type IN ('tracker.pre_consent_detected','consent.regression_detected')
   AND ts >= now() - INTERVAL '7 days'
 GROUP BY tenant_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_risk_consent_7d_pk
    ON public.mv_risk_consent_7d (tenant_id);

-- Component 2: AI Loop Depth (max causation chain in 24h)
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
     WHERE c.depth < 32       -- harte Cap gegen pathologische DAGs
       AND e.ts >= now() - INTERVAL '24 hours'
)
SELECT
    tenant_id,
    MAX(depth)                                  AS max_loop_depth,
    LEAST(100.0, MAX(depth) * 10.0)::numeric(5,2) AS component_score,
    now()                                       AS computed_at
  FROM chain
 GROUP BY tenant_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_risk_ai_loop_24h_pk
    ON public.mv_risk_ai_loop_24h (tenant_id);

-- Component 3: Memory Inflation Rate (Δ rows / 24h)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_risk_memory_inflation_24h AS
SELECT
    m.tenant_id,
    COUNT(*) FILTER (WHERE m.created_at >= now() - INTERVAL '24 hours') AS new_rows,
    COUNT(*) FILTER (WHERE m.created_at >= now() - INTERVAL '48 hours'
                       AND m.created_at <  now() - INTERVAL '24 hours') AS prev_rows,
    LEAST(100.0,
          GREATEST(0,
              (COUNT(*) FILTER (WHERE m.created_at >= now() - INTERVAL '24 hours')
             - COUNT(*) FILTER (WHERE m.created_at >= now() - INTERVAL '48 hours'
                                  AND m.created_at <  now() - INTERVAL '24 hours'))
              / NULLIF(COUNT(*) FILTER (WHERE m.created_at >= now() - INTERVAL '48 hours'
                                          AND m.created_at <  now() - INTERVAL '24 hours'), 0)
              * 50.0
          )
    )::numeric(5,2)                                                    AS component_score,
    now()                                                              AS computed_at
  FROM public.agent_memory m
 GROUP BY m.tenant_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_risk_memory_inflation_24h_pk
    ON public.mv_risk_memory_inflation_24h (tenant_id);

-- Component 4: Incident Frequency × Severity (30d)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_risk_incident_30d AS
SELECT
    tenant_id,
    COUNT(*)                                                  AS incident_count,
    SUM(CASE severity
            WHEN 'critical' THEN 25
            WHEN 'high'     THEN 10
            WHEN 'medium'   THEN 3
            WHEN 'low'      THEN 1
            ELSE 0
        END)                                                  AS weighted_score,
    LEAST(100.0,
          SUM(CASE severity
                  WHEN 'critical' THEN 25
                  WHEN 'high'     THEN 10
                  WHEN 'medium'   THEN 3
                  WHEN 'low'      THEN 1
                  ELSE 0
              END)
    )::numeric(5,2)                                          AS component_score,
    now()                                                    AS computed_at
  FROM public.runtime_events
 WHERE type IN ('incident.opened','incident.escalated','policy.violation_detected')
   AND ts >= now() - INTERVAL '30 days'
 GROUP BY tenant_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_risk_incident_30d_pk
    ON public.mv_risk_incident_30d (tenant_id);

-- Aggregat: Tenant Risk Score
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_tenant_risk_score AS
SELECT
    t.id AS tenant_id,
    COALESCE(c.component_score, 0)  AS consent_component,
    COALESCE(l.component_score, 0)  AS ai_loop_component,
    COALESCE(m.component_score, 0)  AS memory_inflation_component,
    COALESCE(i.component_score, 0)  AS incident_component,
    (  0.30 * COALESCE(c.component_score, 0)
     + 0.20 * COALESCE(l.component_score, 0)
     + 0.20 * COALESCE(m.component_score, 0)
     + 0.30 * COALESCE(i.component_score, 0)
    )::numeric(5,2)                  AS tenant_risk_score,
    encode(digest(
        format('tenant=%s|v1.0|c=%s|l=%s|m=%s|i=%s',
            t.id,
            COALESCE(c.component_score, 0),
            COALESCE(l.component_score, 0),
            COALESCE(m.component_score, 0),
            COALESCE(i.component_score, 0))::bytea,
        'sha256'
    ), 'hex')                        AS feature_hash,
    'tenant-risk-v1.0'               AS model_ref,
    now()                            AS computed_at
  FROM public.tenants t
  LEFT JOIN public.mv_risk_consent_7d           c ON c.tenant_id = t.id
  LEFT JOIN public.mv_risk_ai_loop_24h          l ON l.tenant_id = t.id
  LEFT JOIN public.mv_risk_memory_inflation_24h m ON m.tenant_id = t.id
  LEFT JOIN public.mv_risk_incident_30d         i ON i.tenant_id = t.id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_tenant_risk_score_pk
    ON public.mv_tenant_risk_score (tenant_id);

ALTER MATERIALIZED VIEW public.mv_tenant_risk_score OWNER TO postgres;
```

### §2.5 SQL — Stored Procedure: subject_risk_score (real-time)

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

    -- consent signal: pre-consent + regressions auf diesem Subject, 30d
    SELECT LEAST(100.0, COUNT(*) * 12.0)
      INTO v_consent
      FROM public.runtime_events
     WHERE tenant_id   = p_tenant_id
       AND subject_ref = p_subject_ref
       AND type IN ('tracker.pre_consent_detected','consent.regression_detected')
       AND ts BETWEEN p_as_of - INTERVAL '30 days' AND p_as_of;

    -- incident signal: incident.* mit diesem Subject, severity-gewichtet
    SELECT LEAST(100.0, SUM(
              CASE severity
                  WHEN 'critical' THEN 30
                  WHEN 'high'     THEN 12
                  WHEN 'medium'   THEN 4
                  ELSE 1
              END))
      INTO v_incident
      FROM public.runtime_events
     WHERE tenant_id   = p_tenant_id
       AND subject_ref = p_subject_ref
       AND type LIKE 'incident.%'
       AND ts BETWEEN p_as_of - INTERVAL '90 days' AND p_as_of;

    -- velocity signal: Burst-Erkennung (Events/min in den letzten 5min)
    SELECT LEAST(100.0, COUNT(*) * 3.0)
      INTO v_velocity
      FROM public.runtime_events
     WHERE tenant_id   = p_tenant_id
       AND subject_ref = p_subject_ref
       AND ts BETWEEN p_as_of - INTERVAL '5 minutes' AND p_as_of;

    RETURN QUERY SELECT
        p_subject_ref,
        ( 0.40 * COALESCE(v_consent, 0)
        + 0.40 * COALESCE(v_incident, 0)
        + 0.20 * COALESCE(v_velocity, 0)
        )::numeric(5,2),
        COALESCE(v_consent, 0),
        COALESCE(v_incident, 0),
        COALESCE(v_velocity, 0),
        encode(digest(
            format('subj=%s|v1.0|c=%s|i=%s|v=%s',
                p_subject_ref, COALESCE(v_consent,0),
                COALESCE(v_incident,0), COALESCE(v_velocity,0))::bytea,
            'sha256'
        ), 'hex'),
        'subject-risk-v1.0',
        p_as_of;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_subject_risk_score(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_subject_risk_score(UUID, TEXT, TIMESTAMPTZ)
    TO authenticated, service_role;
```

### §2.6 Real-Time Trigger

```sql
-- On every event with subject_ref, recompute subject score and emit
-- governance.risk_score_changed if delta > 10.
CREATE OR REPLACE FUNCTION public.on_event_recompute_subject_risk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_score  NUMERIC(5,2);
    v_prev   NUMERIC(5,2);
BEGIN
    IF NEW.subject_ref IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT (s).risk_score INTO v_score
      FROM public.compute_subject_risk_score(NEW.tenant_id, NEW.subject_ref) s;

    -- Vorheriger Score aus dem letzten governance.risk_score_changed-Event
    SELECT (payload->>'risk_score')::numeric INTO v_prev
      FROM public.runtime_events
     WHERE tenant_id   = NEW.tenant_id
       AND type        = 'governance.risk_score_changed'
       AND subject_ref = NEW.subject_ref
     ORDER BY tenant_seq DESC
     LIMIT 1;

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
             NEW.subject_ref, NEW.trace_id, NEW.id::uuid,
             jsonb_build_object(
                'risk_score',    v_score,
                'previous',      v_prev,
                'delta',         (v_score - COALESCE(v_prev, 0)),
                'model_ref',     'subject-risk-v1.0'
             ));
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger läuft AFTER INSERT, damit die Hash-Chain bereits stabil ist.
DROP TRIGGER IF EXISTS runtime_events_subject_risk ON public.runtime_events;
CREATE TRIGGER runtime_events_subject_risk
    AFTER INSERT ON public.runtime_events
    FOR EACH ROW
    WHEN (NEW.subject_ref IS NOT NULL AND NEW.source <> 'intelligence')
    EXECUTE FUNCTION public.on_event_recompute_subject_risk();
```

**Hinweis zur Rekursion:** Der `WHEN`-Filter `source <> 'intelligence'`
verhindert, dass die Risk-Events selbst weitere Recomputes auslösen.

---

## §3 Compliance Signal Pipeline

### §3.1 Signal-Typen

| Signal | Trigger-Event-Patterns | Severity-Mapping |
|---|---|---|
| `compliance.gdpr_signal` | `dsr.access_requested`, `dsr.erasure_requested`, `dsr.export_completed` | medium (default), high bei `erasure_*` |
| `compliance.ai_act_signal` | `ai.high_risk_use_case_detected`, `ai.classification_changed` | high (default), critical bei Hochrisiko-Kategorie |
| `compliance.nis2_signal` | `incident.escalated`, `security.breach_*` | severity = max(source severity, 'high') |

### §3.2 Taint-Propagation

Wenn ein `subject_ref` von einem Compliance-Signal getroffen wird, dann
**propagieren** wir das Taint-Flag entlang der `causation_id`-DAG:

```sql
CREATE OR REPLACE FUNCTION public.propagate_compliance_taint(
    p_tenant_id   UUID,
    p_subject_ref TEXT,
    p_signal_kind TEXT,
    p_root_event_id UUID
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    -- Alle Events, die vom Root-Event abhängig sind (causation-DAG forward)
    WITH RECURSIVE downstream AS (
        SELECT e.id, e.tenant_seq, 0 AS depth
          FROM public.runtime_events e
         WHERE e.id = p_root_event_id
        UNION ALL
        SELECT e.id, e.tenant_seq, d.depth + 1
          FROM public.runtime_events e
          JOIN downstream d ON e.causation_id = d.id
         WHERE d.depth < 64
    )
    INSERT INTO public.runtime_events
        (tenant_id, type, severity, source, review_status,
         subject_ref, causation_id, payload)
    SELECT
        p_tenant_id,
        'compliance.taint_propagated',
        'medium',
        'intelligence',
        'auto',
        p_subject_ref,
        d.id,
        jsonb_build_object(
            'signal_kind', p_signal_kind,
            'root_event',  p_root_event_id,
            'depth',       d.depth
        )
      FROM downstream d
     WHERE d.depth > 0;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
```

**Hard-Regel:** Taint-Propagation läuft **synchron mit dem Signal-Event**
und schreibt selbst ein neues `compliance.taint_propagated`-Event je
nachgelagertem Knoten — damit ist der gesamte Wirkungsradius im
Backbone dokumentiert.

### §3.3 Compliance-Signal-MV

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_compliance_signals_open AS
SELECT
    e.tenant_id,
    CASE
        WHEN e.type LIKE 'dsr.%'              THEN 'gdpr'
        WHEN e.type LIKE 'ai.%high_risk%'     THEN 'ai_act'
        WHEN e.type IN ('incident.escalated','security.breach_confirmed')
                                              THEN 'nis2'
        ELSE 'other'
    END                                       AS framework,
    e.subject_ref,
    e.severity,
    e.ts                                      AS opened_at,
    e.global_seq                              AS root_global_seq
  FROM public.runtime_events e
 WHERE e.type IN (
        'dsr.access_requested','dsr.erasure_requested',
        'ai.high_risk_use_case_detected','ai.classification_changed',
        'incident.escalated','security.breach_confirmed'
       )
   AND NOT EXISTS (
        SELECT 1 FROM public.runtime_events r
         WHERE r.tenant_id = e.tenant_id
           AND r.type = 'compliance.signal_closed'
           AND (r.payload->>'root_global_seq')::bigint = e.global_seq
       );

CREATE UNIQUE INDEX IF NOT EXISTS mv_compliance_signals_open_pk
    ON public.mv_compliance_signals_open (tenant_id, root_global_seq);
```

---

## §4 Anomaly Detection

### §4.1 Anomaly-Klassen

| Klasse | SQL-Signature | Severity |
|---|---|---|
| Token Explosion | LLM-Event mit Tokens > 4σ über Tenant-Baseline | high |
| Memory Decay Rate | Δ memory_state-Transitions/24h > 3× Baseline | medium |
| Consent Regression | `consent.granted` gefolgt von `tracker.pre_consent_detected` < 1h später | high |
| Cost-per-Outcome Explosion | Σ cost_units / completed_outcome > 5× rolling-30d | high |

### §4.2 Detector — Token Explosion

```sql
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
    WITH baseline AS (
        SELECT
            percentile_disc(0.99) WITHIN GROUP (ORDER BY total_tokens)::bigint AS p99,
            stddev_samp(total_tokens)                                          AS stddev,
            avg(total_tokens)                                                  AS mean
          FROM (
              SELECT trace_id,
                     SUM(((payload->>'input_tokens')::int +
                          (payload->>'output_tokens')::int))::bigint AS total_tokens
                FROM public.runtime_events
               WHERE tenant_id = p_tenant_id
                 AND type LIKE 'ai.%'
                 AND ts BETWEEN now() - INTERVAL '30 days' AND now() - p_window
                 AND trace_id IS NOT NULL
               GROUP BY trace_id
          ) traces
    ),
    current_window AS (
        SELECT trace_id,
               SUM(((payload->>'input_tokens')::int +
                    (payload->>'output_tokens')::int))::bigint AS total_tokens
          FROM public.runtime_events
         WHERE tenant_id = p_tenant_id
           AND type LIKE 'ai.%'
           AND ts >= now() - p_window
           AND trace_id IS NOT NULL
         GROUP BY trace_id
    )
    SELECT
        cw.trace_id,
        cw.total_tokens,
        b.p99,
        CASE WHEN b.stddev IS NULL OR b.stddev = 0
             THEN 0
             ELSE ((cw.total_tokens - b.mean) / b.stddev)::numeric(6,2) END,
        now()
      FROM current_window cw
      CROSS JOIN baseline b
     WHERE cw.total_tokens > b.p99
       AND (b.stddev IS NOT NULL AND b.stddev > 0
            AND (cw.total_tokens - b.mean) / b.stddev >= 4);
END;
$$;
```

### §4.3 Detector — Consent Regression

```sql
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
    WITH grants AS (
        SELECT subject_ref, ts AS granted_at
          FROM public.runtime_events
         WHERE tenant_id = p_tenant_id
           AND type      = 'consent.granted'
           AND ts        >= now() - p_window
    ),
    breaches AS (
        SELECT subject_ref, ts AS regressed_at, id
          FROM public.runtime_events
         WHERE tenant_id = p_tenant_id
           AND type      = 'tracker.pre_consent_detected'
           AND ts        >= now() - p_window
    )
    SELECT
        g.subject_ref,
        g.granted_at,
        b.regressed_at,
        b.regressed_at - g.granted_at AS lag,
        b.id
      FROM grants g
      JOIN breaches b
        ON b.subject_ref = g.subject_ref
       AND b.regressed_at > g.granted_at
       AND b.regressed_at - g.granted_at < INTERVAL '1 hour';
END;
$$;
```

### §4.4 Cost-per-Outcome Explosion

```sql
CREATE OR REPLACE FUNCTION public.detect_cost_per_outcome_explosion(
    p_tenant_id UUID
) RETURNS TABLE (
    flow_ref          TEXT,
    cost_per_outcome  NUMERIC(14,6),
    rolling_30d       NUMERIC(14,6),
    multiplier        NUMERIC(6,2)
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
    WITH outcomes AS (
        SELECT
            payload->>'flow_ref' AS flow_ref,
            DATE_TRUNC('day', ts) AS day,
            COUNT(*) FILTER (WHERE type = 'outcome.completed') AS completed,
            SUM(amount_usd)                                    AS spent
          FROM public.runtime_events e
          LEFT JOIN public.tenant_cost_ledger l USING (tenant_id, trace_id)
         WHERE e.tenant_id = p_tenant_id
           AND ts >= now() - INTERVAL '30 days'
           AND payload ? 'flow_ref'
         GROUP BY 1, 2
    )
    SELECT
        o.flow_ref,
        (SUM(o.spent) FILTER (WHERE o.day = CURRENT_DATE)
         / NULLIF(SUM(o.completed) FILTER (WHERE o.day = CURRENT_DATE), 0))::numeric(14,6),
        (SUM(o.spent) / NULLIF(SUM(o.completed), 0))::numeric(14,6),
        ((SUM(o.spent) FILTER (WHERE o.day = CURRENT_DATE)
            / NULLIF(SUM(o.completed) FILTER (WHERE o.day = CURRENT_DATE), 0))
         / NULLIF(SUM(o.spent) / NULLIF(SUM(o.completed), 0), 0))::numeric(6,2)
      FROM outcomes o
     GROUP BY o.flow_ref
    HAVING (SUM(o.spent) FILTER (WHERE o.day = CURRENT_DATE)
            / NULLIF(SUM(o.completed) FILTER (WHERE o.day = CURRENT_DATE), 0))
           >= 5 * (SUM(o.spent) / NULLIF(SUM(o.completed), 0));
END;
$$;
```

---

## §5 RLS & Grants

```sql
ALTER MATERIALIZED VIEW public.mv_tenant_risk_score                ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_risk_consent_7d                  ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_risk_ai_loop_24h                 ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_risk_memory_inflation_24h        ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_risk_incident_30d                ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.mv_compliance_signals_open          ENABLE ROW LEVEL SECURITY;

-- Tenant-Mitglieder lesen ihre eigenen Aggregate.
DROP POLICY IF EXISTS "mv_tenant_risk_score tenant-read" ON public.mv_tenant_risk_score;
CREATE POLICY "mv_tenant_risk_score tenant-read"
    ON public.mv_tenant_risk_score FOR SELECT
    USING (public.has_tenant_membership(tenant_id));

-- gleiche Policy auf alle anderen MVs (sinngemäß)

REVOKE ALL ON FUNCTION public.propagate_compliance_taint(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propagate_compliance_taint(UUID, TEXT, TEXT, UUID)
    TO service_role;

REVOKE ALL ON FUNCTION public.detect_token_explosion(UUID, INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_consent_regression(UUID, INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_cost_per_outcome_explosion(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_token_explosion(UUID, INTERVAL)
    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.detect_consent_regression(UUID, INTERVAL)
    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.detect_cost_per_outcome_explosion(UUID)
    TO authenticated, service_role;
```

---

## §6 Refresh-Schedule

```sql
SELECT cron.schedule(
    'mv_tenant_risk_refresh_15min',
    '*/15 * * * *',
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_risk_consent_7d;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_risk_ai_loop_24h;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_risk_memory_inflation_24h;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_risk_incident_30d;
       REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_risk_score;
    $$
);

SELECT cron.schedule(
    'mv_compliance_signals_refresh',
    '*/5 * * * *',
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_compliance_signals_open; $$
);

SELECT cron.schedule(
    'anomaly_detectors_15min',
    '*/15 * * * *',
    $$ INSERT INTO public.runtime_events
         (tenant_id, type, severity, source, review_status, payload)
       SELECT t.id, 'governance.anomaly_detected', 'high', 'intelligence', 'auto',
              jsonb_build_object('kind','token_explosion','data', row_to_json(x))
         FROM public.tenants t,
              public.detect_token_explosion(t.id) x;
    $$
);
```

---

## §7 Acceptance Criteria

- [ ] Risk-Score-Komposition (§2.1) ist normativ
- [ ] `subject_risk_score` real-time via AFTER-INSERT-Trigger
- [ ] Compliance-Signal-Pipeline mit Taint-Propagation (§3.2)
- [ ] Vier Anomaly-Detectoren §4.1–§4.4 implementiert
- [ ] Alle Conclusions tragen `model_ref` + `feature_hash`
- [ ] MVs sind RLS-isoliert (§5)
- [ ] Cron-Refresh schedule §6 idempotent
- [ ] Re-Computation deterministisch (gleiche Inputs ⇒ gleicher Output)
- [ ] Conclusions als T0/T1-Events in `runtime_events` (hashed)

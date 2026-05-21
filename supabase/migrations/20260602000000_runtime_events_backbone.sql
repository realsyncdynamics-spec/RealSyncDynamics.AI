-- SPEC-001 FINAL — Operational Event Backbone (Phase 1)
--
-- Vollständige, produktionsreife PostgreSQL DDL.
--
-- Supersedes the Phase-0 runtime_events from 20260516300000_runtime_core.sql.
-- The old table is renamed to runtime_events_legacy_phase0 so historic rows
-- and references survive; new code targets the partitioned successor below.
--
-- Decisions implemented (in order):
--   1. Hybrid JSONB model — typed envelope columns + JSONB payload + JSONB
--      evidence_refs.
--   2. Append-Only enforcement — SECURITY DEFINER reject-triggers for UPDATE
--      and DELETE on the partitioned parent.
--   3. RLS over public.tenant_memberships (not naive auth.uid() checks).
--   4. Replay cursor based on global_seq (monotone BIGINT), not timestamps.
--   5. Event version negotiation — spec_version is mandatory, semver MAJOR.MINOR.
--   6. tenant_memberships table — RLS substrate, backfilled from existing
--      public.memberships when present.
--   7. Indexes covering tenant+timestamp, subject correlation, and type+status.
--
-- All objects are idempotent (CREATE IF NOT EXISTS / DROP-then-CREATE for
-- policies). The whole script runs inside a single transaction; on any error
-- the database stays on the pre-migration schema.

BEGIN;

-- ============================================================
-- 0. Phase-0 fork: preserve old runtime_events (lossless)
-- ============================================================
-- The Phase-0 table has the same name but a different shape (bigserial PK,
-- no partitioning, different columns). Rename instead of drop so existing
-- rows + grants survive. Code that still talks to the old name will fail
-- loudly — exactly what we want for a coordinated cut-over.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = 'runtime_events'
           AND c.relkind = 'r' -- ordinary table (not partitioned parent)
    ) THEN
        EXECUTE 'ALTER TABLE public.runtime_events '
             || 'RENAME TO runtime_events_legacy_phase0';
    END IF;
END;
$$;


-- ============================================================
-- 6. tenant_memberships — RLS substrate
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
    tenant_id   UUID         NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id     UUID         NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
    role        TEXT         NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner','admin','member','viewer')),
    granted_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS tenant_memberships_user_idx
    ON public.tenant_memberships (user_id);
CREATE INDEX IF NOT EXISTS tenant_memberships_role_idx
    ON public.tenant_memberships (tenant_id, role);

-- Backfill from the existing memberships table so RLS keeps working without
-- a separate data migration. Safe across runs (PK conflicts ignored).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'memberships'
    ) THEN
        INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
        SELECT tenant_id, user_id, role
          FROM public.memberships
        ON CONFLICT (tenant_id, user_id) DO NOTHING;
    END IF;
END;
$$;

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

-- Users see only their own membership rows. Cross-tenant introspection goes
-- through the SECURITY DEFINER helper below to avoid recursive RLS.
DROP POLICY IF EXISTS "tenant_memberships self-read" ON public.tenant_memberships;
CREATE POLICY "tenant_memberships self-read"
    ON public.tenant_memberships FOR SELECT
    USING (user_id = auth.uid());

-- Writes are service-role only (service-role bypasses RLS).
DROP POLICY IF EXISTS "tenant_memberships deny-writes" ON public.tenant_memberships;
CREATE POLICY "tenant_memberships deny-writes"
    ON public.tenant_memberships FOR ALL
    USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.has_tenant_membership(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.tenant_memberships
         WHERE tenant_id = p_tenant_id
           AND user_id   = auth.uid()
    );
$$;

COMMENT ON FUNCTION public.has_tenant_membership(UUID) IS
    'SPEC-001 RLS helper. Returns true iff auth.uid() is a member of the '
    'given tenant. SECURITY DEFINER to avoid RLS recursion.';


-- ============================================================
-- 1+5+7. Sequences, counters, runtime_events parent table
-- ============================================================

-- Global, runtime-wide monotonic sequence (Decision 4: cursor basis).
CREATE SEQUENCE IF NOT EXISTS public.runtime_events_global_seq AS BIGINT;

-- Per-tenant monotone counter. Allocated by BEFORE-INSERT trigger below
-- under an advisory lock on the tenant key, so tenant_seq is gap-free per
-- tenant even at high concurrency.
CREATE TABLE IF NOT EXISTS public.runtime_event_tenant_counters (
    tenant_id  UUID    PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    last_seq   BIGINT  NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.runtime_event_tenant_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "runtime_event_tenant_counters service-role only"
    ON public.runtime_event_tenant_counters;
CREATE POLICY "runtime_event_tenant_counters service-role only"
    ON public.runtime_event_tenant_counters FOR ALL
    USING (false) WITH CHECK (false);


-- The event log itself.
CREATE TABLE IF NOT EXISTS public.runtime_events (
    -- Immutable identity --------------------------------------------------
    global_seq      BIGINT       NOT NULL
                      DEFAULT nextval('public.runtime_events_global_seq'),
    tenant_seq      BIGINT       NOT NULL,        -- set by BEFORE-INSERT trigger
    id              UUID         NOT NULL DEFAULT gen_random_uuid(),

    -- Version negotiation (Decision 5) -----------------------------------
    spec_version    TEXT         NOT NULL DEFAULT '1.0'
                      CHECK (spec_version ~ '^[0-9]+\.[0-9]+$'),

    -- Typed envelope (Decision 1) ----------------------------------------
    tenant_id       UUID         NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ts              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    ingested_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    type            TEXT         NOT NULL
                      CHECK (type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
    severity        TEXT         NOT NULL DEFAULT 'info'
                      CHECK (severity IN ('info','low','medium','high','critical')),
    source          TEXT         NOT NULL
                      CHECK (length(source) BETWEEN 1 AND 128),
    review_status   TEXT         NOT NULL DEFAULT 'auto'
                      CHECK (review_status IN
                            ('auto','pending','approved','rejected','escalated')),

    -- Subject (HMAC'd reference; never plaintext PII)
    subject_ref     TEXT
                      CHECK (subject_ref IS NULL OR length(subject_ref) BETWEEN 8 AND 256),

    -- Tier (Decision 7 of the spec discussion; drives retention + replay)
    event_tier      TEXT         NOT NULL DEFAULT 'T1'
                      CHECK (event_tier IN ('T0','T1','T2','T3')),

    -- Free-form fields (Decision 1) --------------------------------------
    payload         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    evidence_refs   JSONB        NOT NULL DEFAULT '[]'::jsonb
                      CHECK (jsonb_typeof(evidence_refs) = 'array'),

    -- Correlation / causation DAG
    trace_id        UUID,
    correlation_id  UUID,
    causation_id    UUID,

    -- PK includes partition key (Postgres requirement for partitioned tables)
    PRIMARY KEY (global_seq, ts)
)
PARTITION BY RANGE (ts);

ALTER SEQUENCE public.runtime_events_global_seq
    OWNED BY public.runtime_events.global_seq;

COMMENT ON TABLE  public.runtime_events IS
    'SPEC-001 Operational Event Backbone. Append-only, monthly-partitioned, '
    'RLS via tenant_memberships. Replay cursor is global_seq.';
COMMENT ON COLUMN public.runtime_events.global_seq IS
    'Runtime-wide monotone sequence. Cursor for replay & subscriptions.';
COMMENT ON COLUMN public.runtime_events.tenant_seq IS
    'Per-tenant monotone counter. Allocated under advisory lock at insert.';
COMMENT ON COLUMN public.runtime_events.spec_version IS
    'Envelope version, semver MAJOR.MINOR. Consumers MUST reject unknown MAJOR.';
COMMENT ON COLUMN public.runtime_events.subject_ref IS
    'Opaque subject reference (e.g. HMAC of email/IP/user_id). Never plaintext.';
COMMENT ON COLUMN public.runtime_events.evidence_refs IS
    'JSONB array of {evidence_id, sha256, kind} pointers. Snapshot at insert.';


-- ============================================================
-- 7. Indexes — Tenant+Timestamp, Subject Correlation, Type+Status
-- ============================================================
-- Indexes on the partitioned parent propagate to all current/future partitions.

-- Tenant + time scan (read-heavy default)
CREATE INDEX IF NOT EXISTS runtime_events_tenant_ts_idx
    ON public.runtime_events (tenant_id, ts DESC);

-- Replay scan (global_seq is the cursor)
CREATE INDEX IF NOT EXISTS runtime_events_global_seq_idx
    ON public.runtime_events (global_seq);
CREATE INDEX IF NOT EXISTS runtime_events_tenant_seq_idx
    ON public.runtime_events (tenant_id, tenant_seq);

-- Type + status filtering (triage & dashboards)
CREATE INDEX IF NOT EXISTS runtime_events_type_status_idx
    ON public.runtime_events (tenant_id, type, review_status, ts DESC);
CREATE INDEX IF NOT EXISTS runtime_events_severity_idx
    ON public.runtime_events (tenant_id, severity, ts DESC)
    WHERE severity IN ('high','critical');

-- Subject correlation (DSR lookups, forensics)
CREATE INDEX IF NOT EXISTS runtime_events_subject_ref_idx
    ON public.runtime_events (subject_ref)
    WHERE subject_ref IS NOT NULL;

-- Trace / correlation / causation DAG walks
CREATE INDEX IF NOT EXISTS runtime_events_trace_idx
    ON public.runtime_events (trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS runtime_events_correlation_idx
    ON public.runtime_events (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS runtime_events_causation_idx
    ON public.runtime_events (causation_id) WHERE causation_id IS NOT NULL;

-- Tier-scoped reads (audit vs. operational dashboards)
CREATE INDEX IF NOT EXISTS runtime_events_tier_idx
    ON public.runtime_events (tenant_id, event_tier, ts DESC);

-- Payload search (rare but cheap to keep)
CREATE INDEX IF NOT EXISTS runtime_events_payload_gin
    ON public.runtime_events USING GIN (payload jsonb_path_ops);
CREATE INDEX IF NOT EXISTS runtime_events_evidence_refs_gin
    ON public.runtime_events USING GIN (evidence_refs jsonb_path_ops);


-- ============================================================
-- Monthly partition helper + bootstrap
-- ============================================================
CREATE OR REPLACE FUNCTION public.runtime_events_ensure_partition(p_month TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_start DATE := date_trunc('month', p_month)::date;
    v_end   DATE := (v_start + INTERVAL '1 month')::date;
    v_name  TEXT := format('runtime_events_%s', to_char(v_start, 'YYYYMM'));
    v_qname TEXT := format('public.%I', v_name);
BEGIN
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %s PARTITION OF public.runtime_events '
        'FOR VALUES FROM (%L) TO (%L)',
        v_qname, v_start::text, v_end::text
    );
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_qname);
    RETURN v_name;
END;
$$;

COMMENT ON FUNCTION public.runtime_events_ensure_partition(TIMESTAMPTZ) IS
    'Idempotently create the monthly partition covering the given timestamp. '
    'Schedule via cron to keep ~12 months of future partitions ready.';

-- Bootstrap: previous month, current month, next 6 months.
DO $$
DECLARE m INT;
BEGIN
    FOR m IN -1..6 LOOP
        PERFORM public.runtime_events_ensure_partition(
            now() + (m::text || ' months')::interval
        );
    END LOOP;
END;
$$;


-- ============================================================
-- tenant_seq allocator (BEFORE INSERT)
-- ============================================================
CREATE OR REPLACE FUNCTION public.runtime_events_alloc_tenant_seq()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_next BIGINT;
BEGIN
    -- Advisory lock keyed on tenant_id keeps concurrent inserts ordered
    -- without locking the whole table.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(NEW.tenant_id::text, 11953384275872::bigint)
    );

    INSERT INTO public.runtime_event_tenant_counters AS c
        (tenant_id, last_seq, updated_at)
    VALUES
        (NEW.tenant_id, 1, now())
    ON CONFLICT (tenant_id) DO UPDATE
        SET last_seq   = c.last_seq + 1,
            updated_at = now()
    RETURNING last_seq INTO v_next;

    NEW.tenant_seq := v_next;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS runtime_events_alloc_tenant_seq ON public.runtime_events;
CREATE TRIGGER runtime_events_alloc_tenant_seq
    BEFORE INSERT ON public.runtime_events
    FOR EACH ROW
    EXECUTE FUNCTION public.runtime_events_alloc_tenant_seq();


-- ============================================================
-- 2. Append-Only Enforcement
-- ============================================================
CREATE OR REPLACE FUNCTION public.runtime_events_block_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION
        'runtime_events is append-only — % rejected on table %',
        TG_OP, TG_TABLE_NAME
        USING ERRCODE = '42501',
              HINT    = 'Retention purges drop entire partitions; bypass row triggers by design.';
END;
$$;

COMMENT ON FUNCTION public.runtime_events_block_mutation() IS
    'SPEC-001 append-only guard. UPDATE/DELETE always raise 42501. Partition '
    'DROP for retention is unaffected because it does not fire row triggers.';

DROP TRIGGER IF EXISTS runtime_events_no_update ON public.runtime_events;
CREATE TRIGGER runtime_events_no_update
    BEFORE UPDATE ON public.runtime_events
    FOR EACH ROW
    EXECUTE FUNCTION public.runtime_events_block_mutation();

DROP TRIGGER IF EXISTS runtime_events_no_delete ON public.runtime_events;
CREATE TRIGGER runtime_events_no_delete
    BEFORE DELETE ON public.runtime_events
    FOR EACH ROW
    EXECUTE FUNCTION public.runtime_events_block_mutation();

-- Belt-and-braces grant revoke; service-role bypasses RLS but cannot bypass
-- the trigger above.
REVOKE UPDATE, DELETE ON public.runtime_events FROM PUBLIC;


-- ============================================================
-- 3. RLS — runtime_events
-- ============================================================
ALTER TABLE public.runtime_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "runtime_events tenant-read" ON public.runtime_events;
CREATE POLICY "runtime_events tenant-read"
    ON public.runtime_events FOR SELECT
    USING (public.has_tenant_membership(tenant_id));

-- Writes (INSERT only) require service-role. We deny via RLS for every other
-- caller; the append-only triggers cover UPDATE/DELETE.
DROP POLICY IF EXISTS "runtime_events deny-writes" ON public.runtime_events;
CREATE POLICY "runtime_events deny-writes"
    ON public.runtime_events FOR INSERT
    WITH CHECK (false);


-- ============================================================
-- 4. Replay Cursor — global_seq based
-- ============================================================
CREATE TABLE IF NOT EXISTS public.runtime_event_cursors (
    tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    consumer          TEXT        NOT NULL
                        CHECK (consumer ~ '^[a-z][a-z0-9_.-]{0,127}$'),
    -- BIGINT cursor: simple > comparison; monotone under append-only inserts.
    last_global_seq   BIGINT      NOT NULL DEFAULT 0,
    last_spec_version TEXT        NOT NULL DEFAULT '1.0'
                        CHECK (last_spec_version ~ '^[0-9]+\.[0-9]+$'),
    events_consumed   BIGINT      NOT NULL DEFAULT 0,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, consumer)
);

CREATE INDEX IF NOT EXISTS runtime_event_cursors_updated_idx
    ON public.runtime_event_cursors (updated_at DESC);

COMMENT ON TABLE public.runtime_event_cursors IS
    'Per (tenant, consumer) replay cursor. Resume with: '
    'SELECT ... FROM public.runtime_events '
    'WHERE tenant_id = ? AND global_seq > ? ORDER BY global_seq LIMIT ?.';

ALTER TABLE public.runtime_event_cursors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "runtime_event_cursors tenant-read" ON public.runtime_event_cursors;
CREATE POLICY "runtime_event_cursors tenant-read"
    ON public.runtime_event_cursors FOR SELECT
    USING (public.has_tenant_membership(tenant_id));

DROP POLICY IF EXISTS "runtime_event_cursors deny-writes" ON public.runtime_event_cursors;
CREATE POLICY "runtime_event_cursors deny-writes"
    ON public.runtime_event_cursors FOR INSERT
    WITH CHECK (false);

DROP POLICY IF EXISTS "runtime_event_cursors deny-updates" ON public.runtime_event_cursors;
CREATE POLICY "runtime_event_cursors deny-updates"
    ON public.runtime_event_cursors FOR UPDATE
    USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.runtime_events_advance_cursor(
    p_tenant_id      UUID,
    p_consumer       TEXT,
    p_global_seq     BIGINT,
    p_spec_version   TEXT,
    p_increment      BIGINT DEFAULT 1
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows_affected INT := 0;
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden: caller is not a member of tenant %', p_tenant_id
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.runtime_event_cursors AS c
        (tenant_id, consumer, last_global_seq, last_spec_version, events_consumed)
    VALUES
        (p_tenant_id, p_consumer, p_global_seq, p_spec_version, p_increment)
    ON CONFLICT (tenant_id, consumer) DO UPDATE
        SET last_global_seq   = EXCLUDED.last_global_seq,
            last_spec_version = EXCLUDED.last_spec_version,
            events_consumed   = c.events_consumed + EXCLUDED.events_consumed,
            updated_at        = now()
        WHERE EXCLUDED.last_global_seq > c.last_global_seq;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RETURN v_rows_affected > 0;
END;
$$;

COMMENT ON FUNCTION public.runtime_events_advance_cursor(
    UUID, TEXT, BIGINT, TEXT, BIGINT
) IS
    'Atomic monotone cursor advance. Rejects rewinds. Returns true on advance, '
    'false if the supplied global_seq is not strictly greater than stored.';


-- ============================================================
-- Grants
-- ============================================================
REVOKE ALL ON FUNCTION public.runtime_events_advance_cursor(
    UUID, TEXT, BIGINT, TEXT, BIGINT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.runtime_events_advance_cursor(
    UUID, TEXT, BIGINT, TEXT, BIGINT
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.runtime_events_ensure_partition(TIMESTAMPTZ)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.runtime_events_ensure_partition(TIMESTAMPTZ)
    TO service_role;

REVOKE ALL ON FUNCTION public.has_tenant_membership(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_tenant_membership(UUID)
    TO authenticated, service_role;

COMMIT;

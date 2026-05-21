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
--   7. Cryptographic integrity — per-tenant SHA-256 hash chain (prev_hash +
--      event_hash) computed atomically inside the tenant_seq trigger.
--      Verifier RPC reproduces the chain for audit.
--
-- Indexes cover tenant+timestamp, subject correlation, type+status, severity,
-- and hash-chain walks.
--
-- All objects are idempotent (CREATE IF NOT EXISTS / DROP-then-CREATE for
-- policies). The whole script runs inside a single transaction; on any error
-- the database stays on the pre-migration schema.

BEGIN;

-- pgcrypto provides digest() / hmac() — required for the hash chain (#7)
-- and for the upcoming subject_ref HMAC pipeline.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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

    -- Free-form fields (Decision 1) --------------------------------------
    payload         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    evidence_refs   JSONB        NOT NULL DEFAULT '[]'::jsonb
                      CHECK (jsonb_typeof(evidence_refs) = 'array'),

    -- Correlation / causation DAG
    trace_id        UUID,
    correlation_id  UUID,
    causation_id    UUID,

    -- Cryptographic integrity (Decision 7) -------------------------------
    -- Per-tenant hash chain: event_hash = sha256(canonical(envelope, prev_hash))
    -- prev_hash is NULL for the first event in a tenant (genesis).
    prev_hash       BYTEA
                      CHECK (prev_hash IS NULL OR octet_length(prev_hash) = 32),
    event_hash      BYTEA        NOT NULL
                      CHECK (octet_length(event_hash) = 32),

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
COMMENT ON COLUMN public.runtime_events.prev_hash IS
    'SHA-256 of the previous event in the per-tenant chain. NULL on genesis.';
COMMENT ON COLUMN public.runtime_events.event_hash IS
    'SHA-256 of the canonical event bytes including prev_hash. Tamper-evident.';


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

-- Hash-chain walks reuse runtime_events_tenant_seq_idx above.

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
-- 7. Cryptographic integrity — canonical bytes + chain helpers
-- ============================================================
-- Deterministic byte representation of an event for hashing.
-- jsonb sorts keys canonically on text-cast, so the byte sequence is
-- stable across producers/PG versions for identical logical inputs.
CREATE OR REPLACE FUNCTION public.runtime_events_canonical_bytes(
    p_id              UUID,
    p_tenant_id       UUID,
    p_global_seq      BIGINT,
    p_tenant_seq      BIGINT,
    p_spec_version    TEXT,
    p_ts              TIMESTAMPTZ,
    p_type            TEXT,
    p_severity        TEXT,
    p_source          TEXT,
    p_review_status   TEXT,
    p_subject_ref     TEXT,
    p_payload         JSONB,
    p_evidence_refs   JSONB,
    p_trace_id        UUID,
    p_correlation_id  UUID,
    p_causation_id    UUID,
    p_prev_hash       BYTEA
) RETURNS BYTEA
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT convert_to(
        jsonb_build_object(
            'id',             p_id,
            'tenant_id',      p_tenant_id,
            'global_seq',     p_global_seq,
            'tenant_seq',     p_tenant_seq,
            'spec_version',   p_spec_version,
            'ts',             to_char(p_ts AT TIME ZONE 'UTC',
                                      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
            'type',           p_type,
            'severity',       p_severity,
            'source',         p_source,
            'review_status',  p_review_status,
            'subject_ref',    p_subject_ref,
            'payload',        p_payload,
            'evidence_refs',  p_evidence_refs,
            'trace_id',       p_trace_id,
            'correlation_id', p_correlation_id,
            'causation_id',   p_causation_id,
            'prev_hash',      CASE WHEN p_prev_hash IS NULL
                                   THEN NULL ELSE encode(p_prev_hash, 'hex') END
        )::text,
        'UTF8'
    );
$$;

COMMENT ON FUNCTION public.runtime_events_canonical_bytes(
    UUID, UUID, BIGINT, BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT,
    JSONB, JSONB, UUID, UUID, UUID, BYTEA
) IS
    'Canonical UTF-8 byte representation of a runtime_events row, used as '
    'sha256 input for the integrity chain. IMMUTABLE — must stay identical '
    'across producers; bumping its output is a hard fork of the chain.';


-- Combined allocator: tenant_seq + prev_hash lookup + event_hash compute,
-- all under one advisory lock per tenant so the chain is gap-free and
-- monotone even at high concurrency.
CREATE OR REPLACE FUNCTION public.runtime_events_alloc_seq_and_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_next       BIGINT;
    v_prev_hash  BYTEA;
BEGIN
    -- Per-tenant advisory lock — serializes the chain without table-locking.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(NEW.tenant_id::text, 11953384275872::bigint)
    );

    -- 1. Allocate tenant_seq atomically.
    INSERT INTO public.runtime_event_tenant_counters AS c
        (tenant_id, last_seq, updated_at)
    VALUES
        (NEW.tenant_id, 1, now())
    ON CONFLICT (tenant_id) DO UPDATE
        SET last_seq   = c.last_seq + 1,
            updated_at = now()
    RETURNING last_seq INTO v_next;

    NEW.tenant_seq := v_next;

    -- 2. Look up prev_hash from the immediately preceding event.
    --    NULL on genesis (first event for the tenant).
    IF v_next > 1 THEN
        SELECT event_hash INTO v_prev_hash
          FROM public.runtime_events
         WHERE tenant_id  = NEW.tenant_id
           AND tenant_seq = v_next - 1;
        IF v_prev_hash IS NULL THEN
            RAISE EXCEPTION
                'chain corruption: missing event_hash for tenant=% seq=%',
                NEW.tenant_id, v_next - 1
                USING ERRCODE = 'data_exception';
        END IF;
    END IF;

    NEW.prev_hash := v_prev_hash;

    -- 3. Compute event_hash over the canonical envelope incl. prev_hash.
    NEW.event_hash := extensions.digest(
        public.runtime_events_canonical_bytes(
            NEW.id,             NEW.tenant_id,    NEW.global_seq, NEW.tenant_seq,
            NEW.spec_version,   NEW.ts,           NEW.type,       NEW.severity,
            NEW.source,         NEW.review_status, NEW.subject_ref,
            NEW.payload,        NEW.evidence_refs,
            NEW.trace_id,       NEW.correlation_id, NEW.causation_id,
            v_prev_hash
        ),
        'sha256'
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS runtime_events_alloc_seq_and_chain ON public.runtime_events;
CREATE TRIGGER runtime_events_alloc_seq_and_chain
    BEFORE INSERT ON public.runtime_events
    FOR EACH ROW
    EXECUTE FUNCTION public.runtime_events_alloc_seq_and_chain();


-- Verifier: re-derives event_hash for each row in [from_seq, to_seq] and
-- compares it to the stored value, plus checks prev_hash continuity.
-- Returns one row per inspected event. Membership-gated.
CREATE OR REPLACE FUNCTION public.runtime_events_verify_chain(
    p_tenant_id  UUID,
    p_from_seq   BIGINT DEFAULT 1,
    p_to_seq     BIGINT DEFAULT NULL
) RETURNS TABLE (
    tenant_seq     BIGINT,
    valid          BOOLEAN,
    expected_hash  TEXT,
    actual_hash    TEXT,
    chain_ok       BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden: caller is not a member of tenant %', p_tenant_id
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH chain AS (
        SELECT
            e.tenant_seq,
            e.prev_hash,
            e.event_hash,
            LAG(e.event_hash) OVER (ORDER BY e.tenant_seq) AS expected_prev_hash,
            extensions.digest(
                public.runtime_events_canonical_bytes(
                    e.id, e.tenant_id, e.global_seq, e.tenant_seq,
                    e.spec_version, e.ts, e.type, e.severity, e.source,
                    e.review_status, e.subject_ref, e.payload, e.evidence_refs,
                    e.trace_id, e.correlation_id, e.causation_id, e.prev_hash
                ),
                'sha256'
            ) AS recomputed
          FROM public.runtime_events e
         WHERE e.tenant_id = p_tenant_id
           AND e.tenant_seq BETWEEN p_from_seq
                              AND COALESCE(p_to_seq, 9223372036854775807)
         ORDER BY e.tenant_seq
    )
    SELECT
        c.tenant_seq,
        (c.event_hash = c.recomputed)                          AS valid,
        encode(c.recomputed, 'hex')                            AS expected_hash,
        encode(c.event_hash, 'hex')                            AS actual_hash,
        (c.tenant_seq = 1 AND c.prev_hash IS NULL)
          OR (c.tenant_seq > 1 AND c.prev_hash = c.expected_prev_hash) AS chain_ok
      FROM chain c;
END;
$$;

COMMENT ON FUNCTION public.runtime_events_verify_chain(UUID, BIGINT, BIGINT) IS
    'Replays the per-tenant SHA-256 hash chain and reports per-event validity. '
    'Membership-gated. A single false in (valid, chain_ok) indicates tampering.';


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

REVOKE ALL ON FUNCTION public.runtime_events_verify_chain(UUID, BIGINT, BIGINT)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.runtime_events_verify_chain(UUID, BIGINT, BIGINT)
    TO authenticated, service_role;

COMMIT;

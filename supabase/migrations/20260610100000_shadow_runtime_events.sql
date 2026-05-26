-- P1-impl-1 — shadow_runtime_events Schema + RLS
-- (docs/architecture/runtime-kernel-rfc.md §P1.4 + §6 P1-impl-1)
--
-- Mirror of the runtime_events envelope used by shadow-mode replays
-- (see §P1.2). Shadow rows hold the result of a replay attempt — they
-- MUST NOT bleed into the canonical event stream and MUST NOT be
-- writable by anything except the replay machinery (which runs as
-- service_role inside an Edge Function).
--
-- Deviations from the RFC §P1.4 sketch — documented:
--
--   • The RFC sketch uses `original_id BIGINT REFERENCES runtime_events(id)`.
--     After SPEC-001 (20260602100000_runtime_events_backbone.sql),
--     runtime_events is RANGE-partitioned by `ts` and its primary key is
--     `(global_seq, ts)`. PG requires FK targets to be unique on a single
--     non-composite column, so a single-column FK against the partitioned
--     parent is impossible. We use `original_global_seq BIGINT` (matches
--     SPEC-001 nomenclature — global_seq is the canonical row id) WITHOUT
--     an FK constraint. Replay readers handle orphans (row deleted in the
--     interim) gracefully; the alternative would be a denormalized
--     composite FK (global_seq, ts) which provides no additional safety
--     since shadow rows are bounded by P4.3's monthly cap of 100 replays.
--
--   • event_tier is NULL-tolerant, matching the RFC: shadow replays may
--     mirror pre-kernel-v1 events that have no tier assigned.

CREATE TABLE IF NOT EXISTS public.shadow_runtime_events (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    original_global_seq BIGINT,

    -- Mirror of runtime_events kernel-v1 envelope ------------------------
    event_type          TEXT,
    event_tier          TEXT,
    subject_ref         TEXT,
    agent_ref           TEXT,
    trace_id            UUID,
    correlation_id      UUID,
    causation_id        UUID,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    cost_snapshot_json  JSONB,

    -- Replay metadata ----------------------------------------------------
    replay_run_id       UUID NOT NULL,
    replayed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- diff vs the original: { payload_changed, cost_delta, side_effects_skipped[] }
    diff_vs_original    JSONB
);

CREATE INDEX IF NOT EXISTS shadow_runtime_events_run_idx
    ON public.shadow_runtime_events (replay_run_id);
CREATE INDEX IF NOT EXISTS shadow_runtime_events_original_idx
    ON public.shadow_runtime_events (original_global_seq)
    WHERE original_global_seq IS NOT NULL;
CREATE INDEX IF NOT EXISTS shadow_runtime_events_tenant_time_idx
    ON public.shadow_runtime_events (tenant_id, replayed_at DESC);

ALTER TABLE public.shadow_runtime_events ENABLE ROW LEVEL SECURITY;

-- Default-deny for ALL roles. The replay machinery uses the
-- service_role key which bypasses RLS entirely; no other role
-- (anon, authenticated, dashboard) should ever see shadow rows
-- because they describe what-if scenarios, not facts.
DROP POLICY IF EXISTS "shadow_runtime_events service-role only"
    ON public.shadow_runtime_events;
CREATE POLICY "shadow_runtime_events service-role only"
    ON public.shadow_runtime_events FOR ALL
    USING  (false)
    WITH CHECK (false);

-- Lock down direct grants too (defense-in-depth beside RLS).
REVOKE ALL ON public.shadow_runtime_events FROM PUBLIC;
REVOKE ALL ON public.shadow_runtime_events FROM anon, authenticated;

COMMENT ON TABLE public.shadow_runtime_events IS
    'Per-call output of shadow-mode replays (RFC §P1.2). Default-deny RLS — '
    'only service_role (inside the replay Edge Function) may read or write. '
    'NEVER joined into canonical event streams, NEVER aggregated into '
    'audit-facing views.';

COMMENT ON COLUMN public.shadow_runtime_events.original_global_seq IS
    'global_seq of the canonical runtime_events row this shadow row mirrors. '
    'Not a foreign key — runtime_events is partitioned and lacks a single-'
    'column unique constraint. NULL when the replay generated a new event '
    'that has no original (e.g. a counterfactual side-effect).';

COMMENT ON COLUMN public.shadow_runtime_events.diff_vs_original IS
    'JSONB diff to the original event (or null on counterfactuals): '
    '{ payload_changed: bool, cost_delta: { tokens: int, usd: number }, '
    'side_effects_skipped: text[] }.';

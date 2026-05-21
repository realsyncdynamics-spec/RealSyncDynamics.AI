-- runtime_events kernel v1 envelope — P0-impl-1 of the
-- Operational Governance Kernel RFC (docs/architecture/runtime-kernel-rfc.md §P0.1).
--
-- ADDITIVE. No drop, no rename, no NOT NULL on existing rows.
-- Existing readers (RuntimeEvent v0, runtime_executions, ai_runtime_events)
-- continue to work unchanged. New columns are NULLable; the kernel-v1 writer
-- in a follow-up PR will fill them.
--
-- Why now (before P0-impl-2/3 in the rollout plan):
--   Phase 0 of the rollout — pure schema groundwork. No constraint that would
--   break existing INSERTs. The kernel-v1 envelope's tier-discipline (T0..T3)
--   and replay-isolation guards activate in P0-impl-3 (the writer-side change)
--   plus P1-impl-1 (shadow_runtime_events). This migration only PREPARES.
--
-- See: docs/architecture/runtime-kernel-rfc.md §P0 for taxonomy + tradeoffs.

alter table public.runtime_events
  add column if not exists event_type         text,
  add column if not exists event_tier         text,
  add column if not exists subject_ref        text,
  add column if not exists agent_ref          text,
  add column if not exists trace_id           uuid,
  add column if not exists correlation_id     uuid,
  add column if not exists causation_id       bigint,  -- self-reference to runtime_events.id
  add column if not exists cost_snapshot_json jsonb,
  add column if not exists retention_class    text,
  add column if not exists replayable         boolean not null default true,
  add column if not exists spec_version       text    not null default '0.1';

-- event_tier whitelist (T0=audit-critical, T1=replay-relevant, T2=operational,
-- T3=ephemeral/debug — siehe RFC §P0.2).
alter table public.runtime_events
  drop constraint if exists runtime_events_event_tier_check;
alter table public.runtime_events
  add constraint runtime_events_event_tier_check
  check (event_tier is null or event_tier in ('T0','T1','T2','T3'));

-- retention_class whitelist (RFC §P0.4).
alter table public.runtime_events
  drop constraint if exists runtime_events_retention_class_check;
alter table public.runtime_events
  add constraint runtime_events_retention_class_check
  check (retention_class is null or retention_class in
    ('forever','7y','3y','1y','90d','30d','7d','ephemeral'));

-- spec_version whitelist — bumps via separater Migration.
alter table public.runtime_events
  drop constraint if exists runtime_events_spec_version_check;
alter table public.runtime_events
  add constraint runtime_events_spec_version_check
  check (spec_version in ('0.1'));

-- T2/T3 darf nicht replayable=true sein (siehe RFC §P0.2 Hard-Regel).
-- Hier als CHECK, weil der Trigger-Pfad mehr Wartung kostet als ein
-- einfacher Constraint.
alter table public.runtime_events
  drop constraint if exists runtime_events_replayable_tier_check;
alter table public.runtime_events
  add constraint runtime_events_replayable_tier_check
  check (
    -- Wenn beide gesetzt sind: T0/T1 dürfen replayable=true, T2/T3 müssen false sein.
    -- Wenn event_tier NULL (alte Rows): keine Constraint-Wirkung.
    event_tier is null
    or (event_tier in ('T0','T1'))
    or (event_tier in ('T2','T3') and replayable = false)
  );

-- Index für trace_id-Walks (DAG-Traversal pro User-Flow).
create index if not exists runtime_events_trace_idx
  on public.runtime_events (trace_id)
  where trace_id is not null;

-- Index für correlation_id-Aggregation (alle Events einer Operation).
create index if not exists runtime_events_correlation_idx
  on public.runtime_events (correlation_id)
  where correlation_id is not null;

-- Tier-skopierte Tenant-Timeline — Read-Pfad für Governance-Audit
-- (T0/T1 only) und Operational-Dashboard (T2).
create index if not exists runtime_events_tier_idx
  on public.runtime_events (tenant_id, event_tier, occurred_at desc);

-- T0/T1 replay-fähig: explizit indiziert für Bundle-Build und Replay-Engine.
create index if not exists runtime_events_replayable_idx
  on public.runtime_events (tenant_id, occurred_at desc)
  where replayable = true and event_tier in ('T0','T1');

-- causation_id-FK ist als bigint deklariert, damit DAG-Walks
-- effizient sind. Kein FOREIGN KEY auf runtime_events(id) selbst —
-- vermeidet Locking-Cascade-Risiko bei Bulk-Deletes durch Retention-Crons.
-- Integritäts-Pruefung läuft in der App (RFC §P0.5).
create index if not exists runtime_events_causation_idx
  on public.runtime_events (causation_id)
  where causation_id is not null;

comment on column public.runtime_events.event_type is
  'Granular event identifier (e.g. tracker.pre_consent_detected). Aligns with RuntimeEvent.type in src/types/runtime-event.ts. Distinct from legacy .name column which stays for backwards-read.';

comment on column public.runtime_events.event_tier is
  'T0=audit-critical (7y retention, replayable), T1=replay-relevant (3y), T2=operational (90d, NOT replayable), T3=ephemeral/debug. See runtime-kernel-rfc.md §P0.2.';

comment on column public.runtime_events.subject_ref is
  'HMAC-hashed subject reference (email/ip/user_id/session). Never plain text. Lifecycle via subject_ref_keys/_mappings — see runtime-kernel-rfc.md §P2.';

comment on column public.runtime_events.agent_ref is
  'Structured agent reference (replaces free-form agent_id for kernel-v1 events). Format: <agent_type>:<agent_id>:<version>.';

comment on column public.runtime_events.trace_id is
  'End-to-end trace across all events of a user/agent flow. See runtime-kernel-rfc.md §P0.5.';

comment on column public.runtime_events.correlation_id is
  'Per-operation grouping (e.g. one scan-run has one correlation_id).';

comment on column public.runtime_events.causation_id is
  'Predecessor event (which event triggered this). Self-reference to runtime_events.id. No FK to avoid retention-cascade locking.';

comment on column public.runtime_events.cost_snapshot_json is
  'Cost incurred to produce this event (LLM tokens, storage, etc.). Mirrored to tenant_cost_ledger — see runtime-kernel-rfc.md §P4.4.';

comment on column public.runtime_events.retention_class is
  'Retention bucket: forever / 7y / 3y / 1y / 90d / 30d / 7d / ephemeral. Retention-Cron applies on this column.';

comment on column public.runtime_events.replayable is
  'If false: event MUST NOT be replayed (T2/T3 default). Enforced via CHECK constraint.';

comment on column public.runtime_events.spec_version is
  'Schema version of this row. Currently 0.1. Consumers MUST check before reading payload structure.';

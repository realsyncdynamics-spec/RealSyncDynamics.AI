-- Tier-Discipline DB enforcement — P0-impl-3 of the Operational
-- Governance Kernel RFC (§P0.2 + §6).
--
-- Bridges the helper-side validation (writer module) with a DB-level
-- guarantee: any row written with spec_version='0.2' MUST carry an
-- event_tier. Legacy v0.1 rows (existing producers via
-- src/core/runtime/supabase/event-log.ts) keep event_tier NULL — the
-- CHECK only constrains v0.2 inserts.
--
-- Why CHECK and not trigger:
--   - same-row predicate, no cross-row lookup needed
--   - cheap, deterministic, no plpgsql maintenance burden
--   - trigger only makes sense for cross-row invariants

alter table public.runtime_events
  drop constraint if exists runtime_events_v02_tier_required_check;

alter table public.runtime_events
  add constraint runtime_events_v02_tier_required_check
  check (
    spec_version is null
    or spec_version != '0.2'
    or event_tier is not null
  );

comment on constraint runtime_events_v02_tier_required_check on public.runtime_events is
  'Any v0.2 (kernel-v1-aware) event MUST set event_tier. v0.1 legacy events stay tier-less by design — see RFC §P0.2.';

-- runtime_events spec_version whitelist bump to ('0.1', '0.2') — P0-impl-2
-- of the Operational Governance Kernel RFC (§P0.1, §6 P0-impl-2).
--
-- The TypeScript `createRuntimeEvent()` helper bumps its default to '0.2'
-- in the same PR. Without this whitelist extension, inserts of new
-- kernel-v1-aware events would fail the CHECK constraint added in
-- 20260602000000_runtime_events_kernel_v1.sql.
--
-- '0.1' remains accepted — existing producers that have not yet been
-- migrated continue to work unchanged.

alter table public.runtime_events
  drop constraint if exists runtime_events_spec_version_check;

alter table public.runtime_events
  add constraint runtime_events_spec_version_check
  check (spec_version in ('0.1', '0.2'));

-- Gate 1: Golden Audit Fixture & Determinism Tests
--
-- Proof that RealSync produces identical results for identical inputs.
-- Essential for Enterprise Compliance: "This audit is reproducible and verifiable."
--
-- Schema stores execution snapshots with full version traceability:
-- - input_hash: SHA256 of asset snapshot
-- - findings_hash: SHA256 of all findings (order-independent)
-- - decision_hash: SHA256 of policy decisions
-- - engine_version + commit: For reproducibility
-- - policy_pack_version + hash: For policy auditability

create table if not exists public.audit_determinism_tests (
  id                    uuid primary key default gen_random_uuid(),

  -- Fixture metadata
  fixture_id            text not null,                    -- e.g., 'golden_001'
  fixture_description   text,                             -- Human-readable description

  -- Audit reference
  audit_id              uuid not null,
  tenant_id             uuid not null,

  -- Input snapshot
  input_hash            text not null,                    -- SHA256 of input assets
  input_asset_count     integer,
  input_size_bytes      bigint,

  -- Findings & decisions
  findings_count        integer not null default 0,
  findings_hash         text not null,                    -- SHA256(ordered findings)
  decision_count        integer not null default 0,
  decision_hash         text not null,                    -- SHA256(ordered decisions)

  -- Execution environment
  engine_version        text not null,                    -- e.g., '2.0.0'
  engine_commit         text,                             -- e.g., 'abc123def456'
  engine_build_time     timestamptz,
  policy_pack_version   text not null,                    -- e.g., 'DSGVO_2024_Q2'
  policy_pack_hash      text not null,                    -- SHA256 of policy pack
  policy_pack_controls  integer,                          -- Number of controls in pack

  -- Test execution
  test_cycle            integer not null check (test_cycle between 1 and 1000),  -- Cycle 1-5 typically
  total_cycles          integer,                          -- Expected total cycles for this fixture

  -- Reproducibility proof
  is_deterministic      boolean,                          -- Filled after all cycles complete
  determinism_verified_at timestamptz,

  -- Timestamps
  execution_started_at  timestamptz not null,
  execution_ended_at    timestamptz not null,
  created_at            timestamptz not null default now(),

  constraint fixture_cycle_unique unique (fixture_id, test_cycle),
  constraint valid_dates check (execution_ended_at >= execution_started_at)
);

-- Indexes
create index if not exists idx_audit_det_fixture_id on public.audit_determinism_tests(fixture_id);
create index if not exists idx_audit_det_audit_id on public.audit_determinism_tests(audit_id);
create index if not exists idx_audit_det_tenant_id on public.audit_determinism_tests(tenant_id);
create index if not exists idx_audit_det_is_deterministic on public.audit_determinism_tests(is_deterministic);
create index if not exists idx_audit_det_engine_version on public.audit_determinism_tests(engine_version);
create index if not exists idx_audit_det_policy_version on public.audit_determinism_tests(policy_pack_version);

-- RLS: Enable
alter table public.audit_determinism_tests enable row level security;

-- RLS Policy: Authenticated users read tests for their tenant
drop policy if exists "audit_det_tenant_read" on public.audit_determinism_tests;
create policy "audit_det_tenant_read"
  on public.audit_determinism_tests for select
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

-- RLS Policy: Service-role inserts (Edge Functions only)
drop policy if exists "audit_det_service_write" on public.audit_determinism_tests;
create policy "audit_det_service_write"
  on public.audit_determinism_tests for insert
  to service_role
  with check (true);

-- Helper view: Summary of determinism tests per fixture
-- Shows: fixture status, hash consistency, engine/policy versions tested
do $$
begin
  execute $view$
    create or replace view public.v_determinism_fixture_summary as
    select
      fixture_id,
      fixture_description,
      tenant_id,
      count(*)::int as total_cycles,
      array_agg(distinct engine_version) as engine_versions,
      array_agg(distinct policy_pack_version) as policy_versions,
      array_agg(distinct findings_hash) as distinct_finding_hashes,
      array_agg(distinct decision_hash) as distinct_decision_hashes,
      (count(distinct findings_hash) = 1)::boolean as findings_consistent,
      (count(distinct decision_hash) = 1)::boolean as decisions_consistent,
      min(execution_started_at) as test_started,
      max(execution_ended_at) as test_completed,
      max(created_at) as last_updated
    from public.audit_determinism_tests
    where is_deterministic is not null
    group by fixture_id, fixture_description, tenant_id
  $view$;
end $$;

-- Comment for documentation
comment on table public.audit_determinism_tests is
  'Gate 1: Golden Audit Fixture — Proof of determinism & reproducibility.
   For each fixture, stores execution snapshots with version + hash traceability.
   External parties can verify audits were run with known engine/policy versions.
   RLS: tenant-scoped, service_role write only.';

comment on column public.audit_determinism_tests.findings_hash is
  'SHA256 hash of all findings (order-independent aggregation).
   Identical across all test cycles for deterministic engine.';

comment on column public.audit_determinism_tests.decision_hash is
  'SHA256 hash of all policy decisions.
   Identical across all test cycles for deterministic engine.';

comment on column public.audit_determinism_tests.is_deterministic is
  'Calculated after all test cycles complete:
   TRUE if findings_hash and decision_hash are identical across all cycles.';

-- Migration: Approval Gates – Production Implementation
-- collision-check: allow-existing-table runtime_approval_gates — Phase 1.1 basic schema extended to production with tenant RLS and audit trail
-- Phase 1.2: Moves from In-Memory to Postgres-backed ApprovalGateService

-- Extend existing runtime_approval_gates table (created in Phase 1.1) with additional fields.
-- Phase 1.1 schema: id (uuid), execution_id (uuid), reason, risk_level, status, requested_action, decided_by, created_at, decided_at
-- Phase 1.2 adds: tenant_id (denormalized from runtime_executions for direct RLS), metadata

alter table public.runtime_approval_gates
  add column if not exists tenant_id uuid,
  add column if not exists metadata jsonb;

-- Backfill tenant_id from related execution (if table is not empty)
update public.runtime_approval_gates rg
  set tenant_id = re.tenant_id
  from public.runtime_executions re
  where rg.execution_id = re.id
    and rg.tenant_id is null;

-- Row Level Security (RLS)
-- Replace Phase 1.1 RLS (which checked via runtime_executions) with direct tenant_id check.
-- Phase 1.2 denormalizes tenant_id into runtime_approval_gates for simpler, faster RLS evaluation.

-- Ensure RLS is enabled on the table
alter table public.runtime_approval_gates enable row level security;

-- Drop existing Phase 1.1 policies (via runtime_executions join)
drop policy if exists runtime_approval_gates_tenant_select on public.runtime_approval_gates;
drop policy if exists runtime_approval_gates_tenant_insert on public.runtime_approval_gates;
drop policy if exists runtime_approval_gates_tenant_update on public.runtime_approval_gates;

-- New Phase 1.2 policies: direct tenant_id check via is_tenant_member()
create policy rls_approval_gates_tenant_select
  on public.runtime_approval_gates
  for select
  using (coalesce(public.is_tenant_member(tenant_id), false));

create policy rls_approval_gates_tenant_insert
  on public.runtime_approval_gates
  for insert
  with check (coalesce(public.is_tenant_member(tenant_id), false));

create policy rls_approval_gates_tenant_update
  on public.runtime_approval_gates
  for update
  using (coalesce(public.is_tenant_member(tenant_id), false) and status = 'pending')
  with check (status in ('granted', 'denied', 'expired'));

-- Service Role can do all operations
create policy rls_approval_gates_service_role
  on public.runtime_approval_gates
  for all
  using (auth.role() = 'service_role');

-- Commit message guidance (for revision history)
-- This migration enables production-grade approval gates with:
-- - Tenant denormalization (tenant_id column for direct RLS)
-- - RLS enforcement (direct tenant_id check via is_tenant_member)
-- - State machine functions (decide_gate) deferred to Phase 1.3
-- for separate validation and testing of stored procedure logic.

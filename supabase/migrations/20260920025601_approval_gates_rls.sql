-- Migration: Approval Gates – Row Level Security
-- collision-check: allow-existing-table runtime_approval_gates — Phase 1.2 schema; Phase 1.3 adds RLS
-- Phase 1.3: Applies tenant-scoped RLS policies to the extended approval gates table

-- Enable RLS on runtime_approval_gates (if not already enabled)
alter table public.runtime_approval_gates enable row level security;

-- Drop existing policies (from Phase 1.1 or earlier attempts)
drop policy if exists runtime_approval_gates_tenant_select on public.runtime_approval_gates;
drop policy if exists runtime_approval_gates_tenant_insert on public.runtime_approval_gates;
drop policy if exists runtime_approval_gates_tenant_update on public.runtime_approval_gates;
drop policy if exists rls_approval_gates_tenant_select on public.runtime_approval_gates;
drop policy if exists rls_approval_gates_tenant_insert on public.runtime_approval_gates;
drop policy if exists rls_approval_gates_tenant_update on public.runtime_approval_gates;
drop policy if exists rls_approval_gates_service_role on public.runtime_approval_gates;

-- New Phase 1.3 policies: direct tenant_id check via is_tenant_member()
-- These policies enforce tenant isolation for approval gate records
create policy rls_approval_gates_tenant_select
  on public.runtime_approval_gates
  for select
  using (public.is_tenant_member(tenant_id));

create policy rls_approval_gates_tenant_insert
  on public.runtime_approval_gates
  for insert
  with check (public.is_tenant_member(tenant_id));

create policy rls_approval_gates_tenant_update
  on public.runtime_approval_gates
  for update
  using (public.is_tenant_member(tenant_id) and status = 'pending')
  with check (status in ('granted', 'denied', 'expired'));

-- Service Role can do all operations (used by Edge Functions)
create policy rls_approval_gates_service_role
  on public.runtime_approval_gates
  for all
  using (auth.role() = 'service_role');

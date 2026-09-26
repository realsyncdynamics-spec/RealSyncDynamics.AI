-- Migration: Approval Gates – Production Implementation – Schema Only
-- collision-check: allow-existing-table runtime_approval_gates — Phase 1.1 basic schema extended to production
-- Phase 1.2: Add tenant denormalization for multi-tenant support
-- Phase 1.3: Add RLS policies and functions

-- Extend existing runtime_approval_gates table (created in Phase 1.1) with additional fields.
-- Phase 1.1 schema: id (uuid), execution_id (uuid), reason, risk_level, status, requested_action, decided_by, created_at, decided_at
-- Phase 1.2 adds: tenant_id (denormalized from runtime_executions), metadata

alter table public.runtime_approval_gates
  add column if not exists tenant_id uuid,
  add column if not exists metadata jsonb;

-- Backfill tenant_id from related execution for all rows
-- Use COALESCE to ensure rows without matches get a non-NULL value
update public.runtime_approval_gates rg
  set tenant_id = coalesce(
    (select re.tenant_id from public.runtime_executions re where rg.execution_id = re.id),
    gen_random_uuid()
  )
  where rg.tenant_id is null;

-- Add NOT NULL constraint after backfill completes
alter table public.runtime_approval_gates
  alter column tenant_id set not null;

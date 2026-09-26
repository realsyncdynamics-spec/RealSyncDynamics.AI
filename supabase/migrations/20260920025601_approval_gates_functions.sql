-- Migration: Approval Gates Functions – Phase 1.3
-- collision-check: allow-existing-table runtime_approval_gates — Phase 1.2 schema; Phase 1.3 adds functions only
-- Deferred from Phase 1.2 to separate schema validation from function creation.
-- Phase 1.3 creates the RPC functions needed for approval gate operations.

-- Stored Function: decide_gate
-- Atomically transitions a pending approval gate to a new status.
-- Only updates gates that are currently pending; acts as state machine enforcement.
create or replace function public.decide_gate(
  gate_id uuid,
  new_status text,
  decided_by_user_id uuid
)
returns table (
  id uuid,
  execution_id uuid,
  status text,
  decided_by uuid,
  decided_at timestamp with time zone
)
language sql
security definer
set search_path = public
as $$
  update public.runtime_approval_gates
  set
    status = new_status,
    decided_by = decided_by_user_id,
    decided_at = now()
  where id = gate_id and status = 'pending'
  returning id, execution_id, status, decided_by, decided_at
$$;

-- Grant execute permission to authenticated users and service role
grant execute on function public.decide_gate(uuid, text, uuid) to authenticated, service_role;

-- Commit message guidance (for revision history)
-- This migration provides the stored functions for approval gate state transitions.
-- These functions are separate from Phase 1.2 schema to allow independent validation
-- and testing of stored procedure logic.

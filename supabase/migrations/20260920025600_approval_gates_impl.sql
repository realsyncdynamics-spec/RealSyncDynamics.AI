-- Migration: Approval Gates – Production Implementation – Schema Only
-- collision-check: allow-existing-table runtime_approval_gates — Phase 1.1 basic schema extended to production
-- Phase 1.2: Add denormalized tenant tracking column
--
-- Deferred approach: add tenant_id first; metadata and backfill in subsequent phases.

alter table public.runtime_approval_gates
  add column if not exists tenant_id uuid;

-- Migration: Approval Gates – Production Implementation – Schema Only
-- collision-check: allow-existing-table runtime_approval_gates — Phase 1.1 basic schema extended to production
-- Phase 1.2: Add denormalized tenant tracking columns for future multi-tenant optimization
--
-- This phase adds columns only, deferred from constraint/backfill logic for simplicity.
-- Backfill operations will be handled in Phase 1.2b after schema stabilization.

alter table public.runtime_approval_gates
  add column if not exists tenant_id uuid,
  add column if not exists metadata jsonb;

-- Migration: evidence_snapshots_archived_at
-- Created at: 2026-08-10
-- Description: Add archived_at column to evidence_snapshots for Archive functionality

-- Add archived_at column (nullable, for soft-delete)
ALTER TABLE public.evidence_snapshots 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add index for archived_at to improve query performance
CREATE INDEX IF NOT EXISTS idx_evidence_snapshots_archived_at 
ON public.evidence_snapshots(archived_at);

-- Add index for tenant_id + archived_at to filter archived snapshots efficiently
CREATE INDEX IF NOT EXISTS idx_evidence_snapshots_tenant_archived 
ON public.evidence_snapshots(tenant_id, archived_at);

-- Add index for subject_ref + archived_at to filter archived snapshots by subject
CREATE INDEX IF NOT EXISTS idx_evidence_snapshots_subject_archived 
ON public.evidence_snapshots(subject_ref, archived_at);

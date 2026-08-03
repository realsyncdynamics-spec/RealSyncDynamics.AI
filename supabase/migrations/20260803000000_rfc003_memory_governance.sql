-- RFC-003 — Governance Memory Policy
-- Temporal decay, classification, retention holds, compliance audit trail
-- Status: Phase 3 Implementation — Tables, Indexes, Checks, RLS

-- ============================================================
-- §1 Memory Classification & State Enums
-- ============================================================

CREATE TYPE memory_classification AS ENUM ('fact', 'inference', 'correlation', 'risk_signal');
CREATE TYPE memory_state AS ENUM ('active', 'cooling', 'archived', 'expired', 'purged');
CREATE TYPE retention_class AS ENUM ('forever', '7y', '3y', '1y', '90d', '30d', '7d', 'ephemeral');

-- ============================================================
-- §2 Main Memory Table
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_memory (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,

  -- Classification & Semantics
  classification        memory_classification NOT NULL,
  state                 memory_state NOT NULL DEFAULT 'active',
  state_transitioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Content
  key                   TEXT NOT NULL,
  value                 JSONB NOT NULL DEFAULT '{}',
  pii_class             TEXT NOT NULL DEFAULT 'public', -- 'public' | 'eu_resident' | 'sensitive'

  -- Evidence & Derivation (JSONB arrays of UUIDs)
  evidence_refs         UUID[] DEFAULT '{}',
  derived_from          UUID[] DEFAULT '{}',

  -- Temporal Decay (RFC-003 §3.1)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  freshness_half_life   INTERVAL NOT NULL DEFAULT '30 days',
  confidence            NUMERIC(3,2) DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  relevance             NUMERIC(3,2) DEFAULT 1.0 CHECK (relevance BETWEEN 0 AND 1),

  -- Retention Constraints (RFC-003 §4)
  retention_class       retention_class NOT NULL DEFAULT '1y',
  automated_purge_date  TIMESTAMPTZ,
  regulatory_hold       BOOLEAN NOT NULL DEFAULT false,
  incident_hold         BOOLEAN NOT NULL DEFAULT false,

  -- Supersession (Immutability via new rows)
  supersedes_id         UUID REFERENCES agent_memory(id),

  -- Subject Reference (GDPR DSR binding)
  subject_ref           TEXT,

  -- Audit Trail
  created_by            TEXT,
  last_accessed_at      TIMESTAMPTZ,
  access_count          INTEGER DEFAULT 0,

  -- Metadata
  correlation_id        TEXT,
  computation_id        TEXT, -- Required for risk_signal classification
  tags                  TEXT[] DEFAULT '{}',

  CONSTRAINT memory_fact_needs_evidence
    CHECK (classification != 'fact' OR array_length(evidence_refs, 1) >= 1),
  CONSTRAINT memory_risk_signal_needs_computation
    CHECK (classification != 'risk_signal' OR computation_id IS NOT NULL),
  CONSTRAINT memory_correlation_needs_both_ends
    CHECK (classification != 'correlation' OR (evidence_refs IS NOT NULL AND array_length(evidence_refs, 1) >= 2)),
  CONSTRAINT memory_supersession_immutable
    CHECK (supersedes_id IS NOT NULL OR state IN ('active', 'cooling', 'archived', 'expired')),
  CONSTRAINT memory_purged_cannot_supersede
    CHECK (state != 'purged' OR supersedes_id IS NULL)
);

-- ============================================================
-- §3 Indexes (RFC-003 §5.2 Index Strategy)
-- ============================================================

-- Hot-path: Active memory per tenant
CREATE INDEX idx_memory_tenant_state ON agent_memory (
  tenant_id,
  state,
  state_transitioned_at DESC
) WHERE state = 'active';

-- Decay worker: Expiring items
CREATE INDEX idx_memory_decay_candidates ON agent_memory (
  automated_purge_date
) WHERE state IN ('archived', 'expired') AND NOT regulatory_hold AND NOT incident_hold;

-- Subject-based erasure (GDPR DSR)
CREATE INDEX idx_memory_subject_ref ON agent_memory (
  tenant_id,
  subject_ref
) WHERE subject_ref IS NOT NULL;

-- Re-validation: Find derived items
CREATE INDEX idx_memory_derived_from_gin ON agent_memory USING GIN (derived_from);

-- Supersession chain
CREATE INDEX idx_memory_supersedes ON agent_memory (supersedes_id) WHERE supersedes_id IS NOT NULL;

-- Correlation tracking
CREATE INDEX idx_memory_correlation ON agent_memory (correlation_id) WHERE correlation_id IS NOT NULL;

-- ============================================================
-- §4 Row-Level Security (Multi-Tenancy)
-- ============================================================

ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY memory_tenant_isolation ON agent_memory
  FOR ALL
  USING (tenant_id = auth.uid());

-- ============================================================
-- §5 Computed Columns & Triggers
-- ============================================================

-- Freshness: Recalculated on read (not stored)
-- Formula: freshness = exp(-age_days / half_life_days)
-- No trigger needed; freshness is computed in application layer

-- Automated Purge Date: Calculated at insert
CREATE OR REPLACE FUNCTION calculate_automated_purge_date(
  p_created_at TIMESTAMPTZ,
  p_retention_class retention_class
) RETURNS TIMESTAMPTZ AS $$
  SELECT CASE p_retention_class
    WHEN 'forever' THEN NULL
    WHEN '7y' THEN p_created_at + INTERVAL '7 years' + INTERVAL '7 days'
    WHEN '3y' THEN p_created_at + INTERVAL '3 years' + INTERVAL '7 days'
    WHEN '1y' THEN p_created_at + INTERVAL '1 year' + INTERVAL '7 days'
    WHEN '90d' THEN p_created_at + INTERVAL '90 days' + INTERVAL '7 days'
    WHEN '30d' THEN p_created_at + INTERVAL '30 days' + INTERVAL '7 days'
    WHEN '7d' THEN p_created_at + INTERVAL '7 days' + INTERVAL '7 days'
    WHEN 'ephemeral' THEN p_created_at + INTERVAL '7 days' -- Grace period only
  END;
$$ LANGUAGE SQL IMMUTABLE;

-- Set automated_purge_date on insert
CREATE OR REPLACE FUNCTION agent_memory_before_insert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.automated_purge_date := calculate_automated_purge_date(NEW.created_at, NEW.retention_class);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_memory_set_purge_date
  BEFORE INSERT ON agent_memory
  FOR EACH ROW
  EXECUTE FUNCTION agent_memory_before_insert();

-- ============================================================
-- §6 Materialized Views for Performance
-- ============================================================

-- Active memory count per tenant & classification (RFC-003 §5.1)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_memory_active_per_tenant AS
SELECT
  tenant_id,
  classification,
  COUNT(*) as item_count,
  SUM(octet_length(value::text)) as total_bytes,
  MAX(state_transitioned_at) as last_transition
FROM agent_memory
WHERE state = 'active'
GROUP BY tenant_id, classification;

CREATE INDEX idx_mv_memory_active_tenant ON mv_memory_active_per_tenant (tenant_id);

-- Decay candidates (aging items approaching purge) (RFC-003 §5.1)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_memory_decay_candidates AS
SELECT
  id,
  tenant_id,
  classification,
  state,
  automated_purge_date,
  regulatory_hold,
  incident_hold,
  subject_ref,
  EXTRACT(EPOCH FROM (automated_purge_date - now())) / 86400 as days_until_purge
FROM agent_memory
WHERE automated_purge_date IS NOT NULL
  AND state IN ('archived', 'expired')
  AND NOT regulatory_hold
  AND NOT incident_hold
  AND automated_purge_date < (now() + INTERVAL '1 day');

CREATE INDEX idx_mv_decay_candidates_purge_date ON mv_memory_decay_candidates (automated_purge_date);

-- ============================================================
-- §7 Audit Integration: Memory Events in runtime_events
-- ============================================================

-- Schema note: These events are written as new rows in runtime_events,
-- not stored in a separate audit table. The event_type determines semantics:
-- - 'memory.created' → T1 event, hash-chained, replayable
-- - 'memory.confidence_decayed' → T1 event, marks confidence change
-- - 'memory.purged' → T0 event, marks deletion, replayable, immutable

-- No DDL changes needed here; events are created by application code
-- and written via the runtime_events insert path (SPEC-001)

-- ============================================================
-- §8 Subject Reference Mapping (GDPR DSR Atomicity)
-- ============================================================

-- Links Memory items to subject_ref_mappings for coordinated erasure
-- This table is created by RFC-002 migration (subject-ref-lifecycle-rfc.md)
-- We just reference it in foreign keys above

-- ============================================================
-- §9 Seed: Default Retention Class Mappings
-- ============================================================

CREATE TABLE IF NOT EXISTS memory_retention_policies (
  classification memory_classification PRIMARY KEY,
  default_retention retention_class NOT NULL,
  half_life_days INTEGER,
  description TEXT
);

INSERT INTO memory_retention_policies (classification, default_retention, half_life_days, description)
VALUES
  ('fact', '7y', NULL, 'Evidence-backed, immutable, no temporal decay'),
  ('inference', '1y', 30, 'Derived from other items, temporal + confidence decay'),
  ('correlation', '3y', 90, 'Connections between events, relevance decay'),
  ('risk_signal', '30d', 7, 'Computed scalars, overwrite-on-recompute')
ON CONFLICT (classification) DO NOTHING;

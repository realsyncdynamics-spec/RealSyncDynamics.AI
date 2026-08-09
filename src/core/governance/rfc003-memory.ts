/**
 * RFC-003 — Governance Memory Policy Implementation
 *
 * Temporal decay, classification immutability, retention constraints,
 * compliance audit trail for DSGVO + EU AI Act.
 *
 * Pure logic: This module contains deterministic functions mirroring
 * SQL implementations. Verified against DB via compliance tests.
 */

/**
 * §1 Memory Classification (RFC-003 §2)
 *
 * Immutable at insert; re-classification requires new row with supersedes_id.
 */
export type MemoryClassification = 'fact' | 'inference' | 'correlation' | 'risk_signal';

/**
 * §2 Memory State Machine (RFC-003 §3.5)
 *
 * active → cooling → archived → expired → purged
 * All transitions governed by decay policies and hold semantics.
 */
export type MemoryState = 'active' | 'cooling' | 'archived' | 'expired' | 'purged';

/**
 * §3 Retention Policy (RFC-003 §4.3)
 *
 * Default retention per classification.
 * automated_purge_date = created_at + interval(retention_class) + 7_days_grace
 */
export type RetentionClass = 'forever' | '7y' | '3y' | '1y' | '90d' | '30d' | '7d' | 'ephemeral';

export const RETENTION_INTERVALS_DAYS: Record<RetentionClass, number | null> = {
  forever: null,
  '7y': 365.25 * 7,
  '3y': 365.25 * 3,
  '1y': 365.25,
  '90d': 90,
  '30d': 30,
  '7d': 7,
  ephemeral: 0,
};

export const PURGE_GRACE_DAYS = 7;

/**
 * §4 Memory Item Interface
 */
export interface MemoryItem {
  id: string;
  tenant_id: string;

  // Classification
  classification: MemoryClassification;
  state: MemoryState;
  state_transitioned_at: Date;

  // Content
  key: string;
  value: unknown;
  pii_class: 'public' | 'eu_resident' | 'sensitive';

  // Evidence & Derivation
  evidence_refs: string[]; // UUIDs
  derived_from: string[]; // UUIDs

  // Temporal Decay (RFC-003 §3.1)
  created_at: Date;
  freshness_half_life_days: number;
  confidence: number; // [0, 1]
  relevance: number; // [0, 1]

  // Retention
  retention_class: RetentionClass;
  automated_purge_date: Date | null;
  regulatory_hold: boolean;
  incident_hold: boolean;

  // Supersession
  supersedes_id: string | null;

  // GDPR DSR
  subject_ref: string | null;

  // Audit
  created_by: string | null;
  last_accessed_at: Date | null;
  access_count: number;

  // Metadata
  correlation_id: string | null;
  computation_id: string | null; // Required for risk_signal
}

/**
 * §5 Temporal Decay Formula (RFC-003 §3.1)
 *
 * freshness = exp(-age_days / half_life_days)
 *
 * At age=0: freshness=1.0
 * At age=half_life: freshness ≈ 0.368 (1/e)
 * At age=half_life×ln(2): freshness=0.5 (cooling threshold)
 * At age=half_life×ln(5): freshness=0.2 (archive threshold)
 */
export function calculateFreshness(
  ageDays: number,
  halfLifeDays: number,
): number {
  return Math.exp(-ageDays / halfLifeDays);
}

/**
 * Age in days since created_at
 */
export function getAgeDays(createdAt: Date): number {
  return (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * §6 State Transitions (RFC-003 §3)
 *
 * Based on decay triggers: temporal freshness, confidence, relevance,
 * retention expiry, incident resolution.
 */

export interface DecayTrigger {
  type: 'temporal' | 'confidence' | 'relevance' | 'incident_resolution' | 'retention_expiry';
  freshness?: number;
  confidence?: number;
  relevance?: number;
  daysUntilPurge?: number;
}

/**
 * Determine next state based on current state and decay trigger.
 * Returns null if no transition should occur.
 */
export function getNextStateAfterDecay(
  currentState: MemoryState,
  item: MemoryItem,
  trigger: DecayTrigger,
): MemoryState | null {
  // Cannot transition from purged
  if (currentState === 'purged') {
    return null;
  }

  // Holds block all transitions except reads
  if (item.regulatory_hold || item.incident_hold) {
    return null;
  }

  // Temporal decay thresholds (RFC-003 §3.1, §3.2)
  const freshness = item.classification === 'fact'
    ? 1.0 // Facts don't decay temporally
    : calculateFreshness(getAgeDays(item.created_at), item.freshness_half_life_days);

  const coolingThreshold = 0.5;
  const archiveThreshold = 0.2;

  switch (currentState) {
    case 'active':
      // Transition to cooling if freshness < 0.5 OR confidence < 0.5
      if (freshness < coolingThreshold || item.confidence < coolingThreshold) {
        return 'cooling';
      }
      return null;

    case 'cooling':
      // Transition to archived if freshness < 0.2 AND relevance < 0.2
      if (freshness < archiveThreshold && item.relevance < archiveThreshold) {
        return 'archived';
      }
      return null;

    case 'archived':
      // Transition to expired if automated_purge_date has passed
      if (item.automated_purge_date && new Date() > item.automated_purge_date) {
        return 'expired';
      }
      return null;

    case 'expired':
      // Transition to purged after grace period (also checked in DB)
      if (item.automated_purge_date) {
        const gracePeriodMs = PURGE_GRACE_DAYS * 24 * 60 * 60 * 1000;
        const purgableAfter = new Date(item.automated_purge_date.getTime() + gracePeriodMs);
        if (new Date() > purgableAfter) {
          return 'purged';
        }
      }
      return null;
  }
}

/**
 * §7 Confidence Decay (RFC-003 §3.2)
 *
 * Trigger: new evidence with overlapping subject_ref or correlation_id.
 *
 * Confidence < 0.5 → archive immediately
 * 0.5 ≤ confidence < 0.8 → cool, schedule re-validation
 * confidence ≥ 0.8 → stay active, schedule re-validation
 */
export function getConfidenceDecayAction(
  currentConfidence: number,
): 'immediate_archive' | 'cool_and_revalidate' | 'revalidate_only' | 'none' {
  if (currentConfidence < 0.5) {
    return 'immediate_archive';
  }
  if (currentConfidence < 0.8) {
    return 'cool_and_revalidate';
  }
  return 'revalidate_only';
}

/**
 * Re-Validation-Fälligkeit je Aktion (Stunden) — Spiegel der Intervalle in
 * governance_memory_confidence_reassess() (Migration 20260819000000).
 * immediate_archive plant keine Re-Validation.
 */
export const REVALIDATION_DELAY_HOURS: Record<'cool_and_revalidate' | 'revalidate_only', number> = {
  cool_and_revalidate: 24,
  revalidate_only: 72,
};

/**
 * §8 Hardened Validation (RFC-003 §2)
 *
 * Immutability rules: UPDATE is forbidden; new rows with supersedes_id required.
 */

export class MemoryValidationError extends Error {
  constructor(public rule: string, message: string) {
    super(message);
    this.name = 'MemoryValidationError';
  }
}

/**
 * Validate memory item invariants on insert.
 * Throws MemoryValidationError if violated.
 */
export function validateMemoryOnInsert(item: Omit<MemoryItem, 'id' | 'created_at' | 'state_transitioned_at' | 'state'>): void {
  const { classification, evidence_refs, derived_from, computation_id } = item;

  // Hard Rule §2.1: Fact without evidence_refs is invalid
  if (classification === 'fact' && (!evidence_refs || evidence_refs.length === 0)) {
    throw new MemoryValidationError(
      'FACT_NEEDS_EVIDENCE',
      'Fact must have at least one evidence_ref',
    );
  }

  // Hard Rule §2.4: Risk Signal without computation_id is invalid
  if (classification === 'risk_signal' && !computation_id) {
    throw new MemoryValidationError(
      'RISK_SIGNAL_NEEDS_COMPUTATION',
      'Risk Signal must have computation_id',
    );
  }

  // Hard Rule: Inference/Correlation without derived_from is invalid
  if ((classification === 'inference' || classification === 'correlation') &&
      (!derived_from || derived_from.length === 0)) {
    throw new MemoryValidationError(
      'DERIVED_NEEDS_SOURCE',
      `${classification} must reference source items via derived_from`,
    );
  }
}

/**
 * §9 Compliance: Purge Atomicity Check
 *
 * Memory purge must not occur while:
 * - regulatory_hold = true (DSGVO, EU AI Act)
 * - incident_hold = true (investigation in progress)
 * - subject_ref_mappings.deletion_requested_at exists but not yet erased
 */
export function canPurgeMemory(item: MemoryItem): boolean {
  if (item.regulatory_hold || item.incident_hold) {
    return false;
  }

  // Additional check in DB: subject_ref DSR must be fully erased
  // This is checked at purge-time in the worker, not here

  return item.state === 'expired';
}

/**
 * §10 Freshness Calculation for Classification
 *
 * Returns the effective freshness for a memory item,
 * considering its classification decay rules.
 */
export function getEffectiveFreshness(item: MemoryItem): number {
  const { classification, created_at, freshness_half_life_days } = item;

  // Facts don't decay temporally
  if (classification === 'fact') {
    return 1.0;
  }

  const ageDays = getAgeDays(created_at);
  return calculateFreshness(ageDays, freshness_half_life_days);
}

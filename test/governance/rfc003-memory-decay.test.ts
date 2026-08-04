/**
 * RFC-003 — Memory Decay Tests
 *
 * Temporal decay formulas, state transitions, hold semantics,
 * compliance validation. All pure functions, deterministic.
 */

import { describe, expect, it } from 'vitest';
import {
  MemoryClassification,
  MemoryState,
  MemoryItem,
  calculateFreshness,
  getAgeDays,
  getNextStateAfterDecay,
  getConfidenceDecayAction,
  validateMemoryOnInsert,
  MemoryValidationError,
  canPurgeMemory,
  getEffectiveFreshness,
} from '@/src/core/governance/rfc003-memory';

// ============================================================
// Temporal Decay Formula Tests (RFC-003 §3.1)
// ============================================================

describe('RFC-003 / temporal decay formula', () => {
  it('freshness = 1.0 at age 0 days', () => {
    expect(calculateFreshness(0, 30)).toBeCloseTo(1.0, 6);
  });

  it('freshness ≈ 1/e at age = half_life', () => {
    expect(calculateFreshness(30, 30)).toBeCloseTo(1 / Math.E, 6);
  });

  it('freshness = 0.5 at age ≈ half_life × ln(2)', () => {
    const halfLife = 30;
    const expectedAge = halfLife * Math.LN2;
    expect(calculateFreshness(expectedAge - 0.01, halfLife)).toBeGreaterThan(0.5);
    expect(calculateFreshness(expectedAge + 0.01, halfLife)).toBeLessThan(0.5);
  });

  it('freshness = 0.2 at age ≈ half_life × ln(5)', () => {
    const halfLife = 30;
    const expectedAge = halfLife * Math.log(5);
    expect(calculateFreshness(expectedAge - 0.01, halfLife)).toBeGreaterThan(0.2);
    expect(calculateFreshness(expectedAge + 0.01, halfLife)).toBeLessThan(0.2);
  });

  it('decays monotonically with age', () => {
    expect(calculateFreshness(10, 30)).toBeGreaterThan(calculateFreshness(20, 30));
    expect(calculateFreshness(20, 30)).toBeGreaterThan(calculateFreshness(30, 30));
    expect(calculateFreshness(30, 30)).toBeGreaterThan(calculateFreshness(40, 30));
  });

  it('different half_life values affect decay rate', () => {
    // Shorter half-life decays faster
    expect(calculateFreshness(15, 30)).toBeGreaterThan(calculateFreshness(15, 15));
    // Longer half-life decays slower
    expect(calculateFreshness(15, 60)).toBeGreaterThan(calculateFreshness(15, 30));
  });
});

// ============================================================
// Age Calculation Tests
// ============================================================

describe('RFC-003 / age calculation', () => {
  it('age = 0 for item created now', () => {
    const now = new Date();
    const age = getAgeDays(now);
    expect(age).toBeLessThan(0.001); // Within millisecond precision
  });

  it('age increases with time', () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const age = getAgeDays(oneDayAgo);
    expect(age).toBeGreaterThan(0.99);
    expect(age).toBeLessThan(1.01);
  });
});

// ============================================================
// State Transition Tests (RFC-003 §3.5)
// ============================================================

describe('RFC-003 / state machine transitions', () => {
  const baseItem = {
    id: 'mem-001',
    tenant_id: 'tenant-1',
    key: 'test-memory',
    value: { data: 'test' },
    pii_class: 'public' as const,
    evidence_refs: ['evt-1'],
    derived_from: [],
    classification: 'inference' as MemoryClassification,
    state: 'active' as MemoryState,
    state_transitioned_at: new Date(),
    created_at: new Date(),
    freshness_half_life_days: 30,
    confidence: 0.8,
    relevance: 0.8,
    retention_class: '1y' as const,
    automated_purge_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    regulatory_hold: false,
    incident_hold: false,
    supersedes_id: null,
    subject_ref: null,
    created_by: null,
    last_accessed_at: null,
    access_count: 0,
    correlation_id: null,
    computation_id: null,
  };

  it('active → cooling when freshness < 0.5', () => {
    const item = {
      ...baseItem,
      classification: 'inference' as MemoryClassification,
      state: 'active' as MemoryState,
      // Created 25+ days ago (freshness < 0.5 with half_life=30)
      created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    };

    const nextState = getNextStateAfterDecay(item.state, item, { type: 'temporal' });
    expect(nextState).toBe('cooling');
  });

  it('active → cooling when confidence < 0.5', () => {
    const item = {
      ...baseItem,
      classification: 'inference' as MemoryClassification,
      state: 'active' as MemoryState,
      confidence: 0.4,
    };

    const nextState = getNextStateAfterDecay(item.state, item, { type: 'confidence' });
    expect(nextState).toBe('cooling');
  });

  it('cooling → archived when both freshness AND relevance < 0.2', () => {
    const item = {
      ...baseItem,
      classification: 'inference' as MemoryClassification,
      state: 'cooling' as MemoryState,
      created_at: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000), // Freshness ≈ 0.1
      relevance: 0.1,
    };

    const nextState = getNextStateAfterDecay(item.state, item, { type: 'temporal' });
    expect(nextState).toBe('archived');
  });

  it('cooling stays cooling if relevance >= 0.2', () => {
    const item = {
      ...baseItem,
      classification: 'inference' as MemoryClassification,
      state: 'cooling' as MemoryState,
      created_at: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
      relevance: 0.5, // Above threshold
    };

    const nextState = getNextStateAfterDecay(item.state, item, { type: 'temporal' });
    expect(nextState).toBeNull();
  });

  it('archived → expired when automated_purge_date reached', () => {
    const item = {
      ...baseItem,
      classification: 'inference' as MemoryClassification,
      state: 'archived' as MemoryState,
      automated_purge_date: new Date(Date.now() - 1000), // In the past
    };

    const nextState = getNextStateAfterDecay(item.state, item, { type: 'retention_expiry' });
    expect(nextState).toBe('expired');
  });

  it('archived stays archived if purge_date not reached', () => {
    const item = {
      ...baseItem,
      classification: 'inference' as MemoryClassification,
      state: 'archived' as MemoryState,
      automated_purge_date: new Date(Date.now() + 100 * 1000), // Future
    };

    const nextState = getNextStateAfterDecay(item.state, item, { type: 'retention_expiry' });
    expect(nextState).toBeNull();
  });

  it('purged state never transitions', () => {
    const item = {
      ...baseItem,
      classification: 'fact' as MemoryClassification,
      state: 'purged' as MemoryState,
    };

    const nextState = getNextStateAfterDecay(item.state, item, { type: 'temporal' });
    expect(nextState).toBeNull();
  });
});

// ============================================================
// Hold Semantics Tests (RFC-003 §4.1, §4.2)
// ============================================================

describe('RFC-003 / hold semantics', () => {
  const expiredItem = {
    id: 'mem-001',
    tenant_id: 'tenant-1',
    key: 'test',
    value: {},
    pii_class: 'public' as const,
    evidence_refs: ['evt-1'],
    derived_from: [],
    classification: 'inference' as MemoryClassification,
    state: 'expired' as MemoryState,
    state_transitioned_at: new Date(),
    created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    freshness_half_life_days: 30,
    confidence: 0.1,
    relevance: 0.1,
    retention_class: '1y' as const,
    automated_purge_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    regulatory_hold: false,
    incident_hold: false,
    supersedes_id: null,
    subject_ref: null,
    created_by: null,
    last_accessed_at: null,
    access_count: 0,
    correlation_id: null,
    computation_id: null,
  };

  it('regulatory_hold blocks decay', () => {
    const item = {
      ...expiredItem,
      state: 'expired' as MemoryState,
      regulatory_hold: true,
    } as MemoryItem;

    const nextState = getNextStateAfterDecay(item.state, item, { type: 'retention_expiry' });
    expect(nextState).toBeNull();
  });

  it('incident_hold blocks decay', () => {
    const item = {
      ...expiredItem,
      state: 'expired' as MemoryState,
      incident_hold: true,
    } as MemoryItem;

    const nextState = getNextStateAfterDecay(item.state, item, { type: 'retention_expiry' });
    expect(nextState).toBeNull();
  });

  it('both holds block decay', () => {
    const item = {
      ...expiredItem,
      state: 'expired' as MemoryState,
      regulatory_hold: true,
      incident_hold: true,
    } as MemoryItem;

    const nextState = getNextStateAfterDecay(item.state, item, { type: 'retention_expiry' });
    expect(nextState).toBeNull();
  });
});

// ============================================================
// Confidence Decay Action Tests (RFC-003 §3.2)
// ============================================================

describe('RFC-003 / confidence decay actions', () => {
  it('confidence < 0.5 triggers immediate archive', () => {
    expect(getConfidenceDecayAction(0.4)).toBe('immediate_archive');
    expect(getConfidenceDecayAction(0.0)).toBe('immediate_archive');
  });

  it('0.5 ≤ confidence < 0.8 triggers cool + revalidate', () => {
    expect(getConfidenceDecayAction(0.5)).toBe('cool_and_revalidate');
    expect(getConfidenceDecayAction(0.7)).toBe('cool_and_revalidate');
    expect(getConfidenceDecayAction(0.79)).toBe('cool_and_revalidate');
  });

  it('confidence ≥ 0.8 triggers revalidate only', () => {
    expect(getConfidenceDecayAction(0.8)).toBe('revalidate_only');
    expect(getConfidenceDecayAction(1.0)).toBe('revalidate_only');
  });
});

// ============================================================
// Validation Tests (RFC-003 §2)
// ============================================================

describe('RFC-003 / classification immutability', () => {
  const baseInput = {
    tenant_id: 'tenant-1',
    key: 'test',
    value: {},
    pii_class: 'public' as const,
    evidence_refs: ['evt-1'],
    derived_from: [],
    freshness_half_life_days: 30,
    confidence: 0.8,
    relevance: 0.8,
    retention_class: '1y' as const,
    automated_purge_date: null,
    regulatory_hold: false,
    incident_hold: false,
    supersedes_id: null,
    subject_ref: null,
    created_by: null,
    last_accessed_at: null,
    access_count: 0,
    correlation_id: null,
    computation_id: null,
  };

  it('Fact without evidence_refs is rejected (Hard-Regel §2.1)', () => {
    const input = {
      ...baseInput,
      classification: 'fact' as MemoryClassification,
      evidence_refs: [],
    };

    expect(() => validateMemoryOnInsert(input)).toThrow(MemoryValidationError);
    expect(() => validateMemoryOnInsert(input)).toThrow(/evidence_ref/i);
  });

  it('Risk Signal without computation_id is rejected (Hard-Regel §2.4)', () => {
    const input = {
      ...baseInput,
      classification: 'risk_signal' as MemoryClassification,
      computation_id: null,
    };

    expect(() => validateMemoryOnInsert(input)).toThrow(MemoryValidationError);
    expect(() => validateMemoryOnInsert(input)).toThrow(/computation/i);
  });

  it('Inference without derived_from is rejected', () => {
    const input = {
      ...baseInput,
      classification: 'inference' as MemoryClassification,
      derived_from: [],
    };

    expect(() => validateMemoryOnInsert(input)).toThrow(MemoryValidationError);
  });

  it('Fact with evidence_refs passes validation', () => {
    const input = {
      ...baseInput,
      classification: 'fact' as MemoryClassification,
      evidence_refs: ['evt-1', 'evt-2'],
    };

    expect(() => validateMemoryOnInsert(input)).not.toThrow();
  });

  it('Risk Signal with computation_id passes validation', () => {
    const input = {
      ...baseInput,
      classification: 'risk_signal' as MemoryClassification,
      computation_id: 'comp-42',
    };

    expect(() => validateMemoryOnInsert(input)).not.toThrow();
  });
});

// ============================================================
// Purge Atomicity Tests (RFC-003 §4, §6)
// ============================================================

describe('RFC-003 / purge atomicity', () => {
  const expiredItem: MemoryItem = {
    id: 'mem-001',
    tenant_id: 'tenant-1',
    key: 'test',
    value: {},
    pii_class: 'public' as const,
    evidence_refs: ['evt-1'],
    derived_from: [],
    created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    freshness_half_life_days: 30,
    confidence: 0.5,
    relevance: 0.5,
    retention_class: '1y' as const,
    automated_purge_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    classification: 'inference' as MemoryClassification,
    state: 'expired' as MemoryState,
    state_transitioned_at: new Date(),
    regulatory_hold: false,
    incident_hold: false,
    supersedes_id: null,
    subject_ref: null,
    created_by: null,
    last_accessed_at: null,
    access_count: 0,
    correlation_id: null,
    computation_id: null,
  };

  it('can purge when state=expired and no holds', () => {
    expect(canPurgeMemory(expiredItem)).toBe(true);
  });

  it('cannot purge when regulatory_hold is set', () => {
    const item = { ...expiredItem, regulatory_hold: true };
    expect(canPurgeMemory(item)).toBe(false);
  });

  it('cannot purge when incident_hold is set', () => {
    const item = { ...expiredItem, incident_hold: true };
    expect(canPurgeMemory(item)).toBe(false);
  });

  it('cannot purge when state != expired', () => {
    const item = { ...expiredItem, state: 'archived' as MemoryState };
    expect(canPurgeMemory(item)).toBe(false);
  });
});

// ============================================================
// Effective Freshness Tests
// ============================================================

describe('RFC-003 / effective freshness per classification', () => {
  const now = new Date();

  it('Fact freshness is always 1.0 (no temporal decay)', () => {
    const item = {
      id: 'mem-001',
      tenant_id: 'tenant-1',
      key: 'fact',
      value: {},
      pii_class: 'public' as const,
      evidence_refs: ['evt-1'],
      derived_from: [],
      created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      freshness_half_life_days: 30,
      confidence: 1.0,
      relevance: 1.0,
      retention_class: '7y' as const,
      automated_purge_date: null,
      classification: 'fact' as MemoryClassification,
      state: 'active' as MemoryState,
      state_transitioned_at: new Date(),
      regulatory_hold: false,
      incident_hold: false,
      supersedes_id: null,
      subject_ref: null,
      created_by: null,
      last_accessed_at: null,
      access_count: 0,
      correlation_id: null,
      computation_id: null,
    };

    expect(getEffectiveFreshness(item)).toBeCloseTo(1.0, 6);
  });

  it('Inference freshness decays with time', () => {
    const item = {
      id: 'mem-001',
      tenant_id: 'tenant-1',
      key: 'inference',
      value: {},
      pii_class: 'public' as const,
      evidence_refs: [],
      derived_from: ['evt-1'],
      created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      freshness_half_life_days: 30,
      confidence: 0.8,
      relevance: 0.8,
      retention_class: '1y' as const,
      automated_purge_date: null,
      classification: 'inference' as MemoryClassification,
      state: 'active' as MemoryState,
      state_transitioned_at: new Date(),
      regulatory_hold: false,
      incident_hold: false,
      supersedes_id: null,
      subject_ref: null,
      created_by: null,
      last_accessed_at: null,
      access_count: 0,
      correlation_id: null,
      computation_id: null,
    };

    const freshness = getEffectiveFreshness(item);
    expect(freshness).toBeGreaterThan(0.4);
    expect(freshness).toBeLessThan(0.6);
  });
});

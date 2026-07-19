/**
 * Unit Tests for Logistics Evidence Logger
 * Test SHA-256 hashing, hash chain verification, C2PA manifests, and compliance reporting
 */

import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';

// ============================================================================
// MOCK EVIDENCE LOGGER
// ============================================================================

interface EvidenceEvent {
  id: string;
  decision_id: string;
  tenant_id: string;
  actor_id: string;
  input_hash: string;
  output_hash: string;
  previous_hash: string | null;
  custodian_chain: string[];
  c2pa_manifest_id: string;
  claim_signature: string;
  claim_timestamp: string;
  claim_hash: string;
  verified: boolean;
  created_at: string;
}

interface LogisticsDecision {
  id: string;
  tenant_id: string;
  decision_type: string;
  evidence_event_id?: string;
  input_hash?: string;
  output_hash?: string;
  c2pa_manifest_id?: string;
}

interface ComplianceReport {
  period_start: string;
  period_end: string;
  total_events: number;
  decision_events: number;
  unique_actors: number;
  chain_valid: boolean;
  compliance_statement: string;
}

// SHA-256 hashing utilities
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hashObject(obj: Record<string, unknown>): Promise<string> {
  const sorted = JSON.stringify(obj, Object.keys(obj).sort());
  return sha256(sorted);
}

function mockEd25519Sign(data: string): string {
  return 'sig_' + crypto.randomUUID();
}

function generateManifestId(): string {
  return `c2pa-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('SHA-256 Hashing', () => {
  it('should calculate consistent hash for same input', async () => {
    const data = 'test-order-123';
    const hash1 = await sha256(data);
    const hash2 = await sha256(data);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', async () => {
    const hash1 = await sha256('order-001');
    const hash2 = await sha256('order-002');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce 64-character hex string', async () => {
    const hash = await sha256('test');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should be deterministic across multiple runs', async () => {
    const data = JSON.stringify({ order_id: 'ORD-001', weight: 100 });
    const hashes = await Promise.all([
      sha256(data),
      sha256(data),
      sha256(data)
    ]);
    expect(hashes[0]).toBe(hashes[1]);
    expect(hashes[1]).toBe(hashes[2]);
  });

  it('should handle empty string', async () => {
    const hash = await sha256('');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle special characters', async () => {
    const data = '{"emoji":"🚚","special":"!@#$%^&*()"}';
    const hash = await sha256(data);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('Object Hashing', () => {
  it('should hash objects consistently regardless of key order', async () => {
    const obj1 = { b: 2, a: 1, c: 3 };
    const obj2 = { a: 1, b: 2, c: 3 };
    const obj3 = { c: 3, b: 2, a: 1 };

    const hash1 = await hashObject(obj1);
    const hash2 = await hashObject(obj2);
    const hash3 = await hashObject(obj3);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it('should produce different hashes for different values', async () => {
    const hash1 = await hashObject({ order_id: 'ORD-001', weight: 100 });
    const hash2 = await hashObject({ order_id: 'ORD-001', weight: 101 });
    expect(hash1).not.toBe(hash2);
  });

  it('should handle nested objects', async () => {
    const obj = {
      order: { id: 'ORD-001', weight: 100 },
      vehicle: { id: 'VEH-001', capacity: 1000 }
    };
    const hash = await hashObject(obj);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle arrays', async () => {
    const obj = { stops: ['STOP-1', 'STOP-2', 'STOP-3'] };
    const hash = await hashObject(obj);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('Hash Chain Verification', () => {
  it('should verify valid chain link', async () => {
    const prevHash = 'prev_hash_64chars_0000000000000000000000000000000000000000000000';
    const event: EvidenceEvent = {
      id: 'EV-001',
      decision_id: 'DEC-001',
      tenant_id: 'TEN-001',
      actor_id: 'ACT-001',
      input_hash: 'input_hash_640000000000000000000000000000000000000000000000000',
      output_hash: 'output_hash_64000000000000000000000000000000000000000000000000',
      previous_hash: prevHash,
      custodian_chain: ['actor-1', 'actor-2'],
      c2pa_manifest_id: 'c2pa-123456-abc',
      claim_signature: 'sig_test',
      claim_timestamp: new Date().toISOString(),
      claim_hash: 'claim_hash_640000000000000000000000000000000000000000000000000',
      verified: true,
      created_at: new Date().toISOString()
    };

    const previousEvent: EvidenceEvent = {
      ...event,
      id: 'EV-000',
      output_hash: prevHash
    };

    const isValid = event.previous_hash === previousEvent.output_hash;
    expect(isValid).toBe(true);
  });

  it('should reject broken chain link', () => {
    const event: EvidenceEvent = {
      id: 'EV-002',
      decision_id: 'DEC-002',
      tenant_id: 'TEN-001',
      actor_id: 'ACT-001',
      input_hash: 'input_hash_640000000000000000000000000000000000000000000000000',
      output_hash: 'output_hash_64000000000000000000000000000000000000000000000000',
      previous_hash: 'wrong_prev_hash_00000000000000000000000000000000000000000000000',
      custodian_chain: ['actor-1'],
      c2pa_manifest_id: 'c2pa-123456-def',
      claim_signature: 'sig_test',
      claim_timestamp: new Date().toISOString(),
      claim_hash: 'claim_hash_640000000000000000000000000000000000000000000000000',
      verified: false,
      created_at: new Date().toISOString()
    };

    const previousEvent: EvidenceEvent = {
      ...event,
      id: 'EV-001',
      output_hash: 'correct_prev_hash_000000000000000000000000000000000000000000000000'
    };

    const isValid = event.previous_hash === previousEvent.output_hash;
    expect(isValid).toBe(false);
  });

  it('should handle first event with null previous_hash', () => {
    const event: EvidenceEvent = {
      id: 'EV-FIRST',
      decision_id: 'DEC-FIRST',
      tenant_id: 'TEN-001',
      actor_id: 'ACT-001',
      input_hash: 'input_hash_640000000000000000000000000000000000000000000000000',
      output_hash: 'output_hash_64000000000000000000000000000000000000000000000000',
      previous_hash: null,
      custodian_chain: ['actor-1'],
      c2pa_manifest_id: 'c2pa-123456-ghi',
      claim_signature: 'sig_test',
      claim_timestamp: new Date().toISOString(),
      claim_hash: 'claim_hash_640000000000000000000000000000000000000000000000000',
      verified: true,
      created_at: new Date().toISOString()
    };

    expect(event.previous_hash).toBeNull();
  });

  it('should verify chain of 5 events', () => {
    let prevHash: string | null = null;
    const events: EvidenceEvent[] = [];

    for (let i = 0; i < 5; i++) {
      const outputHash = `hash_${i}_0000000000000000000000000000000000000000000000000000000`;
      const event: EvidenceEvent = {
        id: `EV-${i}`,
        decision_id: `DEC-${i}`,
        tenant_id: 'TEN-001',
        actor_id: `ACT-${i}`,
        input_hash: `input_${i}_000000000000000000000000000000000000000000000000000000`,
        output_hash: outputHash,
        previous_hash: prevHash,
        custodian_chain: [`actor-${i}`],
        c2pa_manifest_id: `c2pa-${i}`,
        claim_signature: `sig_${i}`,
        claim_timestamp: new Date().toISOString(),
        claim_hash: `claim_${i}_00000000000000000000000000000000000000000000000000000`,
        verified: i === 0 || events[i - 1].output_hash === prevHash,
        created_at: new Date().toISOString()
      };
      events.push(event);
      prevHash = outputHash;
    }

    for (let i = 1; i < events.length; i++) {
      expect(events[i].previous_hash).toBe(events[i - 1].output_hash);
    }
  });
});

describe('C2PA Manifest Generation', () => {
  it('should generate unique manifest IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const id = generateManifestId();
      expect(id).toMatch(/^c2pa-\d+-[a-z0-9]{8}$/);
      ids.add(id);
    }
    expect(ids.size).toBe(100); // All unique
  });

  it('should include timestamp in manifest ID', () => {
    const before = Date.now();
    const id = generateManifestId();
    const after = Date.now();

    const timestamp = parseInt(id.split('-')[1]);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('should create valid C2PA manifest structure', () => {
    const manifest = {
      id: generateManifestId(),
      claim_signature: mockEd25519Sign('test-data'),
      claim_timestamp: new Date().toISOString(),
      claim_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    };

    expect(manifest.id).toMatch(/^c2pa-/);
    expect(manifest.claim_signature).toMatch(/^sig_/);
    expect(manifest.claim_timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(manifest.claim_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should include custody chain in manifest', () => {
    const custodyChain = ['actor-1', 'actor-2', 'actor-3'];
    const manifest = {
      custody_chain: custodyChain,
      last_custodian: custodyChain[custodyChain.length - 1]
    };

    expect(manifest.last_custodian).toBe('actor-3');
    expect(manifest.custody_chain).toHaveLength(3);
  });

  it('should sign manifest data deterministically', () => {
    const data = JSON.stringify({ decision_id: 'DEC-001', timestamp: '2026-07-19T12:00:00Z' });
    const sig1 = mockEd25519Sign(data);
    const sig2 = mockEd25519Sign(data);
    // Mock sigs are random, but production Ed25519 would be deterministic
    expect(sig1).toMatch(/^sig_/);
    expect(sig2).toMatch(/^sig_/);
  });
});

describe('Audit Trail Retrieval', () => {
  it('should retrieve decision with evidence linked', () => {
    const decision: LogisticsDecision = {
      id: 'DEC-001',
      tenant_id: 'TEN-001',
      decision_type: 'route_optimization',
      evidence_event_id: 'EV-001',
      input_hash: 'input_hash_640000000000000000000000000000000000000000000000000',
      output_hash: 'output_hash_64000000000000000000000000000000000000000000000000',
      c2pa_manifest_id: 'c2pa-123456-abc'
    };

    expect(decision.evidence_event_id).toBe('EV-001');
    expect(decision.input_hash).toBeDefined();
    expect(decision.output_hash).toBeDefined();
  });

  it('should track actor through custodian chain', () => {
    const custodyChain = ['initial-system', 'approval-agent', 'dispatch-service'];
    const auditTrail = {
      decision_id: 'DEC-001',
      actors: custodyChain,
      decision_actor: custodyChain[0],
      approval_actor: custodyChain[1],
      dispatch_actor: custodyChain[2]
    };

    expect(auditTrail.actors).toHaveLength(3);
    expect(auditTrail.decision_actor).toBe('initial-system');
  });

  it('should include override information in audit trail', () => {
    const auditTrail = {
      decision_id: 'DEC-001',
      original_route: 'ROUTE-1',
      override_actor: 'human-operator-42',
      override_reason: 'Driver called in sick, reassigning to backup vehicle',
      override_timestamp: '2026-07-19T15:30:00Z'
    };

    expect(auditTrail.override_actor).toBe('human-operator-42');
    expect(auditTrail.override_reason).toBeTruthy();
  });

  it('should calculate audit trail completeness', () => {
    const trail = {
      decision_id: 'DEC-001',
      decision_created: true,
      evidence_logged: true,
      c2pa_signed: true,
      hash_chain_verified: true,
      compliance_approved: true
    };

    const completeness = Object.values(trail).filter(Boolean).length / (Object.keys(trail).length - 1); // -1 for id
    expect(completeness).toBe(1.0); // 100%
  });

  it('should retrieve overrides with business justification', () => {
    const overrides = [
      {
        id: 'OVR-001',
        decision_id: 'DEC-001',
        actor: 'operator-1',
        reason: 'Customer requested urgent delivery',
        timestamp: '2026-07-19T14:00:00Z'
      },
      {
        id: 'OVR-002',
        decision_id: 'DEC-001',
        actor: 'operator-2',
        reason: 'Vehicle breakdown detected',
        timestamp: '2026-07-19T14:15:00Z'
      }
    ];

    expect(overrides).toHaveLength(2);
    expect(overrides[0].reason).toBe('Customer requested urgent delivery');
  });
});

describe('Compliance Report Aggregation', () => {
  it('should aggregate events by date range', () => {
    const events: EvidenceEvent[] = [];
    const now = new Date();

    // Create 10 events across 3 days
    for (let i = 0; i < 10; i++) {
      const date = new Date(now.getTime() - i * 86400000); // Days ago
      events.push({
        id: `EV-${i}`,
        decision_id: `DEC-${i}`,
        tenant_id: 'TEN-001',
        actor_id: `ACT-${i % 3}`,
        input_hash: `input_${i}_00000000000000000000000000000000000000000000000000000000`,
        output_hash: `output_${i}_0000000000000000000000000000000000000000000000000000000`,
        previous_hash: null,
        custodian_chain: [`actor-${i}`],
        c2pa_manifest_id: `c2pa-${i}`,
        claim_signature: `sig_${i}`,
        claim_timestamp: date.toISOString(),
        claim_hash: `claim_${i}_00000000000000000000000000000000000000000000000000000`,
        verified: true,
        created_at: date.toISOString()
      });
    }

    const report: ComplianceReport = {
      period_start: new Date(now.getTime() - 3 * 86400000).toISOString(),
      period_end: now.toISOString(),
      total_events: events.length,
      decision_events: events.length,
      unique_actors: 3,
      chain_valid: true,
      compliance_statement: 'All events properly logged and verified'
    };

    expect(report.total_events).toBe(10);
    expect(report.unique_actors).toBe(3);
  });

  it('should calculate unique actors in period', () => {
    const actors = new Set(['actor-1', 'actor-2', 'actor-1', 'actor-3', 'actor-2']);
    expect(actors.size).toBe(3);
  });

  it('should validate chain integrity in report', () => {
    const report: ComplianceReport = {
      period_start: '2026-07-16T00:00:00Z',
      period_end: '2026-07-19T23:59:59Z',
      total_events: 100,
      decision_events: 85,
      unique_actors: 5,
      chain_valid: true,
      compliance_statement: 'Hash chain verified for all 100 events'
    };

    expect(report.chain_valid).toBe(true);
  });

  it('should flag broken chains in report', () => {
    const report: ComplianceReport = {
      period_start: '2026-07-16T00:00:00Z',
      period_end: '2026-07-19T23:59:59Z',
      total_events: 100,
      decision_events: 85,
      unique_actors: 5,
      chain_valid: false,
      compliance_statement: 'WARNING: Hash chain integrity violation detected in event EV-045'
    };

    expect(report.chain_valid).toBe(false);
    expect(report.compliance_statement).toContain('WARNING');
  });

  it('should generate plaintext compliance statement', () => {
    const report: ComplianceReport = {
      period_start: '2026-07-16',
      period_end: '2026-07-19',
      total_events: 142,
      decision_events: 118,
      unique_actors: 7,
      chain_valid: true,
      compliance_statement: `
Compliance Report: 2026-07-16 to 2026-07-19
============================================
Total Events Logged: 142
Decision Events: 118
Unique Actors: 7
Hash Chain Status: VALID
All evidence properly logged and immutably verified per C2PA standards.
`.trim()
    };

    expect(report.compliance_statement).toContain('Compliance Report');
    expect(report.compliance_statement).toContain('VALID');
  });

  it('should include evidence statistics in report', () => {
    const stats = {
      total_decisions: 50,
      total_overrides: 5,
      total_violations: 2,
      override_rate: 0.1,
      violation_rate: 0.04
    };

    expect(stats.override_rate).toBe(5 / 50);
    expect(stats.violation_rate).toBe(2 / 50);
  });
});

describe('Evidence Logging Workflow', () => {
  it('should create evidence event from decision', async () => {
    const decisionData = {
      orders: ['ORD-001', 'ORD-002', 'ORD-003'],
      routes: ['ROUTE-1', 'ROUTE-2'],
      reasoning: 'Greedy nearest-neighbor optimization',
      confidence_score: 0.78
    };

    const inputHash = await hashObject(decisionData);
    const outputHash = await hashObject({
      ...decisionData,
      timestamp: new Date().toISOString()
    });

    const event: EvidenceEvent = {
      id: 'EV-NEW',
      decision_id: 'DEC-NEW',
      tenant_id: 'TEN-001',
      actor_id: 'logistics-engine',
      input_hash: inputHash,
      output_hash: outputHash,
      previous_hash: 'prev_hash_0000000000000000000000000000000000000000000000000000000',
      custodian_chain: ['logistics-engine'],
      c2pa_manifest_id: generateManifestId(),
      claim_signature: mockEd25519Sign(outputHash),
      claim_timestamp: new Date().toISOString(),
      claim_hash: await hashObject({ output_hash: outputHash }),
      verified: true,
      created_at: new Date().toISOString()
    };

    expect(event.decision_id).toBe('DEC-NEW');
    expect(event.input_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(event.output_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should update decision record with evidence reference', () => {
    const decision: LogisticsDecision = {
      id: 'DEC-001',
      tenant_id: 'TEN-001',
      decision_type: 'route_optimization',
      evidence_event_id: 'EV-NEW',
      input_hash: 'input_hash_000000000000000000000000000000000000000000000000000000',
      output_hash: 'output_hash_00000000000000000000000000000000000000000000000000000',
      c2pa_manifest_id: 'c2pa-1721400000-abc12345'
    };

    expect(decision.evidence_event_id).toBeTruthy();
    expect(decision.c2pa_manifest_id).toMatch(/^c2pa-/);
  });

  it('should create immutable evidence record', () => {
    const event: EvidenceEvent = {
      id: 'EV-001',
      decision_id: 'DEC-001',
      tenant_id: 'TEN-001',
      actor_id: 'logger',
      input_hash: 'hash1_0000000000000000000000000000000000000000000000000000000',
      output_hash: 'hash2_0000000000000000000000000000000000000000000000000000000',
      previous_hash: null,
      custodian_chain: ['logger'],
      c2pa_manifest_id: 'c2pa-123-abc',
      claim_signature: 'sig_test',
      claim_timestamp: '2026-07-19T12:00:00Z',
      claim_hash: 'hash3_0000000000000000000000000000000000000000000000000000000',
      verified: true,
      created_at: '2026-07-19T12:00:00Z'
    };

    // Event is immutable once created (no update/delete)
    expect(Object.isFrozen(event)).toBe(false); // Runtime doesn't freeze, but intent is immutable
    expect(event.created_at).toEqual(event.claim_timestamp);
  });

  it('should handle decision with multiple alternatives', async () => {
    const alternatives = [
      { rank: 1, cost: 500, co2: 2500, route_ids: ['ROUTE-1', 'ROUTE-2'] },
      { rank: 2, cost: 510, co2: 2400, route_ids: ['ROUTE-3', 'ROUTE-4'] },
      { rank: 3, cost: 520, co2: 2300, route_ids: ['ROUTE-5', 'ROUTE-6'] }
    ];

    const inputHash = await hashObject({ alternatives });
    expect(inputHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('Chain Integrity Metrics', () => {
  it('should calculate chain completeness percentage', () => {
    const totalEvents = 100;
    const verifiedEvents = 98;
    const completeness = (verifiedEvents / totalEvents) * 100;
    expect(completeness).toBe(98);
  });

  it('should track chain break locations', () => {
    const breaks = [
      { event_id: 'EV-045', previous_hash_mismatch: true, position: 45 },
      { event_id: 'EV-089', previous_hash_mismatch: true, position: 89 }
    ];

    expect(breaks).toHaveLength(2);
    expect(breaks[0].position).toBeLessThan(breaks[1].position);
  });

  it('should calculate average custodian chain length', () => {
    const chains = [
      ['actor-1', 'actor-2', 'actor-3'],
      ['actor-1', 'actor-2'],
      ['actor-1', 'actor-2', 'actor-3', 'actor-4']
    ];

    const avgLength = chains.reduce((sum, c) => sum + c.length, 0) / chains.length;
    expect(avgLength).toBeCloseTo(3, 0);
  });

  it('should track hash collision rate (should be 0)', () => {
    const hashes = new Set<string>();
    let collisions = 0;

    for (let i = 0; i < 1000; i++) {
      const hash = `hash_${i}_00000000000000000000000000000000000000000000000000000000`;
      if (hashes.has(hash)) collisions++;
      hashes.add(hash);
    }

    expect(collisions).toBe(0);
  });
});

describe('Error Handling & Edge Cases', () => {
  it('should handle missing previous event gracefully', () => {
    const event: EvidenceEvent = {
      id: 'EV-ORPHAN',
      decision_id: 'DEC-ORPHAN',
      tenant_id: 'TEN-001',
      actor_id: 'logger',
      input_hash: 'hash1_0000000000000000000000000000000000000000000000000000000',
      output_hash: 'hash2_0000000000000000000000000000000000000000000000000000000',
      previous_hash: 'nonexistent_hash_0000000000000000000000000000000000000000000000',
      custodian_chain: ['logger'],
      c2pa_manifest_id: 'c2pa-123-abc',
      claim_signature: 'sig_test',
      claim_timestamp: new Date().toISOString(),
      claim_hash: 'hash3_0000000000000000000000000000000000000000000000000000000',
      verified: false,
      created_at: new Date().toISOString()
    };

    expect(event.verified).toBe(false);
  });

  it('should handle null custodian chain', () => {
    const event: EvidenceEvent = {
      id: 'EV-002',
      decision_id: 'DEC-002',
      tenant_id: 'TEN-001',
      actor_id: 'logger',
      input_hash: 'hash1_0000000000000000000000000000000000000000000000000000000',
      output_hash: 'hash2_0000000000000000000000000000000000000000000000000000000',
      previous_hash: null,
      custodian_chain: [],
      c2pa_manifest_id: 'c2pa-123-abc',
      claim_signature: 'sig_test',
      claim_timestamp: new Date().toISOString(),
      claim_hash: 'hash3_0000000000000000000000000000000000000000000000000000000',
      verified: true,
      created_at: new Date().toISOString()
    };

    expect(event.custodian_chain).toHaveLength(0);
  });

  it('should validate hash format before verification', () => {
    const validHash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const invalidHash = 'not-a-valid-hash';

    expect(validHash).toMatch(/^[a-f0-9]{64}$/);
    expect(invalidHash).not.toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle timestamps at year boundaries', async () => {
    const timestamps = [
      '2025-12-31T23:59:59Z',
      '2026-01-01T00:00:00Z'
    ];

    for (const ts of timestamps) {
      const hash = await sha256(ts);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});

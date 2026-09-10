import { describe, expect, it } from 'vitest';
import type { DbGovernanceEvent, DbGovernanceEvidence } from '@/src/features/governance/governanceApi';
import {
  computeVaultMetrics,
  eventToAuditEntry,
  eventToChangeEntry,
  eventToEvidenceItem,
  evidenceToItem,
  mergeTimeline,
  relativeTime,
} from '@/src/features/governance/evidence/evidenceVaultData';

const NOW = Date.parse('2026-09-10T12:00:00Z');

function event(overrides: Partial<DbGovernanceEvent> = {}): DbGovernanceEvent {
  return {
    id: 'evt-aaaa-bbbb',
    tenant_id: 't-1',
    asset_id: null,
    policy_id: null,
    event_type: 'scan.completed',
    event_source: 'website_scanner',
    title: 'Scan abgeschlossen',
    summary: '2 Findings',
    risk_level: 'medium',
    actor_email: null,
    vendor: 'example.de',
    model_name: null,
    data_types: [],
    policy_action: null,
    payload: { url: 'https://example.de', hash: 'sha256:abc' },
    created_at: '2026-09-10T11:00:00Z',
    ...overrides,
  };
}

function evidence(overrides: Partial<DbGovernanceEvidence> = {}): DbGovernanceEvidence {
  return {
    id: 'evd-1',
    tenant_id: 't-1',
    event_id: 'evt-aaaa-bbbb',
    asset_id: null,
    evidence_type: 'screenshot',
    title: 'Cookie-Banner Zustand',
    storage_path: null,
    content_hash: 'sha256:fff',
    previous_hash: null,
    metadata: { domain: 'example.de' },
    created_at: '2026-09-10T11:30:00Z',
    ...overrides,
  };
}

describe('evidence vault mapping', () => {
  it('maps events without falling back to demo domains', () => {
    const item = eventToEvidenceItem(event(), NOW);
    expect(item.type).toBe('Scan Report');
    expect(item.domain).toBe('https://example.de');
    expect(item.hash).toBe('sha256:abc');
    expect(item.eventId).toBe('evt-aaaa-bbbb');
    expect(item.ts).toBe('vor 1 Std.');
  });

  it('treats content_hash as signed evidence', () => {
    const item = evidenceToItem(evidence(), NOW);
    expect(item.c2pa).toBe(true);
    expect(item.type).toBe('Screenshot');
  });

  it('merges evidence first and skips duplicate event rows', () => {
    const merged = mergeTimeline([event()], [evidence()], NOW);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('evd-1');
  });

  it('keeps events that have no evidence row', () => {
    const merged = mergeTimeline([event({ id: 'evt-orphan' })], [evidence()], NOW);
    expect(merged.map((i) => i.id).sort()).toEqual(['evd-1', 'evt-orphan']);
  });

  it('computes honest metrics instead of 1.247', () => {
    const metrics = computeVaultMetrics([
      evidence(),
      evidence({ id: 'evd-2', content_hash: null, created_at: '2026-08-01T00:00:00Z' }),
    ], NOW);
    expect(metrics.total).toBe(2);
    expect(metrics.signed).toBe(1);
    expect(metrics.thisWeek).toBe(1);
    expect(metrics.lastCreated).toBe('vor 30 Min.');
  });

  it('maps audit actors from email vs runtime', () => {
    expect(eventToAuditEntry(event({ actor_email: 'dpo@example.de' }), NOW).actorType).toBe('user');
    expect(eventToAuditEntry(event({ event_source: 'agent_runtime' }), NOW).actorType).toBe('agent');
  });

  it('only emits change rows when payload has a diff', () => {
    expect(eventToChangeEntry(event(), NOW)).toBeNull();
    const change = eventToChangeEntry(event({
      event_type: 'policy.change',
      payload: { field: 'AVV', before: 'v1', after: 'v2' },
    }), NOW);
    expect(change?.type).toBe('Geändert');
    expect(change?.before).toBe('v1');
  });

  it('formats relative time', () => {
    expect(relativeTime('2026-09-10T11:59:00Z', NOW)).toBe('vor 1 Min.');
  });
});

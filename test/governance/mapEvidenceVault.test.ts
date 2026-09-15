import { describe, expect, it } from 'vitest';
import {
  computeVaultMetrics,
  eventToAuditEntry,
  eventToEvidenceItem,
  formatRelativeTs,
} from '../../src/features/governance/evidence/mapEvidenceVault';
import type { DbGovernanceEvent } from '../../src/features/governance/governanceApi';

function event(overrides: Partial<DbGovernanceEvent> = {}): DbGovernanceEvent {
  return {
    id: 'evt-1',
    tenant_id: 't-1',
    asset_id: null,
    policy_id: null,
    event_type: 'scan',
    event_source: 'website_scanner',
    title: 'Scan abgeschlossen',
    summary: 'Cookie-Scan ohne Auffälligkeiten.',
    risk_level: 'low',
    actor_email: null,
    vendor: null,
    model_name: null,
    data_types: [],
    policy_action: null,
    payload: {},
    created_at: '2026-09-10T10:00:00.000Z',
    ...overrides,
  };
}

describe('formatRelativeTs', () => {
  const now = new Date('2026-09-10T12:00:00.000Z');

  it('formats minutes, hours and days without inventing a timestamp', () => {
    expect(formatRelativeTs('2026-09-10T11:40:00.000Z', now)).toBe('vor 20 Min.');
    expect(formatRelativeTs('2026-09-10T09:00:00.000Z', now)).toBe('vor 3 Std.');
    expect(formatRelativeTs('2026-09-08T12:00:00.000Z', now)).toBe('vor 2 Tagen');
  });

  it('returns an em dash for invalid dates', () => {
    expect(formatRelativeTs('not-a-date', now)).toBe('–');
  });
});

describe('eventToEvidenceItem', () => {
  it('does not invent a hash when none is stored', () => {
    const item = eventToEvidenceItem(event());
    expect(item.hash).toBe('—');
    expect(item.c2pa).toBe(false);
    expect(item.type).toBe('Scan Report');
    expect(item.title).toBe('Scan abgeschlossen');
  });

  it('uses payload.hash when it is long enough', () => {
    const item = eventToEvidenceItem(event({
      payload: { hash: 'sha256:0123456789abcdef', url: 'https://example.de' },
    }));
    expect(item.hash).toBe('sha256:0123456789abcdef');
    expect(item.domain).toBe('https://example.de');
  });

  it('falls back from a short payload.hash to a valid content_hash', () => {
    const item = eventToEvidenceItem(event({
      payload: { hash: 'short', content_hash: 'sha256:0123456789abcdef' },
    }));
    expect(item.hash).toBe('sha256:0123456789abcdef');
  });

  it('marks C2PA only when the payload flag is true', () => {
    expect(eventToEvidenceItem(event({ payload: { c2pa: true } })).c2pa).toBe(true);
    expect(eventToEvidenceItem(event({ payload: { c2pa: 'yes' } })).c2pa).toBe(false);
  });

  it('does not invent atelier-nord demo content', () => {
    expect(JSON.stringify(eventToEvidenceItem(event()))).not.toMatch(/atelier-nord/i);
  });
});

describe('eventToAuditEntry', () => {
  it('maps user actors and risk to Prüfpfad outcome', () => {
    const entry = eventToAuditEntry(event({
      actor_email: 'dpo@example.de',
      risk_level: 'critical',
      title: 'Meldepflichtiger Scan',
    }));
    expect(entry.actor).toBe('dpo@example.de');
    expect(entry.actorType).toBe('user');
    expect(entry.outcome).toBe('error');
    expect(entry.action).toBe('Meldepflichtiger Scan');
  });

  it('treats agent_runtime as agent and high risk as warning', () => {
    const entry = eventToAuditEntry(event({
      event_source: 'agent_runtime',
      risk_level: 'high',
    }));
    expect(entry.actorType).toBe('agent');
    expect(entry.outcome).toBe('warning');
  });
});

describe('computeVaultMetrics', () => {
  const now = new Date('2026-09-10T12:00:00.000Z');

  it('stays at zero without a seed', () => {
    expect(computeVaultMetrics([], now)).toEqual({ total: 0, hashed: 0, c2pa: 0, thisWeek: 0 });
  });

  it('counts hashes, C2PA flags and this-week events from live rows', () => {
    const metrics = computeVaultMetrics([
      event({
        id: 'a',
        payload: { hash: 'sha256:0123456789abcdef', c2pa: true },
        created_at: '2026-09-09T12:00:00.000Z',
      }),
      event({
        id: 'b',
        payload: { content_hash: 'short' },
        created_at: '2026-08-01T12:00:00.000Z',
      }),
      event({
        id: 'c',
        payload: { hash: 'short', content_hash: 'sha256:fedcba9876543210' },
        created_at: '2026-08-01T12:00:00.000Z',
      }),
    ], now);
    expect(metrics).toEqual({ total: 3, hashed: 2, c2pa: 1, thisWeek: 1 });
  });
});

import { describe, it, expect } from 'vitest';
import {
  actionBucket,
  relativeTime,
  riskTone,
  summarizeGovernanceEvents,
  summarizeWebhookEvents,
} from '../../src/lib/audit/telemetryHelpers';

const NOW = Date.UTC(2026, 4, 16, 12, 0, 0);
const MIN = 60 * 1000;
const HR = 60 * MIN;
const DAY = 24 * HR;

describe('actionBucket', () => {
  it('maps create-like verbs', () => {
    expect(actionBucket('asset.create')).toBe('create');
    expect(actionBucket('mapping.upsert')).toBe('create');
    expect(actionBucket('policy.insert')).toBe('create');
  });
  it('maps update / delete / enable / disable / approve / reject', () => {
    expect(actionBucket('policy.update')).toBe('update');
    expect(actionBucket('asset.archive')).toBe('delete');
    expect(actionBucket('policy.enable')).toBe('enable');
    expect(actionBucket('policy.disable')).toBe('disable');
    expect(actionBucket('approval.approve')).toBe('approve');
    expect(actionBucket('approval.reject')).toBe('reject');
  });
  it('falls back to "other"', () => {
    expect(actionBucket(null)).toBe('other');
    expect(actionBucket('')).toBe('other');
    expect(actionBucket('policy.sync')).toBe('other');
  });
});

describe('riskTone', () => {
  it('returns the matching tone for valid levels', () => {
    expect(riskTone('critical').label).toBe('Critical');
    expect(riskTone('high').label).toBe('High');
    expect(riskTone('info').label).toBe('Info');
  });
  it('falls back to info for unknown levels', () => {
    expect(riskTone('blocker').label).toBe('Info');
    expect(riskTone(null).label).toBe('Info');
    expect(riskTone(undefined).label).toBe('Info');
  });
});

describe('relativeTime', () => {
  it('< 1 min → "gerade eben"', () => {
    expect(relativeTime(new Date(NOW - 30_000).toISOString(), NOW)).toBe('gerade eben');
  });
  it('< 60 min → minutes', () => {
    expect(relativeTime(new Date(NOW - 12 * MIN).toISOString(), NOW)).toBe('vor 12 Min.');
  });
  it('< 24 h → hours', () => {
    expect(relativeTime(new Date(NOW - 3 * HR).toISOString(), NOW)).toBe('vor 3 Std.');
  });
  it('< 7 d → days', () => {
    expect(relativeTime(new Date(NOW - 2 * DAY).toISOString(), NOW)).toBe('vor 2d');
  });
  it('older → locale date string (not relative)', () => {
    const out = relativeTime(new Date(NOW - 30 * DAY).toISOString(), NOW);
    expect(out).not.toContain('vor ');
    expect(out).not.toBe('gerade eben');
  });
  it('invalid iso → returns input unchanged', () => {
    expect(relativeTime('not-a-date', NOW)).toBe('not-a-date');
  });
});

describe('summarizeWebhookEvents', () => {
  it('handles empty input', () => {
    expect(summarizeWebhookEvents([])).toEqual({
      total: 0,
      by_type: [],
      by_hour: [],
      oldest: null,
      newest: null,
    });
  });

  it('groups by type and hour, sorted', () => {
    const rows = [
      { id: 'e1', type: 'invoice.paid',      processed_at: new Date(NOW - 30 * MIN).toISOString() },
      { id: 'e2', type: 'invoice.paid',      processed_at: new Date(NOW - 25 * MIN).toISOString() },
      { id: 'e3', type: 'charge.failed',     processed_at: new Date(NOW - 2 * HR).toISOString() },
      { id: 'e4', type: 'invoice.paid',      processed_at: new Date(NOW - 90 * MIN).toISOString() },
    ];
    const out = summarizeWebhookEvents(rows);
    expect(out.total).toBe(4);
    expect(out.by_type[0]).toEqual({ type: 'invoice.paid', count: 3 });
    expect(out.by_type[1]).toEqual({ type: 'charge.failed', count: 1 });
    expect(out.by_hour.length).toBeGreaterThan(0);
    expect(out.oldest).toBe(new Date(NOW - 2 * HR).toISOString());
    expect(out.newest).toBe(new Date(NOW - 25 * MIN).toISOString());
  });
});

describe('summarizeGovernanceEvents', () => {
  it('counts by risk_level and event_type', () => {
    const out = summarizeGovernanceEvents([
      { id: '1', risk_level: 'critical', event_type: 'policy.violation' },
      { id: '2', risk_level: 'high',     event_type: 'policy.violation' },
      { id: '3', risk_level: 'medium',   event_type: 'asset.discovered' },
      { id: '4', risk_level: 'critical', event_type: 'policy.violation' },
      { id: '5', risk_level: 'info',     event_type: 'audit.created' },
      { id: '6', risk_level: 'low',      event_type: 'audit.created' },
      { id: '7', risk_level: 'bogus',    event_type: 'audit.created' }, // unknown → not counted
    ]);
    expect(out.total).toBe(7);
    expect(out.by_risk).toEqual({ info: 1, low: 1, medium: 1, high: 1, critical: 2 });
    expect(out.by_event_type[0]).toEqual({ event_type: 'policy.violation', count: 3 });
    expect(out.by_event_type[1]).toEqual({ event_type: 'audit.created', count: 3 });
  });

  it('empty input → zero-shape', () => {
    expect(summarizeGovernanceEvents([])).toEqual({
      total: 0,
      by_risk: { info: 0, low: 0, medium: 0, high: 0, critical: 0 },
      by_event_type: [],
    });
  });
});

import { describe, it, expect } from 'vitest';
import { summarizeObservations, relativeTimeDe } from '../../src/features/governance/agents/agentActivity';

describe('summarizeObservations', () => {
  it('counts by severity and reports the top severity', () => {
    const s = summarizeObservations([
      { severity: 'medium', created_at: 'x' },
      { severity: 'critical', created_at: 'x' },
      { severity: 'medium', created_at: 'x' },
      { severity: 'low', created_at: 'x' },
    ]);
    expect(s.total).toBe(4);
    expect(s.critical).toBe(1);
    expect(s.medium).toBe(2);
    expect(s.low).toBe(1);
    expect(s.topSeverity).toBe('critical');
  });

  it('returns null topSeverity for an empty list', () => {
    expect(summarizeObservations([]).topSeverity).toBeNull();
  });

  it('treats unknown severity strings as info', () => {
    const s = summarizeObservations([{ severity: 'weird', created_at: 'x' }]);
    expect(s.info).toBe(1);
    expect(s.topSeverity).toBe('info');
  });
});

describe('relativeTimeDe', () => {
  const now = new Date('2026-06-26T12:00:00Z');
  it('formats minutes, hours and days in German', () => {
    expect(relativeTimeDe(new Date(now.getTime() - 30_000).toISOString(), now)).toBe('gerade eben');
    expect(relativeTimeDe(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe('vor 5 min');
    expect(relativeTimeDe(new Date(now.getTime() - 3 * 3_600_000).toISOString(), now)).toBe('vor 3 h');
    expect(relativeTimeDe(new Date(now.getTime() - 24 * 3_600_000).toISOString(), now)).toBe('vor 1 Tag');
    expect(relativeTimeDe(new Date(now.getTime() - 48 * 3_600_000).toISOString(), now)).toBe('vor 2 Tagen');
  });

  it('returns a dash for invalid input', () => {
    expect(relativeTimeDe('not-a-date', now)).toBe('—');
  });
});

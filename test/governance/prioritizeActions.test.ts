import { describe, it, expect } from 'vitest';
import { prioritizeActions } from '../../src/features/governance/cockpit/prioritizeActions';

const NOW = new Date('2026-06-19T12:00:00Z');
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

describe('prioritizeActions', () => {
  it('returns an empty list for empty input', () => {
    expect(prioritizeActions({ now: NOW })).toEqual([]);
  });

  it('ranks a critical near-deadline incident above a distant DPIA review', () => {
    const result = prioritizeActions({
      now: NOW,
      incidents: [{ id: 'inc1', title: 'Datenleck', severity: 'critical', status: 'open', notification_deadline_at: inHours(10) }],
      dpias: [{ id: 'dpia1', title: 'DSFA Chatbot', status: 'in_review', review_due_at: inHours(20 * 24) }],
    });
    expect(result[0].id).toBe('inc1');
    expect(result[0].kind).toBe('incident');
    expect(result[0].level).toBe('critical');
  });

  it('excludes closed incidents and completed DSRs', () => {
    const result = prioritizeActions({
      now: NOW,
      incidents: [{ id: 'inc1', title: 'x', severity: 'high', status: 'resolved', notification_deadline_at: inHours(1) }],
      dsrs: [{ id: 'dsr1', request_type: 'access', status: 'completed', deadline_at: inHours(-5), completed_at: inHours(-2) }],
    });
    expect(result).toEqual([]);
  });

  it('treats an overdue DSR as high severity with overdue urgency bonus', () => {
    const result = prioritizeActions({
      now: NOW,
      dsrs: [{ id: 'dsr1', request_type: 'erasure', status: 'in_progress', deadline_at: inHours(-48), completed_at: null }],
    });
    expect(result[0].level).toBe('high');
    expect(result[0].hoursRemaining).toBeLessThan(0);
    // high (70) + overdue bonus (60) = 130
    expect(result[0].weight).toBe(130);
  });

  it('caps the result at the requested limit', () => {
    const incidents = Array.from({ length: 6 }, (_, i) => ({
      id: `inc${i}`, title: `i${i}`, severity: 'medium', status: 'open', notification_deadline_at: inHours(i + 1),
    }));
    expect(prioritizeActions({ now: NOW, incidents }, 3)).toHaveLength(3);
  });
});

import { describe, it, expect } from 'vitest';
import {
  evaluateDeadlines,
  isAlertWorthy,
} from '../../supabase/functions/_shared/agents/deadlineSentinel.ts';

const NOW = new Date('2026-06-26T12:00:00Z');
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

describe('evaluateDeadlines — incidents', () => {
  it('flags an overdue incident as critical/overdue with a stable dedupeKey', () => {
    const out = evaluateDeadlines({
      now: NOW,
      incidents: [{ id: 'i1', title: 'Datenleck', severity: 'high', status: 'open', notification_deadline_at: inHours(-5) }],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ subjectType: 'incident', severity: 'critical', stage: 'overdue', dedupeKey: 'incident:i1:overdue' });
    expect(out[0].hoursRemaining).toBeLessThan(0);
  });

  it('flags an incident due within 24h as high, within 72h as medium', () => {
    const out = evaluateDeadlines({
      now: NOW,
      incidents: [
        { id: 'soon', title: 'A', severity: 'low', status: 'investigating', notification_deadline_at: inHours(10) },
        { id: 'later', title: 'B', severity: 'low', status: 'investigating', notification_deadline_at: inHours(48) },
      ],
    });
    const soon = out.find((f) => f.subjectId === 'soon');
    const later = out.find((f) => f.subjectId === 'later');
    expect(soon).toMatchObject({ severity: 'high', stage: 'due_soon' });
    expect(later).toMatchObject({ severity: 'medium', stage: 'due_soon' });
  });

  it('ignores closed incidents and ones beyond the window', () => {
    const out = evaluateDeadlines({
      now: NOW,
      incidents: [
        { id: 'resolved', title: 'x', severity: 'critical', status: 'resolved', notification_deadline_at: inHours(-1) },
        { id: 'reported', title: 'y', severity: 'critical', status: 'reported_to_authority', notification_deadline_at: inHours(-1) },
        { id: 'far', title: 'z', severity: 'high', status: 'open', notification_deadline_at: inHours(200) },
        { id: 'nodeadline', title: 'w', severity: 'high', status: 'open', notification_deadline_at: null },
      ],
    });
    expect(out).toEqual([]);
  });
});

describe('evaluateDeadlines — dpias & dsrs', () => {
  it('flags an open DPIA review due within 30 days as medium/due_soon', () => {
    const out = evaluateDeadlines({
      now: NOW,
      dpias: [{ id: 'd1', title: 'DSFA Chatbot', status: 'in_review', review_due_at: inHours(20 * 24) }],
    });
    expect(out[0]).toMatchObject({ subjectType: 'dpia', severity: 'medium', stage: 'due_soon', dedupeKey: 'dpia:d1:due_soon' });
  });

  it('flags an overdue DPIA as high and ignores approved ones', () => {
    const out = evaluateDeadlines({
      now: NOW,
      dpias: [
        { id: 'over', title: 'a', status: 'draft', review_due_at: inHours(-24) },
        { id: 'done', title: 'b', status: 'approved', review_due_at: inHours(-24) },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ subjectId: 'over', severity: 'high', stage: 'overdue' });
  });

  it('excludes completed DSRs and flags overdue open ones as high', () => {
    const out = evaluateDeadlines({
      now: NOW,
      dsrs: [
        { id: 'open', request_type: 'erasure', status: 'in_progress', deadline_at: inHours(-48), completed_at: null },
        { id: 'closed', request_type: 'access', status: 'completed', deadline_at: inHours(-48), completed_at: inHours(-2) },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ subjectType: 'dsr', subjectId: 'open', severity: 'high', stage: 'overdue' });
  });
});

describe('isAlertWorthy', () => {
  it('treats high and critical as alert-worthy, lower as not', () => {
    expect(isAlertWorthy('critical')).toBe(true);
    expect(isAlertWorthy('high')).toBe(true);
    expect(isAlertWorthy('medium')).toBe(false);
    expect(isAlertWorthy('low')).toBe(false);
  });
});

describe('determinism', () => {
  it('produces identical output for identical input', () => {
    const input = {
      now: NOW,
      incidents: [{ id: 'i1', title: 'x', severity: 'high', status: 'open', notification_deadline_at: inHours(-5) }],
      dpias: [{ id: 'd1', title: 'y', status: 'draft', review_due_at: inHours(5 * 24) }],
    };
    expect(evaluateDeadlines(input)).toEqual(evaluateDeadlines(input));
  });
});

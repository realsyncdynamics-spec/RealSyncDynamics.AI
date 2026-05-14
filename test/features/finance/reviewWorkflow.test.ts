import { describe, it, expect } from 'vitest';
import {
  allowedNextStatuses,
  canTransition,
  isTerminal,
  statusChangeTimestamps,
  isOpenReview,
  compareByPriority,
  statusToneOf,
  STATUS_LABEL,
  STATUS_PRIORITY,
  REVIEW_DISCLAIMER,
  type ReviewStatus,
} from '../../../src/features/finance/reviewWorkflow';

describe('state-machine transitions', () => {
  it('requested → in_review, rejected, completed are allowed', () => {
    expect(canTransition('requested', 'in_review')).toBe(true);
    expect(canTransition('requested', 'rejected')).toBe(true);
    expect(canTransition('requested', 'completed')).toBe(true);
  });

  it('requested → confirmed is NOT allowed (must pass through in_review)', () => {
    expect(canTransition('requested', 'confirmed')).toBe(false);
  });

  it('in_review → confirmed, rejected, completed', () => {
    expect(canTransition('in_review', 'confirmed')).toBe(true);
    expect(canTransition('in_review', 'rejected')).toBe(true);
    expect(canTransition('in_review', 'completed')).toBe(true);
  });

  it('confirmed only moves to completed', () => {
    expect(allowedNextStatuses('confirmed')).toEqual(['completed']);
  });

  it('rejected can re-submit to requested OR close to completed', () => {
    expect(canTransition('rejected', 'requested')).toBe(true);
    expect(canTransition('rejected', 'completed')).toBe(true);
    expect(canTransition('rejected', 'in_review')).toBe(false);
  });

  it('completed is terminal', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(allowedNextStatuses('completed')).toEqual([]);
  });

  it('non-terminal statuses are not terminal', () => {
    (['requested', 'in_review', 'confirmed', 'rejected'] as ReviewStatus[]).forEach((s) => {
      expect(isTerminal(s)).toBe(false);
    });
  });
});

describe('statusChangeTimestamps', () => {
  it('confirmed and rejected stamp decided_at', () => {
    expect(statusChangeTimestamps('confirmed', () => '2026-05-14T12:00:00Z'))
      .toEqual({ decided_at: '2026-05-14T12:00:00Z' });
    expect(statusChangeTimestamps('rejected', () => '2026-05-14T13:00:00Z'))
      .toEqual({ decided_at: '2026-05-14T13:00:00Z' });
  });

  it('completed stamps completed_at', () => {
    expect(statusChangeTimestamps('completed', () => '2026-05-15T08:00:00Z'))
      .toEqual({ completed_at: '2026-05-15T08:00:00Z' });
  });

  it('non-terminal moves do not stamp anything', () => {
    expect(statusChangeTimestamps('in_review', () => '2026-05-14T12:00:00Z')).toEqual({});
    expect(statusChangeTimestamps('requested', () => '2026-05-14T12:00:00Z')).toEqual({});
  });

  it('falls back to Date.now() when no clock is injected', () => {
    const r = statusChangeTimestamps('confirmed');
    expect(typeof r.decided_at).toBe('string');
    // Parses as a valid ISO date
    expect(Number.isNaN(new Date(r.decided_at!).getTime())).toBe(false);
  });
});

describe('UI helpers', () => {
  it('isOpenReview keeps everything but completed open', () => {
    expect(isOpenReview('completed')).toBe(false);
    (['requested', 'in_review', 'confirmed', 'rejected'] as ReviewStatus[]).forEach((s) => {
      expect(isOpenReview(s)).toBe(true);
    });
  });

  it('compareByPriority sorts rejected first, in_review next, completed last', () => {
    const arr: ReviewStatus[] = ['completed', 'rejected', 'requested', 'in_review', 'confirmed'];
    const sorted = [...arr].sort(compareByPriority);
    expect(sorted[0]).toBe('rejected');
    expect(sorted[sorted.length - 1]).toBe('completed');
  });

  it('every status has a label, priority, tone', () => {
    (['requested', 'in_review', 'confirmed', 'rejected', 'completed'] as ReviewStatus[]).forEach((s) => {
      expect(STATUS_LABEL[s]).toBeTruthy();
      expect(typeof STATUS_PRIORITY[s]).toBe('number');
      expect(['neutral', 'attention', 'success', 'warning']).toContain(statusToneOf(s));
    });
  });
});

describe('positioning disclaimer', () => {
  it('mentions Steuerberatung-not-replaced + non-binding wording', () => {
    expect(REVIEW_DISCLAIMER).toMatch(/Steuerberatung/i);
    expect(REVIEW_DISCLAIMER).toMatch(/keine verbindlichen Aussagen/i);
  });
});

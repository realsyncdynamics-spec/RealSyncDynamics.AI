import { describe, expect, it } from 'vitest';
import {
  isTransformationEventName,
  isValidTransformationEvent,
  sanitizeTransformationEvent,
  type TransformationEvent,
} from '../../src/lib/business/transformationEventLedger';

const base: TransformationEvent = {
  event_id: 'evt_1',
  event_name: 'transformation_paid',
  occurred_at: '2026-08-15T12:00:00.000Z',
  price_cohort: 'reference_349',
  currency: 'EUR',
  amount_cents: 34_900,
};

describe('transformation event ledger', () => {
  it('accepts known event names', () => {
    expect(isTransformationEventName('preview_started')).toBe(true);
    expect(isTransformationEventName('not_a_real_event')).toBe(false);
  });

  it('validates the event contract', () => {
    expect(isValidTransformationEvent(base)).toBe(true);
    expect(isValidTransformationEvent({ ...base, amount_cents: -1 })).toBe(false);
    expect(isValidTransformationEvent({ ...base, occurred_at: 'invalid' })).toBe(false);
  });

  it('strips unapproved free-form metadata', () => {
    const sanitized = sanitizeTransformationEvent({
      ...base,
      metadata: {
        variant: 'modern',
        source: 'public_preview',
        customer_email: 'should-not-be-stored',
        page_html: 'should-not-be-stored',
      },
    });

    expect(sanitized.metadata).toEqual({ variant: 'modern', source: 'public_preview' });
  });
});

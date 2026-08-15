import { describe, expect, it } from 'vitest';
import {
  aggregateTransformationFunnel,
  compareTransformationExperiments,
  type TransformationFunnelEvent,
} from '../../src/lib/business/transformationFunnelMetrics';

const START = Date.UTC(2026, 7, 1);
const END = Date.UTC(2026, 7, 15);

function event(
  name: TransformationFunnelEvent['name'],
  id: string,
  experiment: TransformationFunnelEvent['experiment'] = 'reference_349',
  amount_cents: number | null = null,
): TransformationFunnelEvent {
  return {
    event_id: id,
    name,
    occurred_at: new Date(Date.UTC(2026, 7, 10, 12, 0, 0)).toISOString(),
    tenant_id: null,
    anonymous_session_id: `session-${id}`,
    experiment,
    amount_cents,
    currency: amount_cents == null ? null : 'EUR',
  };
}

describe('aggregateTransformationFunnel', () => {
  it('aggregates the transformation funnel and revenue', () => {
    const events = [
      event('preview_started', '1'),
      event('preview_completed', '2'),
      event('transformation_cta_clicked', '3'),
      event('checkout_started', '4'),
      event('transformation_paid', '5', 'reference_349', 34_900),
      event('transformation_ready', '6'),
      event('core_activated', '7'),
      event('capability_activated', '8'),
      event('capacity_expanded', '9'),
    ];

    const snapshot = aggregateTransformationFunnel(events, START, END, 'reference_349');

    expect(snapshot.preview_started).toBe(1);
    expect(snapshot.transformation_paid).toBe(1);
    expect(snapshot.transformation_revenue_cents).toBe(34_900);
    expect(snapshot.conversion_rates.preview_to_completed).toBe(1);
    expect(snapshot.conversion_rates.checkout_to_paid).toBe(1);
    expect(snapshot.conversion_rates.paid_to_core).toBe(1);
  });

  it('does not mix experiment cohorts', () => {
    const events = [
      event('preview_started', '349-1', 'reference_349'),
      event('transformation_paid', '349-2', 'reference_349', 34_900),
      event('preview_started', '249-1', 'launch_249'),
      event('transformation_paid', '249-2', 'launch_249', 24_900),
    ];

    const comparison = compareTransformationExperiments(events, START, END);

    expect(comparison.reference_349.preview_started).toBe(1);
    expect(comparison.reference_349.transformation_revenue_cents).toBe(34_900);
    expect(comparison.launch_249.preview_started).toBe(1);
    expect(comparison.launch_249.transformation_revenue_cents).toBe(24_900);
  });

  it('returns zero rates rather than NaN for an empty cohort', () => {
    const snapshot = aggregateTransformationFunnel([], START, END, 'reference_349');
    expect(snapshot.preview_started).toBe(0);
    expect(snapshot.conversion_rates.checkout_to_paid).toBe(0);
    expect(snapshot.transformation_revenue_cents).toBe(0);
  });

  it('ignores events outside the measurement window', () => {
    const outside: TransformationFunnelEvent = {
      ...event('transformation_paid', 'outside', 'reference_349', 34_900),
      occurred_at: new Date(START - 1).toISOString(),
    };
    const snapshot = aggregateTransformationFunnel([outside], START, END, 'reference_349');
    expect(snapshot.transformation_paid).toBe(0);
    expect(snapshot.transformation_revenue_cents).toBe(0);
  });
});

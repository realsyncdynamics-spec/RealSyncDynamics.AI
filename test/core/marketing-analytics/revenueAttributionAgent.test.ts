import { describe, expect, it } from 'vitest';
import { RevenueAttributionAgent } from '../../../src/core/marketing-analytics/revenueAttributionAgent';
import type { MarketingEvent } from '../../../src/core/marketing-analytics/types';

const baseTs = '2026-05-13T10:00:00.000Z';

function ev(overrides: Partial<MarketingEvent>): MarketingEvent {
  return {
    event_name: 'page_view',
    session_hash: 's1',
    occurred_at: baseTs,
    ...overrides,
  };
}

describe('RevenueAttributionAgent', () => {
  const agent = new RevenueAttributionAgent();
  const window = { from: '2026-05-01T00:00:00Z', to: '2026-05-31T23:59:59Z' };

  it('last_touch attributes revenue to the final UTM source', () => {
    const events: MarketingEvent[] = [
      ev({ session_hash: 's1', utm_source: 'google' }),
      ev({ session_hash: 's1', utm_source: 'newsletter' }),
      ev({ session_hash: 's1', event_name: 'checkout_completed', event_value: 100 }),
    ];
    const snap = agent.attribute(events, 'last_touch', window.from, window.to);
    const newsletter = snap.rows.find((r) => r.utm_source === 'newsletter');
    expect(newsletter?.revenue_eur).toBe(100);
    expect(newsletter?.conversions).toBe(1);
    const google = snap.rows.find((r) => r.utm_source === 'google');
    expect(google?.revenue_eur).toBe(0);
  });

  it('first_touch attributes revenue to the initial UTM source', () => {
    const events: MarketingEvent[] = [
      ev({ session_hash: 's1', utm_source: 'google' }),
      ev({ session_hash: 's1', utm_source: 'newsletter' }),
      ev({ session_hash: 's1', event_name: 'checkout_completed', event_value: 100 }),
    ];
    const snap = agent.attribute(events, 'first_touch', window.from, window.to);
    expect(snap.rows.find((r) => r.utm_source === 'google')?.revenue_eur).toBe(100);
  });

  it('linear splits revenue across all touchpoints', () => {
    const events: MarketingEvent[] = [
      ev({ session_hash: 's1', utm_source: 'google' }),
      ev({ session_hash: 's1', utm_source: 'newsletter' }),
      ev({ session_hash: 's1', utm_source: 'twitter' }),
      ev({ session_hash: 's1', event_name: 'checkout_completed', event_value: 90 }),
    ];
    const snap = agent.attribute(events, 'linear', window.from, window.to);
    for (const src of ['google', 'newsletter', 'twitter']) {
      const row = snap.rows.find((r) => r.utm_source === src);
      expect(row?.revenue_eur).toBeCloseTo(30, 2);
    }
  });

  it('ignores sessions without conversions for revenue but still counts touchpoints', () => {
    const events: MarketingEvent[] = [
      ev({ session_hash: 's2', utm_source: 'google' }),
      ev({ session_hash: 's2', utm_source: 'google' }),
    ];
    const snap = agent.attribute(events, 'last_touch', window.from, window.to);
    const google = snap.rows.find((r) => r.utm_source === 'google');
    expect(google?.touchpoints).toBe(2);
    expect(google?.conversions).toBe(0);
    expect(google?.revenue_eur).toBe(0);
  });
});

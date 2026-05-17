import { describe, expect, it } from 'vitest';

import {
  prepareMarketingEvent,
  detectKpiAnomaly,
  runComplianceDrift,
  runRevenueAttribution,
  buildMarketingAnalyticsReport,
  MARKETING_SKILL_GUARDRAIL,
} from '../../src/lib/skills/marketingPerformanceAnalytics';
import type { MarketingEvent } from '../../src/core/marketing-analytics/types';

const ts = '2026-05-14T10:00:00.000Z';

function ev(overrides: Partial<MarketingEvent>): MarketingEvent {
  return { event_name: 'page_view', occurred_at: ts, ...overrides };
}

describe('marketing skill ↔ runtime binding', () => {
  describe('prepareMarketingEvent', () => {
    it('strips PII from metadata via sanitizeMetadata', () => {
      const out = prepareMarketingEvent(ev({
        metadata: { client_ip: '203.0.113.1', email: 'a@b.c', plan: 'pro' },
      }));
      expect(out.metadata?.client_ip).toBeUndefined();
      expect(out.metadata?.email).toBeUndefined();
      expect(out.metadata?.plan).toBe('pro');
    });
    it('defaults currency to EUR and stamps occurred_at when missing', () => {
      const out = prepareMarketingEvent({ event_name: 'page_view' });
      expect(out.currency).toBe('EUR');
      expect(typeof out.occurred_at).toBe('string');
    });
    it('rejects non-object input', () => {
      expect(() => prepareMarketingEvent(null as unknown as MarketingEvent)).toThrow();
    });
  });

  describe('detectKpiAnomaly', () => {
    it('flags a sharp drop after stable history', () => {
      const r = detectKpiAnomaly([100, 102, 98, 101, 99, 103, 5]);
      expect(r.isAnomaly).toBe(true);
      expect(r.zScore).toBeLessThan(-2.5);
    });
    it('returns isAnomaly=false on short history', () => {
      expect(detectKpiAnomaly([1, 2]).isAnomaly).toBe(false);
    });
  });

  describe('runComplianceDrift', () => {
    it('returns findings + disclaimer + skill guardrail', () => {
      const events: MarketingEvent[] = [
        ev({ utm_source: 'google', metadata: { consent_marketing: false } }),
        ev({ metadata: { claim: '100% DSGVO-konform garantiert!' } }),
      ];
      const r = runComplianceDrift(events);
      expect(r.findings.length).toBeGreaterThan(0);
      expect(r.disclaimer).toMatch(/keine Rechtsberatung/i);
      expect(r.skillGuardrails).toContain(MARKETING_SKILL_GUARDRAIL);
    });
    it('rejects non-array input', () => {
      // @ts-expect-error invalid
      expect(() => runComplianceDrift('nope')).toThrow();
    });
  });

  describe('runRevenueAttribution', () => {
    const events: MarketingEvent[] = [
      ev({ session_hash: 's1', utm_source: 'google' }),
      ev({ session_hash: 's1', utm_source: 'newsletter' }),
      ev({ session_hash: 's1', event_name: 'checkout_completed', event_value: 100 }),
    ];

    it('routes last_touch revenue to the final UTM source', () => {
      const snap = runRevenueAttribution(events, 'last_touch', ts, ts);
      const row = snap.rows.find((r) => r.utm_source === 'newsletter');
      expect(row?.revenue_eur).toBe(100);
    });

    it('rejects unknown attribution model', () => {
      // @ts-expect-error invalid
      expect(() => runRevenueAttribution(events, 'bogus', ts, ts)).toThrow();
    });
  });

  describe('buildMarketingAnalyticsReport', () => {
    it('combines attribution + compliance + prioritized optimizations', () => {
      const events: MarketingEvent[] = [
        ev({ session_hash: 's1', utm_source: 'google' }),
        ev({ session_hash: 's1', event_name: 'checkout_completed', event_value: 50 }),
        ev({ utm_source: 'twitter', metadata: { consent_marketing: false } }),
      ];
      const report = buildMarketingAnalyticsReport(events, 'last_touch', ts, ts, [
        { id: 'low', hypothesis: 'l', impactScore: 0.2, effortScore: 0.9, confidence: 0.4 },
        { id: 'high', hypothesis: 'h', impactScore: 0.9, effortScore: 0.2, confidence: 0.8 },
      ]);
      expect(report.attribution.rows.length).toBeGreaterThan(0);
      expect(report.compliance.disclaimer).toMatch(/keine Rechtsberatung/i);
      expect(report.topOptimizations[0]?.id).toBe('high');
      expect(report.skillGuardrails).toContain(MARKETING_SKILL_GUARDRAIL);
    });
  });
});

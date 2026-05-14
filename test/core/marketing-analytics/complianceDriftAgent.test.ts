import { describe, expect, it } from 'vitest';
import { ComplianceDriftAgent } from '../../../src/core/marketing-analytics/complianceDriftAgent';
import type { MarketingEvent } from '../../../src/core/marketing-analytics/types';
import { COMPLIANCE_DISCLAIMER } from '../../../src/core/marketing-analytics/types';

const agent = new ComplianceDriftAgent();

function ev(overrides: Partial<MarketingEvent>): MarketingEvent {
  return {
    event_name: 'page_view',
    occurred_at: '2026-05-13T10:00:00.000Z',
    ...overrides,
  };
}

describe('ComplianceDriftAgent', () => {
  it('always returns the no-legal-advice disclaimer', () => {
    const report = agent.analyze([]);
    expect(report.disclaimer).toBe(COMPLIANCE_DISCLAIMER);
    expect(report.disclaimer).toMatch(/keine Rechtsberatung/);
  });

  it('flags UTM events without marketing consent', () => {
    const events: MarketingEvent[] = [
      ev({ utm_source: 'google', metadata: { consent_marketing: false } }),
      ev({ utm_source: 'newsletter', metadata: { consent_marketing: true } }),
      ev({ utm_source: 'twitter' }),
    ];
    const { findings } = agent.analyze(events);
    const utm = findings.find((f) => f.rule_id === 'utm_no_consent_drift');
    expect(utm).toBeDefined();
    expect(utm?.evidence.violations).toBe(2);
  });

  it('flags claim drift on superlatives', () => {
    const events: MarketingEvent[] = [
      ev({ metadata: { claim: 'Wir sind 100% DSGVO-konform!' } }),
      ev({ metadata: { claim: 'Schnell und gut.' } }),
    ];
    const { findings } = agent.analyze(events);
    const claim = findings.find((f) => f.rule_id === 'claim_drift');
    expect(claim).toBeDefined();
    expect(claim?.severity).toBe('medium');
  });

  it('returns no findings on a clean event stream', () => {
    const events: MarketingEvent[] = [
      ev({ utm_source: 'google', metadata: { consent_marketing: true } }),
      ev({ metadata: { claim: 'Werkzeug zur Selbstpruefung.' } }),
    ];
    const { findings } = agent.analyze(events);
    expect(findings).toHaveLength(0);
  });
});

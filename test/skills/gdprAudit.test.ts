import { describe, expect, it } from 'vitest';
import {
  classifyAuditFinding,
  buildWebsiteAuditPlan,
  SEVERITY_ORDER,
} from '../../src/lib/skills/gdprAudit';

describe('classifyAuditFinding', () => {
  it('classifies a known critical category', () => {
    const r = classifyAuditFinding('tracker_before_consent');
    expect(r.severity).toBe('critical');
    expect(r.remediation.length).toBeGreaterThan(0);
  });

  it('is case/space tolerant', () => {
    expect(classifyAuditFinding('  Analytics_No_Consent ').severity).toBe('high');
  });

  it('returns info for unknown categories', () => {
    const r = classifyAuditFinding('something_unknown');
    expect(r.severity).toBe('info');
  });

  it('every known severity is part of SEVERITY_ORDER', () => {
    for (const cat of ['tracker_before_consent', 'no_consent_banner', 'third_party_fonts', 'weak_security_headers']) {
      expect(SEVERITY_ORDER).toContain(classifyAuditFinding(cat).severity);
    }
  });
});

describe('buildWebsiteAuditPlan', () => {
  it('rejects non-http(s) urls', () => {
    expect(() => buildWebsiteAuditPlan('not-a-url')).toThrow();
    expect(() => buildWebsiteAuditPlan('ftp://example.de')).toThrow();
  });

  it('builds a plan with consent-timing first and a disclaimer', () => {
    const plan = buildWebsiteAuditPlan('https://example.de');
    expect(plan.url).toBe('https://example.de');
    expect(plan.steps[0].id).toBe('consent-timing');
    expect(plan.steps.length).toBeGreaterThanOrEqual(5);
    expect(plan.disclaimer).toMatch(/keine Rechtsberatung/i);
  });

  it('trims the url', () => {
    expect(buildWebsiteAuditPlan('  https://x.de  ').url).toBe('https://x.de');
  });
});

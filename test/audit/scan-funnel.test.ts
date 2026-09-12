import { describe, expect, it } from 'vitest';
import { buildPostScanChoices } from '../../src/components/audit/PostScanChoiceRow';
import {
  nextMeasureFor,
  pickTopRisks,
} from '../../src/components/audit/Top3RisksPreview';
import {
  HERO_SCAN_CTA_LABEL,
  HERO_SCAN_CTA_PROMISE,
  SCAN_FUNNEL_MESSAGE,
} from '../../src/components/governance-frontend/hero-content';
import { PUBLIC_CTA } from '../../src/config/public-nav';
import { getImplementation } from '../../src/product/implementation-status';

describe('scan funnel copy SSOT', () => {
  it('hero CTA promises a result, never „testen“', () => {
    expect(HERO_SCAN_CTA_LABEL).toBe('Kostenlosen Governance-Scan starten');
    expect(HERO_SCAN_CTA_LABEL.toLowerCase()).not.toContain('testen');
    expect(HERO_SCAN_CTA_PROMISE).toMatch(/Top-3-Risiken/);
    expect(HERO_SCAN_CTA_PROMISE).toMatch(/Evidence-Preview/);
    expect(SCAN_FUNNEL_MESSAGE).toBe(
      'In Minuten scannen. In Stunden strukturieren. Dauerhaft kontrollieren.',
    );
    expect(PUBLIC_CTA.label).toBe(HERO_SCAN_CTA_LABEL);
    expect(PUBLIC_CTA.to).toBe('/audit');
  });
});

describe('Top3RisksPreview helpers', () => {
  const issues = [
    { id: 'a', severity: 'low', title: 'Low', detail: 'd' },
    { id: 'b', severity: 'critical', title: 'Crit', detail: 'd' },
    { id: 'c', severity: 'medium', title: 'Med', detail: 'd' },
    { id: 'd', severity: 'high', title: 'High', detail: 'd' },
  ];

  it('orders by severity and caps at 3', () => {
    expect(pickTopRisks(issues).map((i) => i.id)).toEqual(['b', 'd', 'c']);
  });

  it('derives a concrete next measure from the top finding', () => {
    expect(nextMeasureFor(issues)).toMatch(/Crit/);
  });
});

describe('PostScanChoiceRow destinations', () => {
  it('wires four choices with honest badges', () => {
    const choices = buildPostScanChoices({
      auditId: 'aud-1',
      domain: 'example.com',
      score: 62,
      severity: 'high',
      hasFindings: true,
      findings: [{ id: '1', severity: 'high', title: 't', detail: 'd' }],
    });
    expect(choices).toHaveLength(4);
    expect(choices[0].badge).toBe('coming-soon');
    expect(choices[0].to).toContain('/welcome?next=');
    expect(choices[0].to).toContain('%2Fapp%2Fmonitoring');
    expect(choices[1].to).toBe('/onboarding/aud-1');
    expect(choices[1].badge).toBe('live');
    expect(choices[2].to).toContain('%2Fapp%2Factivation');
    expect(choices[2].badge).toBe('live');
    expect(choices[3].badge).toBe('preview');
    expect(choices[3].to).toContain('%2Fapp%2Fevidence');
  });

  it('uses optimizer preview when there are no findings', () => {
    const choices = buildPostScanChoices({
      auditId: 'aud-2',
      domain: 'clean.example',
      score: 95,
      severity: 'info',
      hasFindings: false,
    });
    expect(choices[1].to).toBe('/claude-code-optimizer');
    expect(choices[1].badge).toBe('preview');
  });
});

describe('implementation-status registry for scan funnel', () => {
  it('registers continuous monitoring as coming-soon and choice row as live', () => {
    expect(getImplementation('continuous-domain-monitoring')?.status).toBe('coming-soon');
    expect(getImplementation('post-scan-choice-row')?.status).toBe('live');
    expect(getImplementation('free-audit')?.ctaLabel).toBe(HERO_SCAN_CTA_LABEL);
  });
});

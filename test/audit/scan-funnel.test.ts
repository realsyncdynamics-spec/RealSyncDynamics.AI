import { describe, expect, it } from 'vitest';
import { buildPostScanChoices } from '../../src/components/audit/PostScanChoiceRow';
import {
  nextMeasureFor,
  pickTopRisks,
} from '../../src/components/audit/Top3RisksPreview';
import {
  CONTINUOUS_COMPLIANCE_NARRATIVE,
  HERO_DASHBOARD_CTA_LABEL,
  HERO_OPERATING_LOOP,
  HERO_SCAN_CTA_LABEL,
  HERO_SCAN_CTA_LONG,
  HERO_SCAN_PROMISE_LINE,
  SCAN_FUNNEL_MESSAGE,
} from '../../src/components/governance-frontend/hero-content';
import { PUBLIC_CTA, PUBLIC_NAV_GROUPS, PUBLIC_PRIMARY_NAV } from '../../src/config/public-nav';
import { getImplementation } from '../../src/product/implementation-status';

describe('scan funnel copy SSOT', () => {
  it('hero CTA promises a result, never Demo/testen', () => {
    expect(HERO_SCAN_CTA_LABEL).toBe('Governance-Scan starten');
    expect(HERO_SCAN_CTA_LONG).toBe('Governance-Scan starten');
    expect(HERO_DASHBOARD_CTA_LABEL).toBe('Live Dashboard ansehen');
    expect(HERO_OPERATING_LOOP).toBe('DISCOVER → ASSESS → GOVERN → EXECUTE → VERIFY → PROVE');
    expect(HERO_SCAN_PROMISE_LINE.toLowerCase()).not.toContain('demo');
    expect(HERO_SCAN_CTA_LABEL.toLowerCase()).not.toContain('testen');
    expect(HERO_SCAN_CTA_LONG.toLowerCase()).not.toContain('testen');
    expect(SCAN_FUNNEL_MESSAGE).toBe(
      'Entdecken. Bewerten. Steuern. Ausführen. Verifizieren. Mit Evidence beweisen.',
    );
    expect(CONTINUOUS_COMPLIANCE_NARRATIVE.length).toBeGreaterThan(20);
    expect(PUBLIC_CTA.label).toBe(HERO_SCAN_CTA_LONG);
    expect(PUBLIC_CTA.to).toBe('/audit');
  });
});

describe('public nav ecosystem IA', () => {
  it('exposes Produkt sections (not a flat tool strip)', () => {
    const produkt = PUBLIC_NAV_GROUPS.find((g) => g.id === 'produkt');
    expect(produkt?.sections?.length).toBeGreaterThanOrEqual(5);
    const labels = produkt?.sections?.map((s) => s.label) ?? [];
    expect(labels).toEqual(
      expect.arrayContaining([
        'AI Governance',
        'Privacy Governance',
        'Agent Governance',
        'Evidence',
        'Automation',
        'Platform',
      ]),
    );
    expect(PUBLIC_NAV_GROUPS.map((g) => g.id)).toEqual(
      expect.arrayContaining(['produkt', 'loesungen', 'ressourcen', 'unternehmen', 'preise']),
    );
  });

  it('Europe-OS primary strip is Produkt | Evidence | Preise | Login', () => {
    expect(PUBLIC_PRIMARY_NAV.map((i) => i.label)).toEqual([
      'Produkt',
      'Evidence',
      'Preise',
      'Login',
    ]);
  });

  it('marks Agent Governance as Preview', () => {
    const agent = PUBLIC_NAV_GROUPS.find((g) => g.id === 'produkt')?.sections?.find(
      (s) => s.label === 'Agent Governance',
    );
    expect(agent?.badge).toBe('preview');
    expect(agent?.to).toBe('/agent-governance');
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
    const byId = Object.fromEntries(choices.map((c) => [c.id, c]));
    expect(byId.monitor.badge).toBe('coming-soon');
    expect(byId['fix-plan'].to).toBe('/onboarding/aud-1');
    expect(byId.activation.to).toContain('%2Fapp%2Factivation');
    expect(byId.export.badge).toBe('preview');
  });

  it('leads with the workspace setup as the single primary step, without trial promise', () => {
    const choices = buildPostScanChoices({
      auditId: 'aud-1',
      domain: 'example.com',
      score: 62,
      severity: 'high',
      hasFindings: false,
    });
    expect(choices[0].id).toBe('activation');
    expect(choices[0].title).toBe('Governance-Workspace einrichten');
    expect(choices[0].badge).toBe('live');
    expect(choices.filter((c) => c.primary)).toHaveLength(1);
    for (const c of choices) {
      expect(`${c.title} ${c.description}`).not.toMatch(/Tage kostenlos|testen|Trial/i);
      expect(c.to).not.toContain('/unified-entry/scan');
    }
  });
});

describe('implementation-status registry for scan funnel', () => {
  it('registers continuous monitoring, choice row, agent governance', () => {
    expect(getImplementation('continuous-domain-monitoring')?.status).toBe('coming-soon');
    expect(getImplementation('post-scan-choice-row')?.status).toBe('live');
    expect(getImplementation('agent-governance')?.status).toBe('preview');
    expect(getImplementation('free-audit')?.route).toBe('/audit');
    expect(getImplementation('free-audit')?.status).toBe('live');
  });
});

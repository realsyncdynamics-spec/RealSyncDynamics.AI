import { describe, expect, it } from 'vitest';
import {
  formatGovernanceAiSystemPrompt,
  type GovernanceAiGrounding,
} from '@/src/features/governance/dashboard/governanceAiContext';

const empty: GovernanceAiGrounding = {
  tenantId: 't-1',
  incidents: [],
  evidence: [],
  findings: [],
  scanLabel: null,
  error: null,
};

describe('formatGovernanceAiSystemPrompt', () => {
  it('refuses demo data when no tenant context is loaded', () => {
    const prompt = formatGovernanceAiSystemPrompt(null);
    expect(prompt).toMatch(/keine ausführenden Tools/i);
    expect(prompt).toMatch(/atelier-nord/i);
    expect(prompt).toMatch(/Erfinde keine Domains/);
  });

  it('states an empty tenant honestly', () => {
    const prompt = formatGovernanceAiSystemPrompt(empty);
    expect(prompt).toMatch(/noch keine Vorfälle, Nachweise oder Findings/);
    expect(prompt).not.toMatch(/1\.247/);
  });

  it('embeds live evidence and findings without claiming execution', () => {
    const prompt = formatGovernanceAiSystemPrompt({
      ...empty,
      incidents: [{ kind: 'incident', id: 'aaaaaaaa-1111', title: 'Pixel vor Consent', severity: 'high' }],
      evidence: [{ kind: 'evidence', id: 'bbbbbbbb-2222', title: 'Banner-Screenshot' }],
      findings: [{ kind: 'finding', id: 'cccccccc-3333', title: 'GA4 vor Consent', severity: 'critical' }],
      scanLabel: 'scan-9',
    });
    expect(prompt).toContain('Pixel vor Consent');
    expect(prompt).toContain('Banner-Screenshot');
    expect(prompt).toContain('GA4 vor Consent');
    expect(prompt).toMatch(/keine Tool-Ausführung/);
    expect(prompt).not.toMatch(/atelier-nord/i);
  });
});

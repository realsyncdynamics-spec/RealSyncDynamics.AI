import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function src(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('authenticated governance surfaces stay honest', () => {
  it('Risk Center no longer seeds a mock RISKS list', () => {
    const text = src('src/features/governance/risks/RiskCenterView.tsx');
    expect(text).not.toMatch(/atelier-nord/);
    expect(text).not.toMatch(/const RISKS/);
    expect(text).not.toMatch(/keep mock/);
    expect(text).toContain('fetchTenantIncidents');
    expect(text).toContain('Noch keine Vorfälle');
  });

  it('Evidence Vault no longer ships atelier-nord fallbacks', () => {
    const text = src('src/features/governance/evidence/EvidenceVaultView.tsx');
    expect(text).not.toMatch(/atelier-nord/);
    expect(text).not.toMatch(/EVIDENCE_TIMELINE/);
    expect(text).not.toMatch(/1\.247/);
    expect(text).toContain('fetchTenantEvidence');
    expect(text).toContain('Noch keine Nachweise');
  });

  it('Governance AI prompt is built from tenant grounding', () => {
    const text = src('src/features/governance/dashboard/GovernanceAiWorkspace.tsx');
    expect(text).toContain('loadGovernanceAiGrounding');
    expect(text).toContain('formatGovernanceAiSystemPrompt');
  });
});

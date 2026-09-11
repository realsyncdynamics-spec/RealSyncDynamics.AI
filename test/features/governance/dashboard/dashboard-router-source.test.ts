import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const router = readFileSync('src/features/governance/dashboard/DashboardRouter.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

describe('DashboardRouter — Compliance-Status ist Default', () => {
  it('mountet ComplianceStatusDashboard, nicht den ungebundenen Chat', () => {
    expect(router).toContain('ComplianceStatusDashboard');
    expect(router).not.toContain('GovernanceAiWorkspace');
    expect(router).not.toMatch(/return\s+<GovernanceAiWorkspace/);
  });

  it('hält /app/dashboard hinter AppGate und DashboardRouter', () => {
    const line = app.split('\n').find((text) => text.includes('path="/app/dashboard"'));
    expect(line).toContain('<AppGate>');
    expect(line).toContain('DashboardRouter');
  });

  it('legt den Chat unter /app/assistant, nicht als Dashboard-Default', () => {
    const line = app.split('\n').find((text) => text.includes('path="/app/assistant"'));
    expect(line, '/app/assistant fehlt').toBeDefined();
    expect(line).toContain('<AppGate>');
    expect(line).toContain('GovernanceAiWorkspace');
  });
});

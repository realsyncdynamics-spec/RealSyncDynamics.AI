import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DASHBOARD = readFileSync(
  resolve('src/features/governance/dashboard/ComplianceStatusDashboard.tsx'),
  'utf8',
);
const AGENTS = readFileSync(
  resolve('src/features/governance/agents/AgentsCenterView.tsx'),
  'utf8',
);

describe('dashboard first paint', () => {
  it('does not mount Agent OS or the build control plane on /app/dashboard', () => {
    expect(DASHBOARD).not.toContain('AgentOsPanel');
    expect(DASHBOARD).not.toContain('DashboardControlPlane');
    expect(DASHBOARD).not.toContain('dashboard-control-plane');
    expect(DASHBOARD).toContain('DashboardExecuteStrip');
    expect(DASHBOARD).toContain('mandant-status-line');
  });

  it('keeps Agent OS on the agents route', () => {
    expect(AGENTS).toContain('AgentOsPanel');
  });
});

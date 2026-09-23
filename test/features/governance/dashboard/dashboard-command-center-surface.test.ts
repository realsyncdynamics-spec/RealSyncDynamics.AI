import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const command = readFileSync(
  'src/features/governance/dashboard/CommandCenterDashboard.tsx',
  'utf8',
);
const strip = readFileSync(
  'src/features/governance/dashboard/DashboardExecuteStrip.tsx',
  'utf8',
);
const router = readFileSync(
  'src/features/governance/dashboard/DashboardRouter.tsx',
  'utf8',
);

describe('Command Center surface', () => {
  it('keeps theater off /app/dashboard', () => {
    expect(router).toContain('CommandCenterDashboard');
    expect(command).not.toMatch(/from ['\"][^'\"]*AgentOsPanel['\"]/);
    expect(command).not.toContain('<AgentOsPanel');
    expect(command).not.toContain('dashboard-control-plane');
    expect(command).toContain('DashboardExecuteStrip');
    expect(command).toContain('ComplianceStatusView');
    expect(strip).toContain('/app/agents');
    expect(strip).toContain('dashboard-execute-strip');
  });
});

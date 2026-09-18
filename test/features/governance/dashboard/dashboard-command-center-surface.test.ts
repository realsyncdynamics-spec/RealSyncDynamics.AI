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
const agents = readFileSync(
  'src/features/governance/agents/AgentsCenterView.tsx',
  'utf8',
);

describe('Command Center surface', () => {
  it('keeps theater off /app/dashboard', () => {
    expect(command).not.toContain('AgentOsPanel');
    expect(command).not.toContain('dashboard-control-plane');
    expect(command).toContain('DashboardExecuteStrip');
    expect(command).toContain('ComplianceStatusView');
    expect(strip).toContain('/app/agents');
  });

  it('mounts Agent OS on /app/agents', () => {
    expect(agents).toContain('AgentOsPanel');
  });
});

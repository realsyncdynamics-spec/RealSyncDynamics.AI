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
const browserRuntime = readFileSync(
  'src/features/governance/dashboard/BrowserRuntimePanel.tsx',
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
    expect(command).toContain('BrowserRuntimePanel');
    expect(strip).toContain('/app/agents');
    expect(strip).toContain('dashboard-execute-strip');
  });

  it('shows honest browser runtime capability boundaries', () => {
    expect(browserRuntime).toContain('RealSync Browser Runtime');
    expect(browserRuntime).toContain('HEADLESS EXECUTOR READY');
    expect(browserRuntime).toContain('EXECUTOR OFFLINE');
    expect(browserRuntime).toContain('Governed Action Composer');
    expect(browserRuntime).toContain('getBrowserExecutorHealth');
    expect(browserRuntime).toContain('executeBrowserActions');
    expect(browserRuntime).toContain('realsync:browser-open');
    expect(browserRuntime).toContain('/app/approvals');
    expect(browserRuntime).toContain('/app/evidence');
    expect(browserRuntime).not.toContain('RUNTIME LIVE');
    expect(browserRuntime).toContain("['autonomous', 'Autonomous', false");
    expect(browserRuntime).toContain('Die eingebettete Browser-Preview ist noch kein Live-Video');
  });
});

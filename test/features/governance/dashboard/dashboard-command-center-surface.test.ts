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
    // Status, Modi und Aktionen kommen aus dem serverseitigen Capability-Check.
    expect(browserRuntime).toContain('useBrowserRuntime');
    expect(browserRuntime).toContain('caps?.can_autonomous');
    expect(browserRuntime).toContain('caps.reasons.autonomous');
    expect(browserRuntime).not.toMatch(/\['autonomous', 'Autonomous', (true|false)/);
    // Die Vorschau ist dieselbe Session — keine iframe-Vorschau mehr aus diesem Panel.
    expect(browserRuntime).toContain('BrowserPreview');
    expect(browserRuntime).not.toContain('realsync:browser-open');
    expect(browserRuntime).toContain('Einzelbilder derselben Chromium-Session');
    expect(browserRuntime).toContain('/app/approvals');
    expect(browserRuntime).toContain('/app/evidence');
    expect(browserRuntime).not.toContain('RUNTIME LIVE');
  });

  it('keine statischen Governance-Zustände mehr', () => {
    // Früher standen „server-side", „required" und „evidence-backed" fest im Markup.
    expect(browserRuntime).not.toContain('<dd className="text-cyan-300">server-side</dd>');
    expect(browserRuntime).not.toContain('<dd className="text-emerald-300">required</dd>');
    expect(browserRuntime).not.toContain('<dd className="text-emerald-300">evidence-backed</dd>');
    expect(browserRuntime).toContain('caps.policy.policy_id');
    expect(browserRuntime).toContain('caps.evidence.available');
  });

  it('wires compliance KPIs and live plan into the status view', () => {
    expect(command).toContain('loadComplianceKpiRow');
    expect(command).toContain('complianceKpi={complianceKpi}');
    expect(command).toContain('livePlanId={tier}');
    expect(command).toContain('entitlementsLoading={entitlementsLoading}');
  });

  it('does not hardcode runtime badges as active', () => {
    expect(browserRuntime).toContain('NAVIGATION INACTIVE');
    expect(browserRuntime).toContain('EVIDENCE INACTIVE');
    expect(browserRuntime).not.toContain("{ label: 'Scan', available: true");
    expect(browserRuntime).not.toContain("available: Boolean(activeTenantId)");
  });

  it('wires free-text planning through browser-execute op plan', () => {
    expect(browserRuntime).toContain('planBrowserTask');
    expect(browserRuntime).toContain('browser-task-plan');
    expect(browserRuntime).toContain('Plan ausführen');
    expect(browserRuntime).not.toContain('Freitext-Agentenplanung ist noch nicht aktiviert');
  });
});

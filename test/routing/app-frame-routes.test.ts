/**
 * Alle /app-Routen rendern im App-Rahmen (GovernanceBrowserShell), Guards
 * bleiben unverändert. Ausnahme: /app/cockpit/brief (Druckansicht).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/App.tsx', 'utf8');
const element = (path: string) => {
  const esc = path.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const m = app.match(new RegExp(`<Route path="${esc}" element=\\{(.*?)\\} />`));
  if (!m) throw new Error(`Route ${path} fehlt`);
  return m[1];
};

const FRAMED: Record<string, string> = {
  '/app/settings/integrations/telegram': '<AppGate><GovernanceBrowserShell><TelegramIntegrationPage /></GovernanceBrowserShell></AppGate>',
  '/app/mein-geschaeft': '<AppGate><GovernanceBrowserShell><SmbDashboardView /></GovernanceBrowserShell></AppGate>',
  '/app/intelligence': '<AppGate><GovernanceBrowserShell><ProtectedRoute><DashboardView /></ProtectedRoute></GovernanceBrowserShell></AppGate>',
  '/app/risk': '<AppGate><GovernanceBrowserShell><ProtectedRoute><RiskDashboard /></ProtectedRoute></GovernanceBrowserShell></AppGate>',
  '/app/assistant': '<AppGate><GovernanceBrowserShell><GovernanceAiRoute /></GovernanceBrowserShell></AppGate>',
  '/app/governance/recommendation': '<AppGate><GovernanceBrowserShell><GovernanceWorkflowRecommendation /></GovernanceBrowserShell></AppGate>',
  '/app/governance/frameworks': '<AppGate><GovernanceBrowserShell><ComplianceFrameworkSelector /></GovernanceBrowserShell></AppGate>',
  '/app/siteos/claim': '<AppGate><GovernanceBrowserShell><SiteOsClaimView /></GovernanceBrowserShell></AppGate>',
  '/app/legal-rag': '<AppGate><GovernanceBrowserShell><LegalRagView /></GovernanceBrowserShell></AppGate>',
  '/app/admin': '<AppGate><GovernanceBrowserShell><AdminDashboard /></GovernanceBrowserShell></AppGate>',
  '/app/admin/members': '<AppGate><GovernanceBrowserShell><AdminMembersPage /></GovernanceBrowserShell></AppGate>',
  '/app/admin/settings': '<AppGate><GovernanceBrowserShell><AdminSettingsPage /></GovernanceBrowserShell></AppGate>',
  '/app/admin/billing': '<AppGate><GovernanceBrowserShell><AdminBillingPage /></GovernanceBrowserShell></AppGate>',
  '/app/admin/api-keys': '<AppGate><GovernanceBrowserShell><AdminAPIKeysPage /></GovernanceBrowserShell></AppGate>',
  '/app/admin/audit': '<AppGate><GovernanceBrowserShell><AdminAuditPage /></GovernanceBrowserShell></AppGate>',
};

describe('App-Rahmen für /app-Routen', () => {
  it.each(Object.entries(FRAMED))('%s: AppGate außen, Shell innen, Guards unverändert', (path, expected) => {
    expect(element(path)).toBe(expected);
  });

  it('Druckansicht /app/cockpit/brief bleibt ohne Rahmen', () => {
    expect(element('/app/cockpit/brief')).toBe('<AppGate><CeoBriefPrintView /></AppGate>');
  });

  it('AdminLayout bringt keine eigene Seitenleiste mehr mit', () => {
    const layout = readFileSync('src/features/admin/layouts/AdminLayout.tsx', 'utf8');
    expect(layout).not.toContain('<aside');
    expect(layout).not.toContain('min-h-screen');
  });
});

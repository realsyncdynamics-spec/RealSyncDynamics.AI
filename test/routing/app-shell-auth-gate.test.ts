/**
 * /app shell routes must not render anonymously via GovernanceBrowserShell.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SHELL = readFileSync(
  resolve('src/components/governance-os/GovernanceBrowserShell.tsx'),
  'utf8',
);
const DASHBOARD = readFileSync(
  resolve('src/features/governance/dashboard/ComplianceStatusDashboard.tsx'),
  'utf8',
);
const APP = readFileSync(resolve('src/App.tsx'), 'utf8');

describe('GovernanceBrowserShell auth gate', () => {
  it('wraps the shell chrome in AppGate', () => {
    expect(SHELL).toContain("import { AppGate } from '../../features/auth/AppGate'");
    expect(SHELL).toMatch(/return \(\s*<AppGate>/);
    expect(SHELL).toContain('</AppGate>');
  });

  it('keeps canonical dashboard behind AppGate', () => {
    const line = APP.split('\n').find((l) => l.includes('path="/app/dashboard"')) ?? '';
    expect(line).toContain('<AppGate>');
  });

  it('gates non-shell /app leftovers (builder, claim, legal-rag, telegram)', () => {
    for (const path of [
      '/app/siteos/builder',
      '/app/siteos/claim',
      '/app/legal-rag',
      '/app/settings/integrations/telegram',
      '/app/governance/recommendation',
    ]) {
      const line = APP.split('\n').find((l) => l.includes(`path="${path}"`)) ?? '';
      expect(line, path).toContain('<AppGate>');
    }
  });
});

describe('ComplianceStatusDashboard empty tenant copy', () => {
  it('does not tell an authenticated empty-tenant user to log in', () => {
    expect(DASHBOARD).not.toContain('Bitte anmelden, um den Compliance-Status zu sehen');
    expect(DASHBOARD).toContain('Workspace fehlt oder wird noch geladen');
  });

  it('does not claim Abo aktiv while post-checkout sync is pending', () => {
    expect(DASHBOARD).toContain('post-checkout-sync-pending');
    expect(DASHBOARD).toContain('Zahlung eingegangen · Abo-Sync ausstehend');
  });
});

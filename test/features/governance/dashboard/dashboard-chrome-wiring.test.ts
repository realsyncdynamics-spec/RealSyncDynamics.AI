/**
 * Dead-link + empty-CTA guards for the Governance Command Center chrome.
 * Ensures BrowserTopBar / modules / catalog / frameworks resolve to real
 * App.tsx routes (or honest non-links) — no 404 chrome.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GOVERNANCE_MODULES } from '../../../../src/components/governance-os/governanceModules';
import {
  buildCommandCatalog,
  isCommandRunnable,
  resolveCommandPath,
} from '../../../../src/components/governance-os/commandCenterCatalog';
import { computeWorkspaceBootstrapSteps } from '../../../../src/features/governance/dashboard/workspaceBootstrapSteps';

const APP = readFileSync('src/App.tsx', 'utf8');
const TOP_BAR = readFileSync('src/components/governance-os/BrowserTopBar.tsx', 'utf8');
const DASHBOARD = readFileSync(
  'src/features/governance/dashboard/ComplianceStatusDashboard.tsx',
  'utf8',
);
const MOBILE_NAV = readFileSync(
  'src/components/governance-os/MobileBottomNavigation.tsx',
  'utf8',
);

function appRegisters(path: string): boolean {
  // Exact path= registration or Navigate alias target.
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    new RegExp(`path="${escaped}"`).test(APP) ||
    new RegExp(`Navigate to="${escaped}"`).test(APP) ||
    // Public marketing routes also count (e.g. /audit, /pricing, /build, /kodee).
    new RegExp(`path="${escaped}"`).test(APP)
  );
}

describe('dashboard chrome wiring — no dead TopBar actions', () => {
  it('Audit starten opens the public scan path', () => {
    expect(TOP_BAR).toMatch(/navigate\(['"]\/audit['"]\)/);
  });

  it('Evidence opens /app/evidence', () => {
    expect(TOP_BAR).toMatch(/navigate\(['"]\/app\/evidence['"]\)/);
  });

  it('Bericht opens /app/reports', () => {
    expect(TOP_BAR).toMatch(/navigate\(['"]\/app\/reports['"]\)/);
  });

  it('Assistent stays in-shell (sidebar toggle), logo lands on dashboard', () => {
    expect(TOP_BAR).toContain('onOpenAssistant');
    expect(TOP_BAR).toMatch(/to=["']\/app\/dashboard["']/);
  });

  it('registers TopBar destinations in App.tsx', () => {
    for (const path of ['/audit', '/app/evidence', '/app/reports', '/app/dashboard']) {
      expect(appRegisters(path), `missing route ${path}`).toBe(true);
    }
  });
});

describe('governance module tabs — live/beta routes exist', () => {
  it('Übersicht points at the canonical Command Center', () => {
    const overview = GOVERNANCE_MODULES.find((m) => m.id === 'overview');
    expect(overview?.route).toBe('/app/dashboard');
    expect(overview?.status).toBe('live');
  });

  it('every live/beta module route is registered in App.tsx', () => {
    const navigable = GOVERNANCE_MODULES.filter(
      (m) => m.status === 'live' || m.status === 'beta',
    );
    for (const mod of navigable) {
      // /kodee and /pricing-style absolute paths outside /app still need registration.
      expect(appRegisters(mod.route), `${mod.id} → ${mod.route} not in App.tsx`).toBe(true);
    }
  });

  it('mobile Übersicht uses /app/dashboard', () => {
    expect(MOBILE_NAV).toMatch(/route:\s*['"]\/app\/dashboard['"]/);
  });
});

describe('command center catalog destinations', () => {
  const catalog = buildCommandCatalog();

  it('Audit / Domain / Evidence / Bericht / Assistent resolve to real targets', () => {
    expect(resolveCommandPath(catalog.find((c) => c.id === 'nav-audit-start')!)).toBe('/audit');
    expect(resolveCommandPath(catalog.find((c) => c.id === 'nav-domain-register')!)).toBe(
      '/app/websites',
    );
    expect(resolveCommandPath(catalog.find((c) => c.id === 'mod-evidence')!)).toBe('/app/evidence');
    expect(resolveCommandPath(catalog.find((c) => c.id === 'mod-reports')!)).toBe('/app/reports');
    expect(resolveCommandPath(catalog.find((c) => c.id === 'nav-assistant-workspace')!)).toBe(
      '/app/assistant',
    );
    expect(catalog.find((c) => c.id === 'action-assistant')!.actionId).toBe('open-assistant');
  });

  it('runnable catalog paths are registered (no dead Cmd+K)', () => {
    for (const item of catalog) {
      if (!isCommandRunnable(item) || !item.path) continue;
      expect(appRegisters(item.path), `catalog ${item.id} → ${item.path}`).toBe(true);
    }
  });
});

describe('framework strip honesty', () => {
  it('wires DSGVO / AI Act / ISO / NIS2 to existing governance views', () => {
    expect(DASHBOARD).toContain("path: '/app/governance/dsgvo-directory'");
    expect(DASHBOARD).toContain("path: '/app/governance/ai-act-assessment'");
    expect(DASHBOARD).toContain("path: '/app/governance/iso27001'");
    expect(DASHBOARD).toContain("path: '/app/governance/nis2-incidents'");
    for (const path of [
      '/app/governance/dsgvo-directory',
      '/app/governance/ai-act-assessment',
      '/app/governance/iso27001',
      '/app/governance/nis2-incidents',
    ]) {
      expect(appRegisters(path), path).toBe(true);
    }
  });

  it('keeps TISAX and DORA as non-linked Roadmap', () => {
    expect(DASHBOARD).toMatch(/id:\s*'tisax'[\s\S]*?path:\s*null/);
    expect(DASHBOARD).toMatch(/id:\s*'dora'[\s\S]*?path:\s*null/);
    expect(DASHBOARD).not.toMatch(/id:\s*'tisax'[\s\S]*?path:\s*'\/app\/policy-packs'/);
  });
});

describe('empty-state CTAs and bootstrap next steps', () => {
  it('empty tenant primary CTA is Domain hinterlegen → /app/websites', () => {
    expect(DASHBOARD).toContain('cta-domain-hinterlegen');
    expect(DASHBOARD).toContain("navigate('/app/websites')");
    expect(DASHBOARD).toContain('Domain hinterlegen');
    expect(DASHBOARD).toContain("navigate('/audit?source=dashboard')");
    expect(DASHBOARD).toContain("navigate('/app/activation')");
  });

  it('computes Domain / Audit / Activation from workspace facts', () => {
    const empty = computeWorkspaceBootstrapSteps({
      websiteCount: 0,
      scanCount: 0,
      activationStatus: 'none',
    });
    expect(empty.map((s) => s.id)).toEqual(['add-domain', 'start-audit', 'activation']);
    expect(empty[0].href).toBe('/app/websites');
    expect(empty[1].href).toBe('/audit?source=dashboard');
    expect(empty[2].href).toBe('/app/activation');

    const hasDomainNoScan = computeWorkspaceBootstrapSteps({
      websiteCount: 1,
      scanCount: 0,
      activationStatus: 'org_saved',
    });
    expect(hasDomainNoScan.map((s) => s.id)).toEqual(['start-audit']);
    expect(hasDomainNoScan[0].href).toBe('/app/websites');

    const ready = computeWorkspaceBootstrapSteps({
      websiteCount: 2,
      scanCount: 3,
      activationStatus: 'activated',
    });
    expect(ready).toEqual([]);
  });

  it('does not invent steps while counts are unknown', () => {
    expect(
      computeWorkspaceBootstrapSteps({
        websiteCount: null,
        scanCount: null,
        activationStatus: null,
      }),
    ).toEqual([]);
  });
});

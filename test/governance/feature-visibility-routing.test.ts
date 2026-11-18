/**
 * PR A — sichtbare Shell-Einstiege und zwei konkrete Navigationsziele.
 * Keine zweite Routen-Registry: die Shell liest GOVERNANCE_MODULES,
 * die Pfade müssen schon in App.tsx stehen.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_NAV_GROUPS } from '../../src/config/public-nav';
import {
  GOVERNANCE_MODULES,
  TAB_MODULES,
} from '../../src/components/governance-os/governanceModules';
import { groupShellNav, SHELL_NAV_GROUPS } from '../../src/components/governance-os/shellNavGroups';
import { SHELL_NAV } from '../../src/components/governance-os/shellNav';

const root = resolve(__dirname, '../..');
const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
const apiDocs = readFileSync(resolve(root, 'src/features/api/ApiDocumentation.tsx'), 'utf8');

const SURFACED = [
  'scans',
  'risk-inventory',
  'incidents',
  'dsr',
  'analytics',
  'approvals',
  'gates',
  'mappings',
  'webhooks',
  'connectors',
  'keys',
  'costs',
  'evidence-integrity',
] as const;

describe('Shell zeigt geprüfte, bisher versteckte Flächen', () => {
  it('nimmt jede Fläche in die Tab-Leiste und eine Sidebar-Gruppe auf', () => {
    const grouped = new Set(SHELL_NAV_GROUPS.flatMap((g) => g.modules));
    for (const id of SURFACED) {
      const mod = GOVERNANCE_MODULES.find((m) => m.id === id);
      expect(mod, id).toBeDefined();
      expect(mod?.status, id).not.toBe('roadmap');
      expect(TAB_MODULES.some((m) => m.id === id), id).toBe(true);
      expect(grouped.has(id), id).toBe(true);
      expect(app, id).toContain(`path="${mod?.route}"`);
    }
  });

  it('lässt Mock- und Demo-Flächen aus der Navigation', () => {
    const routes = new Set(TAB_MODULES.map((m) => m.route));
    expect(routes.has('/app/governance/audit-trail')).toBe(false);
    expect(routes.has('/app/vvt')).toBe(false);
    expect(routes.has('/app/assistant')).toBe(false);
  });

  it('führt die DSFA nicht mehr nur als Roadmap-Dock', () => {
    const dpia = GOVERNANCE_MODULES.find((m) => m.id === 'dpia');
    expect(dpia?.status).toBe('beta');
    expect(dpia?.route).toBe('/app/dpia');
    expect(TAB_MODULES.some((m) => m.id === 'dpia')).toBe(true);
  });

  it('verliert beim Gruppieren kein Modul', () => {
    const more = TAB_MODULES.filter((m) => m.route !== '/app/dashboard' && m.route !== '/app/home');
    const ids = groupShellNav(SHELL_NAV, more).flatMap((g) => g.modules.map((m) => m.id));
    for (const id of SURFACED) expect(ids).toContain(id);
  });
});

describe('Konkrete Navigationsziele', () => {
  it('verlinkt den öffentlichen Prüfpfad auf das Audit Center, nicht auf die Mock-Ansicht', () => {
    const evidence = PUBLIC_NAV_GROUPS
      .find((g) => g.id === 'produkt')
      ?.sections?.find((s) => s.label === 'Evidence');
    const trail = evidence?.children.find((c) => c.label === 'Prüfpfad');
    expect(trail?.to).toBe('/welcome?next=/app/audit');
    expect(app).toContain('path="/app/audit"');
    expect(app).toContain('path="/app/governance/audit-trail"');
  });

  it('zeigt in der API-Dokumentation auf die registrierte Referenz /api', () => {
    expect(apiDocs).toContain('href="/api"');
    expect(apiDocs).not.toContain('href="/api/docs"');
    expect(app).toContain('path="/api"');
  });
});

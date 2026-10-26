/**
 * Seitenleiste in sieben Unterkategorien — kein Modul darf beim Gruppieren
 * verloren gehen oder doppelt erscheinen.
 */
import { describe, expect, it } from 'vitest';
import { GOVERNANCE_MODULES } from '../../../src/components/governance-os/governanceModules';
import { SHELL_NAV, SHELL_NAV_GROUPS } from '../../../src/components/governance-os/shellNav';

const moduleEntries = SHELL_NAV_GROUPS.flatMap((g) => g.entries.filter((e) => e.kind === 'module').map((e) => e.id));
const shellEntries = SHELL_NAV_GROUPS.flatMap((g) => g.entries.filter((e) => e.kind === 'shell').map((e) => e.id));

describe('SHELL_NAV_GROUPS', () => {
  it('hat sieben Gruppen in der Reihenfolge des Produktgerüsts', () => {
    expect(SHELL_NAV_GROUPS.map((g) => g.id)).toEqual(['start', 'capture', 'assess', 'enforce', 'prove', 'agents', 'admin']);
  });

  it('führt jeden Hauptbereich genau einmal', () => {
    expect([...shellEntries].sort()).toEqual(SHELL_NAV.map((i) => i.id).sort());
  });

  it('verweist nur auf existierende Module, jedes höchstens einmal', () => {
    const ids = new Set(GOVERNANCE_MODULES.map((m) => m.id));
    for (const id of moduleEntries) expect(ids.has(id), `${id} fehlt in GOVERNANCE_MODULES`).toBe(true);
    expect(new Set(moduleEntries).size).toBe(moduleEntries.length);
  });

  it('lässt kein Modul aus — fehlende sind durch einen Hauptbereich abgedeckt', () => {
    const shellRoutes = new Set(SHELL_NAV.map((i) => i.route));
    for (const module of GOVERNANCE_MODULES) {
      const covered = moduleEntries.includes(module.id) || shellRoutes.has(module.route);
      expect(covered, `${module.id} (${module.route}) fehlt in der Seitenleiste`).toBe(true);
    }
  });

  it('zählt 38 Einträge (Design System „RealSync Dashboard“)', () => {
    expect(moduleEntries.length + shellEntries.length).toBe(38);
  });
});

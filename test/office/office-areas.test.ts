import { describe, it, expect } from 'vitest';
import {
  OFFICE_AREAS,
  OFFICE_BASE_ROUTE,
  findOfficeArea,
  type OfficeAreaId,
} from '../../src/features/office/officeAreas';
import { GOVERNANCE_MODULES } from '../../src/components/governance-os/governanceModules';

const EXPECTED_AREAS: OfficeAreaId[] = [
  'documents', 'sheets', 'presentations', 'templates', 'meetings', 'contracts', 'policies',
];

describe('OFFICE_AREAS config', () => {
  it('enthält genau die 7 Office-Bereiche', () => {
    expect(OFFICE_AREAS).toHaveLength(7);
    expect(OFFICE_AREAS.map((a) => a.id).sort()).toEqual([...EXPECTED_AREAS].sort());
  });

  it('jeder Bereich hat id, label, icon, status und eine /app/office-Route', () => {
    for (const area of OFFICE_AREAS) {
      expect(area.id, 'id fehlt').toBeTruthy();
      expect(area.label, `label fehlt für ${area.id}`).toBeTruthy();
      expect(area.icon, `icon fehlt für ${area.id}`).toBeTruthy();
      expect(area.description, `description fehlt für ${area.id}`).toBeTruthy();
      expect(['live', 'beta', 'roadmap'], `status ungültig für ${area.id}`).toContain(area.status);
      expect(area.route).toBe(`${OFFICE_BASE_ROUTE}/${area.id}`);
    }
  });

  it('Routen sind eindeutig', () => {
    const routes = OFFICE_AREAS.map((a) => a.route);
    expect(new Set(routes).size).toBe(routes.length);
  });
});

describe('findOfficeArea', () => {
  it('findet bekannte Bereiche', () => {
    expect(findOfficeArea('documents')?.label).toBe('Dokumente');
    expect(findOfficeArea('policies')?.label).toBe('Policies');
  });

  it('gibt undefined für unbekannte Sections zurück', () => {
    expect(findOfficeArea('unbekannt')).toBeUndefined();
    expect(findOfficeArea(undefined)).toBeUndefined();
  });
});

describe('Office-Modul-Registrierung', () => {
  it('das office-Modul ist in der Governance-Navigation registriert', () => {
    const office = GOVERNANCE_MODULES.find((m) => m.id === 'office');
    expect(office).toBeDefined();
    expect(office!.route).toBe(OFFICE_BASE_ROUTE);
  });

  it('das office-Modul ist für alle Pläne zugänglich', () => {
    const office = GOVERNANCE_MODULES.find((m) => m.id === 'office')!;
    for (const plan of ['free', 'starter', 'growth', 'agency', 'scale', 'enterprise']) {
      expect(office.plans).toContain(plan);
    }
  });
});

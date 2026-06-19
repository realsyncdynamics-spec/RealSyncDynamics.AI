import { describe, it, expect } from 'vitest';
import { countByStatus } from '../../src/features/office/officeApi';
import type { OfficeArtifact, OfficeArtifactStatus } from '../../src/features/office/officeTypes';
import { OFFICE_AREAS } from '../../src/features/office/officeAreas';

function artifact(status: OfficeArtifactStatus, kind: OfficeArtifact['kind'] = 'documents'): OfficeArtifact {
  return {
    id: crypto.randomUUID(),
    tenant_id: 't1',
    kind,
    title: 'Test',
    status,
    classification: 'intern',
    version: 'v1.0',
    owner: null,
    data: {},
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('countByStatus', () => {
  it('zählt jeden Status korrekt und liefert immer alle fünf Schlüssel', () => {
    const result = countByStatus([
      artifact('freigegeben'),
      artifact('freigegeben'),
      artifact('pruefung'),
      artifact('entwurf'),
    ]);
    expect(result).toEqual({
      entwurf: 1, pruefung: 1, freigegeben: 2, abgelaufen: 0, archiviert: 0,
    });
  });

  it('liefert für leere Eingabe alle Stati mit 0', () => {
    const result = countByStatus([]);
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
    expect(Object.keys(result)).toHaveLength(5);
  });
});

describe('Typ-/Schema-Konsistenz', () => {
  it('jeder OfficeArea-Id ist ein gültiger Artefakt-kind', () => {
    // kind === OfficeAreaId: jede Area muss als kind verwendbar sein.
    for (const area of OFFICE_AREAS) {
      const a = artifact('entwurf', area.id);
      expect(a.kind).toBe(area.id);
    }
  });
});

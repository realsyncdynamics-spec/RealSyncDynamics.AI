import { describe, it, expect } from 'vitest';
import annexIII from '../src/rules/annex-iii.json';
import {
  ANNEX_III_CATEGORIES,
  ANNEX_III_CATEGORY_LABEL,
  PROVIDER_ROLE_LABEL,
  PROVIDER_ROLES,
} from '../src/lib/ai-act/annexCategories';

/**
 * Parität zwischen der UI-Kategorieliste und der Regel-Registry
 * (src/rules/annex-iii.json). Verhindert Drift, wenn die Registry neue
 * Annex-III-Kategorien bekommt oder eine umbenannt wird.
 */

describe('Annex-III-Kategorien', () => {
  const registryIds = (annexIII.categories as Array<{ id: string }>).map((c) => c.id).sort();
  const uiIds = ANNEX_III_CATEGORIES.map((c) => c.id).sort();

  it('UI-Liste deckt exakt die Registry-Kategorien ab (keine Drift)', () => {
    expect(uiIds).toEqual(registryIds);
  });

  it('jede Kategorie hat ein Label und eine Annex-Punktnummer', () => {
    for (const c of ANNEX_III_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.annexPoint).toMatch(/^III\.\d$/);
    }
  });

  it('ANNEX_III_CATEGORY_LABEL ist konsistent mit der Liste', () => {
    for (const c of ANNEX_III_CATEGORIES) {
      expect(ANNEX_III_CATEGORY_LABEL[c.id]).toBe(c.label);
    }
  });

  it('Kategorie-IDs sind eindeutig', () => {
    const ids = ANNEX_III_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('AI-Act-Rollen', () => {
  it('definiert die 5 Operator-Rollen', () => {
    const expected: string[] = [
      'provider', 'importer', 'distributor', 'deployer', 'authorized_representative',
    ];
    expect([...PROVIDER_ROLES].sort()).toEqual([...expected].sort());
  });

  it('jede Rolle hat ein deutsches Label', () => {
    for (const r of PROVIDER_ROLES) {
      expect(PROVIDER_ROLE_LABEL[r].length).toBeGreaterThan(0);
    }
  });
});

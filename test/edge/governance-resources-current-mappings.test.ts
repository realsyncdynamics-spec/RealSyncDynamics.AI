/**
 * governance-resources — auto_map löst vorhandene Mappings über den
 * geladenen Katalog auf (Nachschlagen per id statt linearer Suche).
 * Gleiches Ergebnis wie vorher: bekannte control_id → framework/control_code,
 * unbekannte control_id fällt heraus, source bleibt unverändert.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveCurrentMappings,
  type CatalogControl,
} from '../../supabase/functions/governance-resources/currentMappings';

const catalog: CatalogControl[] = [
  { id: 'c-1', framework: 'eu_ai_act', control_code: 'ART-9' },
  { id: 'c-2', framework: 'gdpr', control_code: 'ART-30' },
  { id: 'c-3', framework: 'iso_42001', control_code: 'A.6.2' },
];

describe('resolveCurrentMappings', () => {
  it('bekannte control_id liefert dasselbe Framework und denselben Code', () => {
    const r = resolveCurrentMappings(
      [{ control_id: 'c-2', status: 'implemented', source: 'auto' }],
      catalog,
    );
    expect(r).toEqual([
      { framework: 'gdpr', control_code: 'ART-30', status: 'implemented', source: 'auto' },
    ]);
  });

  it('unbekannte control_id fällt weiter heraus', () => {
    const r = resolveCurrentMappings(
      [
        { control_id: 'c-unknown', status: 'implemented', source: 'auto' },
        { control_id: 'c-1', status: 'in_progress', source: 'auto' },
      ],
      catalog,
    );
    expect(r).toEqual([
      { framework: 'eu_ai_act', control_code: 'ART-9', status: 'in_progress', source: 'auto' },
    ]);
  });

  it("source: 'manual' bleibt unverändert", () => {
    const r = resolveCurrentMappings(
      [{ control_id: 'c-3', status: 'not_applicable', source: 'manual' }],
      catalog,
    );
    expect(r).toEqual([
      { framework: 'iso_42001', control_code: 'A.6.2', status: 'not_applicable', source: 'manual' },
    ]);
  });
});

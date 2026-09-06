import { describe, expect, it } from 'vitest';
import { SECTOR_IDS, SECTORS, isSectorId, sectorLabel } from '../../src/config/sectors';

/**
 * Katalog-Eigenschaften der Branchenliste.
 *
 * Die Parität zwischen Config, Edge Function und CHECK-Constraint prüft
 * `test/edge/onboarding-setup-functions.test.ts` — hier geht es um das, was
 * dort nicht steht: dass der Katalog vollständig ist, dass Bestandswerte
 * erhalten bleiben und dass die Anzeige keinen unbekannten Wert verschluckt.
 */
describe('Branchen-Katalog', () => {
  it('führt die Unternehmenstypen der Onboarding-Erklärung', () => {
    for (const id of [
      'small_business',
      'retail',
      'furniture_retail',
      'manufacturing',
      'services',
      'agency',
      'industrial',
      'generic',
    ]) {
      expect(SECTOR_IDS).toContain(id);
    }
  });

  /**
   * Die fünf Werte des ersten Wurfs stehen in `company_profiles.sector` von
   * Bestandsmandanten. Verschwindet einer, verletzt deren Zeile den
   * CHECK-Constraint und ihr Prüfpfad wird unlesbar. Deshalb festgenagelt und
   * nicht bloss als Kommentar notiert.
   */
  it('behält die Bestandswerte, die Mandanten bereits gespeichert haben', () => {
    for (const legacy of ['saas', 'agency', 'healthcare', 'public_sector', 'generic']) {
      expect(SECTOR_IDS).toContain(legacy);
    }
  });

  it('vergibt jede ID nur einmal und lässt kein Feld leer', () => {
    expect(new Set(SECTOR_IDS).size).toBe(SECTOR_IDS.length);
    for (const s of SECTORS) {
      expect(s.label.trim().length).toBeGreaterThan(0);
      expect(s.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('führt "Anderes Unternehmen" zuletzt', () => {
    // Ein Auffangwert mitten in der Liste liest sich wie eine eigene Branche.
    expect(SECTORS[SECTORS.length - 1].id).toBe('generic');
  });
});

describe('sectorLabel', () => {
  it('übersetzt bekannte IDs', () => {
    expect(sectorLabel('furniture_retail')).toBe('Möbelhaus');
    expect(sectorLabel('public_sector')).toBe('Öffentliche Einrichtung');
  });

  /**
   * Fällt auf die ID zurück, statt leer zu rendern: Ein Mandant mit einem
   * Wert, den die Config (noch) nicht kennt, soll seine Branche sehen — nicht
   * ein leeres Feld.
   */
  it('gibt einen unbekannten Bestandswert unverändert zurück', () => {
    expect(sectorLabel('ein_alter_wert')).toBe('ein_alter_wert');
  });
});

describe('isSectorId', () => {
  it('trennt bekannte von unbekannten Werten', () => {
    expect(isSectorId('manufacturing')).toBe(true);
    expect(isSectorId('scale')).toBe(false);
  });
});

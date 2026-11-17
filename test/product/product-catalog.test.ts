// Produktkatalog: Produkte einzeln über die Landing erreichbar, alle Module in
// einer Schaltzentrale. Status kommt nur aus der Registry, Ziele müssen echte
// Routen sein, und der KI-Empfang steht nach K4 vorn.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PRODUCT_CATALOG,
  getProduct,
  productStatus,
  productStatusLabel,
} from '../../src/product/product-catalog';
import { getImplementation } from '../../src/product/implementation-status';

const ROOT = resolve(__dirname, '../..');
const app = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf-8');
const catalogSrc = readFileSync(resolve(ROOT, 'src/product/product-catalog.ts'), 'utf-8');

const FORBIDDEN_CTA =
  /Pilot|Demo|Gespräch|Call|Beratung|Termin vereinbaren|Termin buchen|Sales|Vertrieb/i;

describe('PRODUCT_CATALOG', () => {
  it('hat eindeutige IDs', () => {
    const ids = PRODUCT_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('verweist jedes Produkt auf einen Registry-Eintrag und übernimmt dessen Status', () => {
    for (const p of PRODUCT_CATALOG) {
      const item = getImplementation(p.implementationId);
      expect(item, p.implementationId).toBeDefined();
      expect(productStatus(p)).toBe(item!.status);
    }
  });

  it('pflegt keinen eigenen Status neben der Registry', () => {
    expect(catalogSrc).not.toMatch(/status:\s*'(live|preview|coming-soon)'/);
  });

  it('führt nur auf Routen, die im Router existieren (Landing und Schaltzentrale)', () => {
    for (const p of PRODUCT_CATALOG) {
      expect(app, p.landingPath).toContain(`path="${p.landingPath}"`);
      expect(app, p.appPath).toContain(`path="${p.appPath}"`);
      expect(p.appPath.startsWith('/app/')).toBe(true);
    }
  });

  it('stellt den KI-Empfang (AI Receptionist) nach K4 an den Anfang', () => {
    expect(PRODUCT_CATALOG[0].id).toBe('ki-empfang-telefon');
    expect(PRODUCT_CATALOG[1].id).toBe('ki-empfang-chat');
  });

  it('nutzt keine Kontakt-, Demo- oder Beratungssprache und keine Preise', () => {
    for (const p of PRODUCT_CATALOG) {
      expect(`${p.name} ${p.promise}`).not.toMatch(FORBIDDEN_CTA);
      expect(`${p.name} ${p.promise}`).not.toMatch(/€|EUR/);
    }
  });

  it('zeigt nicht-live Produkte ehrlich als „In Arbeit“ oder „Geplant“', () => {
    for (const p of PRODUCT_CATALOG) {
      const label = productStatusLabel(p);
      if (productStatus(p) === 'live') expect(label).toBe('Live');
      else expect(['In Arbeit', 'Geplant']).toContain(label);
    }
  });

  it('findet Produkte über ihre ID', () => {
    expect(getProduct('governance-scan')?.landingPath).toBe('/audit');
    expect(getProduct('gibt-es-nicht')).toBeUndefined();
  });
});

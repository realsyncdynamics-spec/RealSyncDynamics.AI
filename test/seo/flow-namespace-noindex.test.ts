/**
 * `/flow/*` ist Prozess-UI, kein Inhalt: Jeder Schritt des geführten Flows
 * bekommt `noindex`, auch neue und unbekannte Slugs (fail-closed). Der Test
 * zieht die Schritte aus `flowRoutes.ts`, damit ein neuer Schritt automatisch
 * mitgeprüft wird, und sichert, dass der Rest der SEO-Auflösung unverändert
 * bleibt.
 *
 * Grenze: Das ist die Robots-Logik des gerenderten React-Dokuments. Die
 * SPA-Shell für nicht vorgerenderte Routen ist davon unberührt.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEO, FLOW_SEO, SEO_CONFIG, getSeoForPath, isFlowPath } from '../../src/config/seo';
import { FLOW_STEP_LIST } from '../../src/flow/flowRoutes';

const FLOW_STEP_PATHS = FLOW_STEP_LIST.map((step) => `/flow/${step.slug}`);

describe('SEO: /flow-Namespace ist noindex', () => {
  it('kennt die Flow-Schritte aus der Quelle (nicht leer, eindeutige Slugs)', () => {
    expect(FLOW_STEP_PATHS.length).toBeGreaterThan(0);
    expect(new Set(FLOW_STEP_PATHS).size).toBe(FLOW_STEP_PATHS.length);
  });

  it('setzt jeden definierten Flow-Schritt auf noindex', () => {
    for (const path of FLOW_STEP_PATHS) {
      const seo = getSeoForPath(path);
      expect(seo.noIndex, path).toBe(true);
    }
  });

  it('deckt den Namespace-Einstieg und verschachtelte Slugs ab', () => {
    for (const path of ['/flow', '/flow/', '/flow/scan-running', '/flow/scan-running/', '/flow/checkout/starter']) {
      expect(getSeoForPath(path).noIndex, path).toBe(true);
    }
  });

  it('ist fail-closed für unbekannte Flow-Slugs', () => {
    for (const path of ['/flow/irgendwas', '/flow/neuer-schritt/unterseite', '/flow/../flow/x']) {
      expect(getSeoForPath(path).noIndex, path).toBe(true);
    }
  });

  it('greift nur auf dem Namespace, nicht auf Präfix-Kollisionen', () => {
    expect(isFlowPath('/flowers')).toBe(false);
    expect(isFlowPath('/flow-chart')).toBe(false);
    expect(isFlowPath('/warteliste')).toBe(false);
    expect(getSeoForPath('/flowers').noIndex).not.toBe(true);
    expect(getSeoForPath('/flow-chart')).toBe(DEFAULT_SEO);
  });

  it('liefert für den Namespace die Default-Texte plus noindex, nichts Erfundenes', () => {
    expect(FLOW_SEO.title).toBe(DEFAULT_SEO.title);
    expect(FLOW_SEO.description).toBe(DEFAULT_SEO.description);
    expect(FLOW_SEO.noIndex).toBe(true);
    expect(getSeoForPath('/flow/start-scan')).toBe(FLOW_SEO);
  });

  it('lässt die bestehende Auflösung unverändert', () => {
    expect(getSeoForPath('/')).toBe(SEO_CONFIG['/']);
    expect(getSeoForPath('/pricing')).toBe(SEO_CONFIG['/pricing']);
    expect(getSeoForPath('/pricing/')).toBe(SEO_CONFIG['/pricing']);
    expect(getSeoForPath('/warteliste')).toBe(SEO_CONFIG['/warteliste']);
    expect(getSeoForPath('/warteliste').noIndex).not.toBe(true);
    expect(getSeoForPath('/gibt-es-nicht-xyz')).toBe(DEFAULT_SEO);
  });

  it('hat keinen Einzeleintrag unter /flow, den die Namespace-Regel still überdecken würde', () => {
    const shadowed = Object.keys(SEO_CONFIG).filter((key) => isFlowPath(key));
    expect(shadowed).toEqual([]);
  });

  it('prüft den Namespace vor dem Map-Lookup (Reihenfolge im Quelltext)', () => {
    const source = readFileSync(resolve(__dirname, '../../src/config/seo.ts'), 'utf8');
    const fn = source.slice(source.indexOf('export function getSeoForPath'));
    const check = fn.indexOf('isFlowPath(path)');
    const lookup = fn.indexOf('SEO_CONFIG[path]');
    expect(check).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(check);
  });
});

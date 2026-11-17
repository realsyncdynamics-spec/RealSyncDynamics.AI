// @vitest-environment node
/**
 * Produkt-Landings `/produkte/*`: Jeder Button zeigt auf eine vorhandene Route,
 * kein CTA nutzt gesperrtes Vokabular, Status-IDs existieren in der Registry.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCT_LANDINGS, productLandingPath } from '../../src/components/landing/product/content';
import { CI_FORBIDDEN_CTA } from '../../src/content/runtimeVocab';
import { getImplementation } from '../../src/product/implementation-status';
import { safeInternalPath } from '../../src/lib/safeInternalPath';
import { planById } from '../../shared/pricing';

const app = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8');
const routes = [...app.matchAll(/\bpath="([^"]+)"/g)].map((m) => m[1]);
const hasRoute = (pathname: string) => routes.includes(pathname);

/** Zielpfad eines Links; bei `/welcome?next=…` zusätzlich das Weiterleitungsziel. */
function targets(to: string): string[] {
  const url = new URL(to, 'https://example.invalid');
  const next = url.searchParams.get('next');
  return next ? [url.pathname, next] : [url.pathname];
}

describe('Produkt-Landings', () => {
  it('haben je eine Route in src/App.tsx', () => {
    for (const product of PRODUCT_LANDINGS) {
      expect(hasRoute(productLandingPath(product.slug)), product.slug).toBe(true);
    }
  });

  it('verlinken nur vorhandene Routen', () => {
    for (const product of PRODUCT_LANDINGS) {
      const links = [
        product.primaryCta.to,
        product.secondaryCta.to,
        ...product.sections.flatMap((s) => (s.cards ?? []).flatMap((c) => (c.to ? [c.to] : []))),
      ];
      for (const to of links) {
        for (const pathname of targets(to)) {
          expect(hasRoute(pathname), `${product.slug}: ${to}`).toBe(true);
        }
        const next = new URL(to, 'https://example.invalid').searchParams.get('next');
        if (next) expect(safeInternalPath(next), `${product.slug}: ${to}`).toBe(next);
      }
    }
  });

  it('nutzen kein gesperrtes CTA-Vokabular', () => {
    for (const product of PRODUCT_LANDINGS) {
      const labels = [
        product.primaryCta.label,
        product.secondaryCta.label,
        ...product.sections.flatMap((s) => (s.cards ?? []).flatMap((c) => (c.toLabel ? [c.toLabel] : []))),
      ];
      for (const label of labels) {
        for (const forbidden of CI_FORBIDDEN_CTA) {
          expect(label.toLowerCase().includes(forbidden.toLowerCase()), `${product.slug}: ${label}`).toBe(false);
        }
      }
    }
  });

  it('referenzieren nur Status-IDs aus der Registry', () => {
    for (const product of PRODUCT_LANDINGS) {
      const ids = [product.statusId, ...product.sections.flatMap((s) => (s.cards ?? []).map((c) => c.statusId))];
      for (const id of ids) {
        if (id) expect(getImplementation(id), `${product.slug}: ${id}`).toBeDefined();
      }
    }
  });

  it('leiten Paketwerte aus shared/pricing.ts ab', () => {
    const starter = planById('starter');
    for (const product of PRODUCT_LANDINGS) {
      for (const row of product.planRows) {
        expect(['string', 'boolean']).toContain(typeof row.value(starter));
      }
    }
  });
});

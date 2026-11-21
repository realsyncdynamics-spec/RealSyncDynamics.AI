import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRODUCT_LANDINGS, productLandingStatus } from '../../src/config/productLandings';
import { IMPLEMENTATION_ITEMS } from '../../src/product/implementation-status';

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('RealSync Dachmarke: White Product Landings', () => {
  it('hat sechs eindeutige Produktrouten im Haupt-Router', () => {
    const app = read('src/App.tsx');
    expect(PRODUCT_LANDINGS).toHaveLength(6);
    expect(new Set(PRODUCT_LANDINGS.map((p) => p.slug)).size).toBe(6);
    for (const product of PRODUCT_LANDINGS) {
      expect(app).toContain('path="/' + product.slug + '"');
    }
  });

  it('zeigt nur belegte Status aus der Produktregistry', () => {
    for (const product of PRODUCT_LANDINGS) {
      const item = IMPLEMENTATION_ITEMS.find((entry) => entry.id === product.registryId);
      expect(productLandingStatus(product)).toBe(item?.status ?? 'coming-soon');
    }
    expect(productLandingStatus(PRODUCT_LANDINGS.find((p) => p.slug === 'voice-agent')!)).toBe('coming-soon');
    expect(productLandingStatus(PRODUCT_LANDINGS.find((p) => p.slug === 'software-factory')!)).toBe('coming-soon');
  });

  it('hält alle Seiten in einem White-Designsystem mit verschiedenen Hero-Varianten', () => {
    const src = read('src/pages/ProductLanding.tsx');
    const css = read('src/styles/product-landings.css');
    expect(src).toContain('ProductHeroVisual variant={product.slug}');
    expect(css).toContain('--rpl-page: #fff');
    for (const product of PRODUCT_LANDINGS) expect(src).toContain("variant === '" + product.slug + "'");
  });

  it('lässt das Original-Higgsfield-Medium optional und die vorhandene Bühne als Fallback', () => {
    const hero = read('src/components/landing/v3/HiggsfieldBotHero.tsx');
    expect(hero).toContain('VITE_HIGGSFIELD_BOT_VIDEO_URL');
    expect(hero).toContain('<SyncStage');
    expect(hero).toContain('VITE_HIGGSFIELD_BOT_VERIFIED_SYNC');
    expect(hero).toContain('SYNC_STILL_SRC');
    expect(hero).toContain('prefers-reduced-motion');
    expect(hero).toContain('onError={() => setFailed(true)}');
  });

  it('erfindet keine Preise, Checkout- oder Live-Claims', () => {
    const src = read('src/config/productLandings.ts');
    expect(src).not.toMatch(/\b(79|249|699|1498)\s*€/);
    expect(src).not.toMatch(/vollständig funktionsfähig|garantiert DSGVO-konform/i);
  });
});

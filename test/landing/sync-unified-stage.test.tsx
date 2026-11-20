import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRODUCT_LANDINGS } from '../../src/config/productLandings';
import { approvedSyncVideoUrl } from '../../src/components/landing/v3/HiggsfieldBotHero';
import { SYNC_MODEL_SRC, SYNC_STILL_SRC } from '../../src/components/visual/sync-mascot/SyncStage';

const read = (name: string) => readFileSync(resolve(__dirname, '../..', name), 'utf8');

describe('SYNC – ein Mastermodell für Dachmarke und sechs Produkte', () => {
  it('teilt ein lokales GLB und ein lokales Still zwischen Startseite und Produktfamilie', () => {
    expect(SYNC_MODEL_SRC).toBe('/models/sync-mascot.glb');
    expect(SYNC_STILL_SRC).toBe('/landing-v3/sync-still.jpg');
    const stage = read('src/components/visual/sync-mascot/SyncStage.tsx');
    const home = read('src/components/landing/v3/HiggsfieldBotHero.tsx');
    const products = read('src/pages/ProductLanding.tsx');
    expect(stage).toContain("import('./syncMascotScene')");
    expect(stage).toContain('canRun3D()');
    expect(stage).toContain('onError: () =>');
    expect(home).toContain('<SyncStage variant="home"');
    expect(products).toContain('<SyncStage variant={product.slug}');
    expect(products).toContain('<ProductHeroVisual variant={product.slug}');
  });

  it('enthält genau die sechs unterschiedlichen 3D-Kameravarianten für die Produktseiten', () => {
    const stage = read('src/components/visual/sync-mascot/SyncStage.tsx');
    expect(PRODUCT_LANDINGS).toHaveLength(6);
    for (const { slug } of PRODUCT_LANDINGS) {
      expect(stage).toContain("'" + slug + "': { theta:");
    }
  });

  it('schaltet fremde, nicht genehmigte oder unplausible Video-URLs ab', () => {
    expect(approvedSyncVideoUrl('/assets/sync-original.mp4', true)).toBe('/assets/sync-original.mp4');
    expect(approvedSyncVideoUrl('/assets/sync-original.webm', true)).toBe('/assets/sync-original.webm');
    expect(approvedSyncVideoUrl('/assets/sync-original.mp4', false)).toBeNull();
    expect(approvedSyncVideoUrl('https://example.com/sync.mp4', true)).toBeNull();
    expect(approvedSyncVideoUrl('//example.com/sync.mp4', true)).toBeNull();
    expect(approvedSyncVideoUrl('/assets/../sync.mp4', true)).toBeNull();
    expect(approvedSyncVideoUrl('/assets/sync.gif', true)).toBeNull();
  });

  it('rendert ohne WebGL oder bei reduzierter Bewegung weiterhin ein SYNC-Standbild', () => {
    const stage = read('src/components/visual/sync-mascot/SyncStage.tsx');
    expect(stage).toContain('if (!canRun3D())');
    expect(stage).toContain('setMode(\'still\')');
    expect(stage).toContain('src={SYNC_STILL_SRC}');
    const stylesheet = read('src/styles/sync-stage.css');
    expect(stylesheet).toContain('prefers-reduced-motion: reduce');
    expect(stylesheet).toContain('.rpl-sync-composition');
  });

  it('verwendet eine unveränderte GLB-Quelle statt einer erfundenen KI-generierten Figurenvariante', () => {
    const renderer = read('src/components/visual/sync-mascot/syncMascotScene.ts');
    expect(renderer).toContain('GLTFLoader');
    expect(renderer).toContain("const WAVE_CLIP = 'Scene'");
    const products = read('src/pages/ProductLanding.tsx');
    expect(products).not.toMatch(/<video|autoPlay/i);
  });
});

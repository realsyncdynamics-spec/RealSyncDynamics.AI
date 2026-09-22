import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Governance AI public backdrop — adaptive texture path', () => {
  it('wires the public / backdrop to KTX2 with WebP fallback', () => {
    const backdrop = readFileSync(
      resolve(__dirname, '../../src/components/landing/GovernanceAiBackdrop.tsx'),
      'utf8',
    );

    expect(backdrop).toContain("shouldPreferGpuCompression");
    expect(backdrop).toContain("three/addons/loaders/KTX2Loader.js");
    expect(backdrop).toContain("setTranscoderPath('/basis/')");
    expect(backdrop).toContain('set.dayKtx2');
    expect(backdrop).toContain('set.nightKtx2');
    expect(backdrop).toContain('set.cloudsKtx2');
    expect(backdrop).toContain('set.specularKtx2');
    expect(backdrop).toContain('loadWebpTexture');
  });

  it('keeps committed KTX2 + Basis runtime assets available to the public surface', () => {
    const root = resolve(__dirname, '../../public');
    for (const file of [
      'textures/earth-day-2k.ktx2',
      'textures/earth-day-4k.ktx2',
      'textures/earth-night-2k.ktx2',
      'textures/earth-clouds-2k.ktx2',
      'textures/earth-specular-1k.ktx2',
      'basis/basis_transcoder.js',
      'basis/basis_transcoder.wasm',
    ]) {
      expect(existsSync(resolve(root, file)), file).toBe(true);
    }
  });
});

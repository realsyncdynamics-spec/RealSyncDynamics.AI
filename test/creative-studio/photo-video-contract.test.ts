import { describe, expect, it } from 'vitest';
import { MAX_PHOTO_BYTES, validatePhoto, validateScript, canPreview } from '../../src/features/creative-studio/digital-twin/photoVideoContract';

describe('Digital Twin photo preview', () => {
  const image = { type: 'image/jpeg', size: 1024 };
  it('accepts valid photos', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) expect(validatePhoto({type,size:1024})).toBeNull();
  });
  it('rejects unsupported, zero-byte, oversized images', () => {
    expect(validatePhoto({type:'image/svg+xml',size:1024})).toBeTruthy();
    expect(validatePhoto({type:'image/jpeg',size:0})).toBeTruthy();
    expect(validatePhoto({type:'image/png',size:MAX_PHOTO_BYTES+1})).toBeTruthy();
  });
  it('checks script', () => {
    expect(validateScript(' ')).toBeTruthy();
    expect(validateScript('x'.repeat(1001))).toBeTruthy();
    expect(validateScript('Hallo.')).toBeNull();
  });
  it('fails closed when consent or tenant is missing', () => {
    expect(canPreview(image,'Hallo.',true,'demo-tenant')).toBe(true);
    expect(canPreview(image,'Hallo.',false,'demo-tenant')).toBe(false);
    expect(canPreview(image,'Hallo.',true,null)).toBe(false);
    expect(canPreview(null,'Hallo.',true,'demo-tenant')).toBe(false);
  });
});

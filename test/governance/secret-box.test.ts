import { describe, it, expect } from 'vitest';
import { importSecretKey, seal, open } from '../../supabase/functions/_shared/secretBox';

const KEY_B64 = Buffer.alloc(32, 7).toString('base64');
const OTHER_KEY_B64 = Buffer.alloc(32, 9).toString('base64');

describe('secretBox', () => {
  it('Roundtrip: seal → open liefert das Original', async () => {
    const key = await importSecretKey(KEY_B64);
    const secret = { api_key: 'sk-live-123', workspace: 'w1' };
    const sealed = await seal(key, secret);
    expect(sealed.startsWith('v1:')).toBe(true);
    expect(sealed).not.toContain('sk-live-123');
    expect(await open(key, sealed)).toEqual(secret);
  });

  it('zwei Siegel desselben Werts sind verschieden (frische IV)', async () => {
    const key = await importSecretKey(KEY_B64);
    expect(await seal(key, { a: 1 })).not.toBe(await seal(key, { a: 1 }));
  });

  it('Manipulation und falscher Schluessel werfen — kein stiller Fallback', async () => {
    const key = await importSecretKey(KEY_B64);
    const sealed = await seal(key, { a: 1 });
    const tampered = sealed.slice(0, -4) + (sealed.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await expect(open(key, tampered)).rejects.toThrow();
    const wrongKey = await importSecretKey(OTHER_KEY_B64);
    await expect(open(wrongKey, sealed)).rejects.toThrow();
    await expect(open(key, 'v0:abc:def')).rejects.toThrow('unknown seal format');
  });

  it('lehnt Schluessel mit falscher Laenge ab', async () => {
    await expect(importSecretKey(Buffer.alloc(16, 1).toString('base64'))).rejects.toThrow('32 bytes');
  });
});

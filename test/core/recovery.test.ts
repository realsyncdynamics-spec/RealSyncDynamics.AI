import { describe, it, expect } from 'vitest';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from '../../src/core/access/recovery';

describe('MFA recovery codes', () => {
  it('erzeugt die gewünschte Anzahl eindeutiger Codes im Format XXXX-XXXX-XXXX', () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10); // eindeutig
    for (const c of codes) {
      expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }
  });

  it('normalisiert Eingaben (Leerzeichen, Bindestriche, Kleinschreibung)', () => {
    expect(normalizeRecoveryCode('abcd-efgh-jklm')).toBe('ABCDEFGHJKLM');
    expect(normalizeRecoveryCode('AB CD EF')).toBe('ABCDEF');
  });

  it('hash ist deterministisch und normalisierungs-invariant', async () => {
    const h1 = await hashRecoveryCode('ABCD-EFGH-JKLM');
    const h2 = await hashRecoveryCode('abcd efgh jklm');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verschiedene Codes ergeben verschiedene Hashes', async () => {
    const [a, b] = generateRecoveryCodes(2);
    expect(await hashRecoveryCode(a)).not.toBe(await hashRecoveryCode(b));
  });
});

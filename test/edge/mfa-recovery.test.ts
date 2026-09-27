import { describe, expect, it } from 'vitest';
import {
  findConsumableRecoveryCode,
  normalizeRecoveryCode,
  sha256HexRecoveryCode,
  type RecoveryCodeRow,
} from '../../supabase/functions/_shared/mfaRecovery.ts';

describe('mfa recovery helper', () => {
  it('hasht normalisiert (deterministisch)', async () => {
    const a = await sha256HexRecoveryCode('ABCD-EFGH-JKLM');
    const b = await sha256HexRecoveryCode('abcd efgh jklm');
    expect(normalizeRecoveryCode('ab cd-ef')).toBe('ABCDEF');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('consume wählt nur passenden unbenutzten Code des Benutzers', async () => {
    const validHash = await sha256HexRecoveryCode('ABCD-EFGH-JKLM');
    const rows: RecoveryCodeRow[] = [
      { id: 'a', user_id: 'u1', code_hash: validHash, used_at: '2026-01-01T00:00:00Z' },
      { id: 'b', user_id: 'u2', code_hash: validHash, used_at: null },
      { id: 'c', user_id: 'u1', code_hash: validHash, used_at: null },
    ];
    expect(findConsumableRecoveryCode(rows, 'u1', validHash)?.id).toBe('c');
    expect(findConsumableRecoveryCode(rows, 'u1', 'x')).toBeNull();
  });
});

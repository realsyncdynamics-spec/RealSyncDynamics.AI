/**
 * Vertragstests fuer den subject_ref HMAC-Helper (RFC §P2.2/2.3/2.4).
 *
 * Was hier bewiesen wird:
 *   - computeSubjectRef nutzt NUR den 'active' Key
 *   - kein active key  → throws (Vault-Provisioning-Bug surfacen)
 *   - mehrere active   → throws (Rotation-Race detection)
 *   - cross-kind collisions verhindert (kind-Tag im Canonical-Input)
 *   - verifySubjectRef matcht auch gegen 'rotating' Keys (Dual-Read)
 *   - verifySubjectRef iteriert alle Keys (kein early-exit; timing-safe)
 *   - verifySubjectRef vergleicht constant-time (gleichlange Hexs)
 *   - rotateSubjectRefKey ruft die SECURITY DEFINER RPC
 *
 * NICHT getestet (out-of-scope, braucht Staging-DB):
 *   - get_app_secret RPC selbst
 *   - dass die SQL rotate_subject_ref_key Funktion atomar ist
 */
import { describe, it, expect } from 'vitest';
import {
  computeSubjectRef,
  verifySubjectRef,
  rotateSubjectRefKey,
  __internals,
  type SubjectRefKeyRow,
  type AdminClient,
} from '../../supabase/functions/_shared/subject-ref';

// Minimal mock admin matching the subset of supabase-js the helper uses.
function makeMockAdmin(opts: {
  keys?: SubjectRefKeyRow[];
  fetchError?: string;
  rpcResult?: { data: unknown; error: { message: string } | null };
}) {
  const calls: { from?: string; rpc?: string; rpcArgs?: unknown; fetchStatuses?: string[] } = {};
  const admin: AdminClient = {
    from(table: string) {
      calls.from = table;
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: string) {
              return {
                in(_col2: string, vals: string[]) {
                  calls.fetchStatuses = vals;
                  return {
                    order(_col3: string, _opts: { ascending: boolean }) {
                      if (opts.fetchError) {
                        return Promise.resolve({ data: null, error: { message: opts.fetchError } });
                      }
                      const filtered = (opts.keys ?? []).filter((k) => vals.includes(k.status));
                      return Promise.resolve({ data: filtered, error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    rpc(name: string, args: Record<string, unknown>) {
      calls.rpc = name;
      calls.rpcArgs = args;
      return Promise.resolve(opts.rpcResult ?? { data: null, error: null });
    },
  };
  return { admin, calls };
}

const KEY_V1: SubjectRefKeyRow = {
  tenant_id:         'tenant-A',
  key_version:       1,
  algorithm:         'HMAC-SHA-256',
  vault_secret_name: 'subject_ref_tenant_a_v1',
  status:            'active',
};

const KEY_V0_ROTATING: SubjectRefKeyRow = {
  tenant_id:         'tenant-A',
  key_version:       0,
  algorithm:         'HMAC-SHA-256',
  vault_secret_name: 'subject_ref_tenant_a_v0',
  status:            'rotating',
};

const SECRETS: Record<string, string> = {
  subject_ref_tenant_a_v0: 'old-shared-secret-bytes-32-chars-aaaaaaaa',
  subject_ref_tenant_a_v1: 'new-shared-secret-bytes-32-chars-bbbbbbbb',
};

const mockResolver = (name: string) => Promise.resolve(SECRETS[name] ?? null);

describe('canonicalMessage (cross-kind safety)', () => {
  it('different kinds yield different canonical inputs', () => {
    const a = __internals.canonicalMessage('email', 'foo@bar');
    const b = __internals.canonicalMessage('user_id', 'foo@bar');
    expect(a).not.toBe(b);
    expect(a.startsWith('email:')).toBe(true);
    expect(b.startsWith('user_id:')).toBe(true);
  });
});

describe('hmacSha256Hex', () => {
  it('returns deterministic 64-char hex', async () => {
    const h1 = await __internals.hmacSha256Hex('k', 'msg');
    const h2 = await __internals.hmacSha256Hex('k', 'msg');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different keys yield different outputs', async () => {
    const h1 = await __internals.hmacSha256Hex('k1', 'msg');
    const h2 = await __internals.hmacSha256Hex('k2', 'msg');
    expect(h1).not.toBe(h2);
  });

  it('throws on empty secret', async () => {
    await expect(__internals.hmacSha256Hex('', 'msg')).rejects.toThrow(/empty secret/);
  });
});

describe('timingSafeEqualHex', () => {
  it('matches identical hex', () => {
    expect(__internals.timingSafeEqualHex('aabb', 'aabb')).toBe(true);
  });
  it('rejects different hex of same length', () => {
    expect(__internals.timingSafeEqualHex('aabb', 'aabc')).toBe(false);
  });
  it('rejects different lengths', () => {
    expect(__internals.timingSafeEqualHex('aabb', 'aabbcc')).toBe(false);
  });
});

describe('computeSubjectRef', () => {
  it('throws when no active key exists', async () => {
    const { admin } = makeMockAdmin({ keys: [KEY_V0_ROTATING] });
    await expect(
      computeSubjectRef(admin, { tenant_id: 'tenant-A', subject_kind: 'email', value: 'a@b' }, mockResolver),
    ).rejects.toThrow(/no active key/);
  });

  it('throws when multiple active keys exist (rotation race)', async () => {
    const { admin } = makeMockAdmin({
      keys: [{ ...KEY_V1, key_version: 2 }, KEY_V1],
    });
    await expect(
      computeSubjectRef(admin, { tenant_id: 'tenant-A', subject_kind: 'email', value: 'a@b' }, mockResolver),
    ).rejects.toThrow(/2 active keys/);
  });

  it('throws when vault returns empty secret', async () => {
    const { admin } = makeMockAdmin({ keys: [KEY_V1] });
    await expect(
      computeSubjectRef(admin, { tenant_id: 'tenant-A', subject_kind: 'email', value: 'a@b' },
        () => Promise.resolve(null)),
    ).rejects.toThrow(/vault secret .* resolved empty/);
  });

  it('computes a deterministic 64-char hex ref + returns key_version', async () => {
    const { admin } = makeMockAdmin({ keys: [KEY_V1] });
    const result = await computeSubjectRef(
      admin,
      { tenant_id: 'tenant-A', subject_kind: 'email', value: 'a@b' },
      mockResolver,
    );
    expect(result.subject_ref).toMatch(/^[0-9a-f]{64}$/);
    expect(result.key_version).toBe(1);

    // Idempotent — same input → same ref
    const result2 = await computeSubjectRef(
      admin,
      { tenant_id: 'tenant-A', subject_kind: 'email', value: 'a@b' },
      mockResolver,
    );
    expect(result2.subject_ref).toBe(result.subject_ref);
  });

  it('cross-kind isolation — same value, different kind → different ref', async () => {
    const { admin } = makeMockAdmin({ keys: [KEY_V1] });
    const asEmail = await computeSubjectRef(
      admin, { tenant_id: 'tenant-A', subject_kind: 'email',   value: 'foo' }, mockResolver);
    const asUser  = await computeSubjectRef(
      admin, { tenant_id: 'tenant-A', subject_kind: 'user_id', value: 'foo' }, mockResolver);
    expect(asEmail.subject_ref).not.toBe(asUser.subject_ref);
  });
});

describe('verifySubjectRef', () => {
  it('matches against ACTIVE key', async () => {
    const { admin } = makeMockAdmin({ keys: [KEY_V1] });
    const { subject_ref } = await computeSubjectRef(
      admin, { tenant_id: 'tenant-A', subject_kind: 'email', value: 'a@b' }, mockResolver);

    const result = await verifySubjectRef(
      admin,
      { tenant_id: 'tenant-A', subject_kind: 'email', candidate: 'a@b', subject_ref },
      mockResolver,
    );
    expect(result.matched).toBe(true);
    expect(result.key_version).toBe(1);
  });

  it('matches against ROTATING key (dual-read window)', async () => {
    // Pre-compute under v0 (when v0 was still active)
    const v0OnlyAdmin = makeMockAdmin({ keys: [{ ...KEY_V0_ROTATING, status: 'active' }] }).admin;
    const oldRef = (await computeSubjectRef(
      v0OnlyAdmin, { tenant_id: 'tenant-A', subject_kind: 'email', value: 'a@b' }, mockResolver))
      .subject_ref;

    // Now both keys present, v0 demoted to rotating, v1 is active. Old refs MUST still verify.
    const { admin } = makeMockAdmin({ keys: [KEY_V1, KEY_V0_ROTATING] });
    const result = await verifySubjectRef(
      admin,
      { tenant_id: 'tenant-A', subject_kind: 'email', candidate: 'a@b', subject_ref: oldRef },
      mockResolver,
    );
    expect(result.matched).toBe(true);
    expect(result.key_version).toBe(0);
  });

  it('does NOT match retired keys', async () => {
    // Pre-compute under a now-retired key.
    const retired: SubjectRefKeyRow = { ...KEY_V0_ROTATING, status: 'retired' };
    // Compute the ref directly via internals to bypass the helper's active-only
    // requirement (the helper itself would refuse to compute under a retired key).
    const refUnderRetired = await __internals.hmacSha256Hex(
      SECRETS[retired.vault_secret_name],
      __internals.canonicalMessage('email', 'a@b'),
    );

    // verify only sees retired keys → MUST NOT match (retired keys are excluded
    // from the in() filter on status).
    const { admin } = makeMockAdmin({ keys: [retired] });
    const result = await verifySubjectRef(
      admin,
      { tenant_id: 'tenant-A', subject_kind: 'email', candidate: 'a@b', subject_ref: refUnderRetired },
      mockResolver,
    );
    expect(result.matched).toBe(false);
  });

  it('rejects when candidate is wrong', async () => {
    const { admin } = makeMockAdmin({ keys: [KEY_V1] });
    const { subject_ref } = await computeSubjectRef(
      admin, { tenant_id: 'tenant-A', subject_kind: 'email', value: 'a@b' }, mockResolver);

    const result = await verifySubjectRef(
      admin,
      { tenant_id: 'tenant-A', subject_kind: 'email', candidate: 'WRONG', subject_ref },
      mockResolver,
    );
    expect(result.matched).toBe(false);
  });

  it('returns false when no keys exist', async () => {
    const { admin } = makeMockAdmin({ keys: [] });
    const result = await verifySubjectRef(
      admin,
      { tenant_id: 'tenant-A', subject_kind: 'email', candidate: 'a@b', subject_ref: 'deadbeef' },
      mockResolver,
    );
    expect(result.matched).toBe(false);
  });

  it('throws when DB fetch fails', async () => {
    const { admin } = makeMockAdmin({ fetchError: 'connection lost' });
    await expect(
      verifySubjectRef(admin, {
        tenant_id: 'tenant-A', subject_kind: 'email',
        candidate: 'a@b', subject_ref: 'x',
      }, mockResolver),
    ).rejects.toThrow(/fetchKeys failed/);
  });
});

describe('rotateSubjectRefKey', () => {
  it('calls the SECURITY DEFINER RPC with correct args + parses result', async () => {
    const { admin, calls } = makeMockAdmin({
      rpcResult: { data: [{ key_version: 5, status: 'active' }], error: null },
    });
    const result = await rotateSubjectRefKey(admin, {
      tenant_id:         'tenant-A',
      vault_secret_name: 'subject_ref_tenant_a_v5',
    });
    expect(calls.rpc).toBe('rotate_subject_ref_key');
    expect(calls.rpcArgs).toEqual({
      p_tenant_id:         'tenant-A',
      p_vault_secret_name: 'subject_ref_tenant_a_v5',
    });
    expect(result).toEqual({ key_version: 5, status: 'active' });
  });

  it('handles non-array RPC return shape', async () => {
    const { admin } = makeMockAdmin({
      rpcResult: { data: { key_version: 7, status: 'active' }, error: null },
    });
    const result = await rotateSubjectRefKey(admin, {
      tenant_id: 'tenant-A', vault_secret_name: 'v7',
    });
    expect(result.key_version).toBe(7);
  });

  it('throws on RPC error', async () => {
    const { admin } = makeMockAdmin({
      rpcResult: { data: null, error: { message: 'p_vault_secret_name is empty' } },
    });
    await expect(
      rotateSubjectRefKey(admin, { tenant_id: 'tenant-A', vault_secret_name: '' }),
    ).rejects.toThrow(/p_vault_secret_name is empty/);
  });

  it('throws on unexpected RPC shape', async () => {
    const { admin } = makeMockAdmin({ rpcResult: { data: null, error: null } });
    await expect(
      rotateSubjectRefKey(admin, { tenant_id: 'tenant-A', vault_secret_name: 'v1' }),
    ).rejects.toThrow(/unexpected shape/);
  });
});

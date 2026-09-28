import { describe, it, expect, vi } from 'vitest';

vi.mock('@/src/lib/supabase', () => ({
  isSupabaseConfigured: () => false,
  getSupabase: () => {
    throw new Error('not configured');
  },
}));

import {
  loadProfile,
  saveProfile,
  parseProfile,
  profileKey,
  registerProfileWithTenant,
  ProfileError,
  assertActivatable,
  type KeyValueStorage,
} from '@/src/features/local-ai/profileStore';
import type { LocalAiRuntimeProfile } from '@/src/features/local-ai/types';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const PASSED: LocalAiRuntimeProfile = {
  schema_version: 1,
  scope: 'device_local',
  profile_name: 'Local Governance Runtime',
  runtime_url: 'http://127.0.0.1:11434',
  model: 'granite4.2:8b',
  role: 'governance',
  last_healthcheck: '2026-09-28T10:00:00.000Z',
  test_result: {
    overall: 'success',
    model: 'granite4.2:8b',
    ranAt: '2026-09-28T10:01:00.000Z',
    checks: [{ id: 'json_valid', status: 'success' }],
  },
  enabled: true,
};

describe('profile storage', () => {
  it('requires a verified tenant to build a key', () => {
    expect(() => profileKey(null)).toThrow(ProfileError);
    expect(profileKey('t-1')).toBe('realsync.localAi.profile.v1:t-1');
  });

  it('saves and loads per verified tenant, isolated from other tenants', () => {
    const s = memoryStorage();
    saveProfile('t-1', PASSED, s);
    expect(loadProfile('t-1', s)?.model).toBe('granite4.2:8b');
    expect(loadProfile('t-2', s)).toBeNull();
    expect(loadProfile(null, s)).toBeNull();
  });

  it('strips a smuggled tenant_id and never treats stored data as authority', () => {
    const parsed = parseProfile({ ...PASSED, tenant_id: 'attacker' });
    expect(parsed).not.toBeNull();
    expect(parsed && 'tenant_id' in parsed).toBe(false);
  });

  it('refuses to enable a profile without a passed test for the same model', () => {
    const s = memoryStorage();
    const failed = { ...PASSED, test_result: { ...PASSED.test_result!, overall: 'failed' as const } };
    expect(() => saveProfile('t-1', failed, s)).not.toThrow();
    // parseProfile setzt enabled=false, wenn der Test nicht bestanden ist
    expect(loadProfile('t-1', s)?.enabled).toBe(false);

    const otherModel = { ...PASSED, model: 'qwen3.8:27b' };
    expect(() => saveProfile('t-1', otherModel, s)).toThrow(/Governance-Test/);
    const noHealth = { ...PASSED, last_healthcheck: null };
    expect(() => saveProfile('t-1', noHealth, s)).toThrow(ProfileError);
  });

  it('rejects tampered stored profiles (public host, unknown role)', () => {
    expect(parseProfile({ ...PASSED, runtime_url: 'https://evil.example.com' })).toBeNull();
    expect(parseProfile({ ...PASSED, role: 'root' })).toBeNull();
    expect(parseProfile({ ...PASSED, schema_version: 2 })).toBeNull();
  });

  it('never loads a cloud-model profile as enabled, even one stored before the block', () => {
    const cloud = 'gpt-oss:120b-cloud';
    const stored = { ...PASSED, model: cloud, test_result: { ...PASSED.test_result!, model: cloud } };
    const s = memoryStorage();
    s.setItem(profileKey('t-1'), JSON.stringify(stored));
    expect(loadProfile('t-1', s)?.enabled).toBe(false);
    expect(() => assertActivatable(stored)).toThrow(/Cloud-Modell/);
  });

  it('downgrades enabled when the stored test is not a success', () => {
    const p = parseProfile({ ...PASSED, test_result: null });
    expect(p?.enabled).toBe(false);
  });
});

describe('registerProfileWithTenant (fail-closed edge abstraction)', () => {
  it('reports BACKEND_NOT_CONFIGURED without a backend', async () => {
    const r = await registerProfileWithTenant(PASSED, 't-1', null);
    expect(r).toMatchObject({ ok: false, code: 'BACKEND_NOT_CONFIGURED' });
  });

  it('maps 404 to BACKEND_NOT_DEPLOYED and 403 to NOT_AUTHORIZED', async () => {
    const notDeployed = await registerProfileWithTenant(PASSED, 't-1', async () => ({ data: null, error: { context: { status: 404 } } }));
    expect(notDeployed).toMatchObject({ ok: false, code: 'BACKEND_NOT_DEPLOYED' });
    const forbidden = await registerProfileWithTenant(PASSED, 't-1', async () => ({ data: null, error: { context: { status: 403 } } }));
    expect(forbidden).toMatchObject({ ok: false, code: 'NOT_AUTHORIZED' });
  });

  it('never reports a cloud model as a device-local runtime', async () => {
    const invoke = vi.fn();
    const r = await registerProfileWithTenant({ ...PASSED, model: 'glm-4.6:cloud' }, 't-1', invoke);
    expect(r).toMatchObject({ ok: false, code: 'CLOUD_MODEL' });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('does not count an unconfirmed response as registered', async () => {
    const r = await registerProfileWithTenant(PASSED, 't-1', async () => ({ data: { ok: true }, error: null }));
    expect(r).toMatchObject({ ok: false, code: 'BACKEND_ERROR' });
  });

  it('never sends tenant_id or the runtime URL', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { registered_at: '2026-09-28T10:00:00Z' }, error: null });
    const r = await registerProfileWithTenant(PASSED, 't-1', invoke);
    expect(r.ok).toBe(true);
    const body = invoke.mock.calls[0][1].body;
    expect(body).not.toHaveProperty('tenant_id');
    // Nur ein Auswahl-Hinweis aus dem verifizierten Kontext — der Server prüft die Mitgliedschaft.
    expect(body.tenant_hint).toBe('t-1');
    expect(body).not.toHaveProperty('runtime_url');
    expect(invoke.mock.calls[0][0]).toBe('local-ai-runtime');
  });
});

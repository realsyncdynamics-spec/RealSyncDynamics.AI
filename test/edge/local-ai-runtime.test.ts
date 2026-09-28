/**
 * local-ai-runtime — reine Validierung und Mandantenauflösung.
 * Die Edge Function selbst ist dünn; die Sicherheitsregeln liegen hier.
 */
import { describe, it, expect } from 'vitest';
import { validateRegisterBody, resolveTenant } from '../../supabase/functions/local-ai-runtime/validate';

const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';

const VALID = {
  action: 'register_profile',
  tenant_hint: T1,
  profile_name: 'Local Governance Runtime',
  role: 'governance',
  model: 'granite4.2:8b',
  test_result: {
    overall: 'success',
    model: 'granite4.2:8b',
    ranAt: '2026-09-28T10:00:00.000Z',
    checks: [
      { id: 'json_valid', status: 'success' },
      { id: 'no_fabricated_source', status: 'success' },
      { id: 'evil', status: 'success' },
    ],
  },
  enabled: true,
};

describe('validateRegisterBody', () => {
  it('accepts a passed profile and keeps enabled', () => {
    const r = validateRegisterBody(VALID);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.enabled).toBe(true);
      expect(r.value.tenantHint).toBe(T1);
      expect(r.value.checks.map((c) => c.id)).toEqual(['json_valid', 'no_fabricated_source']);
    }
  });

  it('forces enabled=false unless the test passed (fail-closed)', () => {
    const warn = validateRegisterBody({ ...VALID, test_result: { ...VALID.test_result, overall: 'warning' } });
    expect(warn.ok && warn.value.enabled).toBe(false);
    const none = validateRegisterBody({ ...VALID, test_result: null });
    expect(none.ok && none.value.enabled).toBe(false);
  });

  it('rejects a test result for a different model', () => {
    const r = validateRegisterBody({ ...VALID, test_result: { ...VALID.test_result, model: 'other' } });
    expect(r.ok).toBe(false);
  });

  it('never accepts a runtime URL or tenant_id field', () => {
    const r = validateRegisterBody({ ...VALID, runtime_url: 'http://192.168.1.5:11434', tenant_id: T2 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(JSON.stringify(r.value)).not.toContain('192.168');
      expect(r.value.tenantHint).toBe(T1);
    }
  });

  it('rejects bad input', () => {
    expect(validateRegisterBody(null).ok).toBe(false);
    expect(validateRegisterBody({ ...VALID, action: 'delete_all' }).ok).toBe(false);
    expect(validateRegisterBody({ ...VALID, role: 'root' }).ok).toBe(false);
    expect(validateRegisterBody({ ...VALID, model: 'bad model; drop' }).ok).toBe(false);
    expect(validateRegisterBody({ ...VALID, profile_name: '' }).ok).toBe(false);
    expect(validateRegisterBody({ ...VALID, tenant_hint: 'not-a-uuid' }).ok).toBe(false);
  });
});

describe('resolveTenant', () => {
  it('uses the single membership when no hint is given', () => {
    expect(resolveTenant([T1], null)).toEqual({ ok: true, tenantId: T1 });
  });

  it('accepts a hint only if the user is a member', () => {
    expect(resolveTenant([T1, T2], T2)).toEqual({ ok: true, tenantId: T2 });
    expect(resolveTenant([T1], T2)).toMatchObject({ ok: false, status: 403, code: 'FORBIDDEN' });
  });

  it('never guesses between several tenants', () => {
    expect(resolveTenant([T1, T2], null)).toMatchObject({ ok: false, code: 'MULTIPLE_TENANTS' });
    expect(resolveTenant([], null)).toMatchObject({ ok: false, code: 'NO_TENANT' });
  });
});

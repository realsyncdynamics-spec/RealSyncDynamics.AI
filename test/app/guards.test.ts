import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateGuard, GUARD_ROLE_ADMIN } from '../../src/app/guards';

const protectedSource = readFileSync('src/features/demo/ProtectedRoute.tsx', 'utf8');
const demoSource = readFileSync('src/core/demo/DemoModeProvider.tsx', 'utf8');

describe('Guard-Stapel', () => {
  const base = {
    authenticated: true,
    tenantId: 'fixture-lichtkante',
    role: 'owner' as const,
    plan: 'starter' as const,
  };

  function failureOf(decision: ReturnType<typeof evaluateGuard>) {
    return decision.ok ? null : decision.failure;
  }

  it('prüft Auth vor Mandant und Rolle', () => {
    expect(failureOf(evaluateGuard(GUARD_ROLE_ADMIN, { ...base, authenticated: false, tenantId: null }))).toBe('auth');
    expect(failureOf(evaluateGuard(GUARD_ROLE_ADMIN, { ...base, tenantId: null }))).toBe('tenant');
    expect(failureOf(evaluateGuard(GUARD_ROLE_ADMIN, { ...base, role: 'viewer_auditor' }))).toBe('role');
    expect(evaluateGuard(GUARD_ROLE_ADMIN, base).ok).toBe(true);
  });

  it('prüft den Plan erst nach Auth, Mandant und Rolle', () => {
    const guard = { steps: ['auth', 'tenant', 'role'] as const, roles: ['owner' as const], plans: ['growth' as const] };
    expect(failureOf(evaluateGuard(guard, { ...base, authenticated: false, plan: null }))).toBe('auth');
    expect(failureOf(evaluateGuard(guard, { ...base, plan: 'starter' }))).toBe('plan');
    expect(evaluateGuard(guard, { ...base, plan: 'growth' }).ok).toBe(true);
  });

  it('nimmt Demo-Modus nicht als Sitzung', () => {
    expect(protectedSource).toContain('useSupabaseAuth');
    expect(protectedSource).not.toContain('isDemoMode');
    expect(protectedSource).not.toContain('VITE_');
    expect(demoSource).not.toContain('isAuthenticated');
    expect(evaluateGuard.toString()).not.toContain('isDemoMode');
  });
});

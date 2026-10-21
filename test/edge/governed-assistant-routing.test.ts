import { describe, expect, it } from 'vitest';
import { routeGovernedAssistant } from '../../../supabase/functions/governed-assistant/policy';

const base = {
  runtimeVerified: true,
  tenantPolicy: 'user_choice',
  purpose: 'general',
  dataClass: 'unknown',
  selection: 'auto',
} as const;

describe('Governed assistant routing policy', () => {
  it('blocks all requests until the EU runtime is explicitly verified', () => {
    expect(routeGovernedAssistant({ ...base, runtimeVerified: false })).toMatchObject({
      allowed: false, code: 'RUNTIME_NOT_VERIFIED',
    });
  });

  it('blocks when a tenant cloud-only policy cannot be met safely', () => {
    expect(routeGovernedAssistant({ ...base, tenantPolicy: 'enforce_cloud' })).toMatchObject({
      allowed: false, code: 'TENANT_POLICY_CONFLICT',
    });
  });

  it('routes unclassified as well as sensitive requests to EU-private, never cloud', () => {
    for (const dataClass of ['unknown', 'public', 'internal', 'personal', 'special_category']) {
      const result = routeGovernedAssistant({ ...base, dataClass });
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.zone).toBe('eu_private');
        expect(['fast-local', 'quality-local']).toContain(result.profile);
      }
    }
  });

  it('chooses quality-local for sensitive or governance work', () => {
    expect(routeGovernedAssistant({ ...base, dataClass: 'special_category' })).toMatchObject({
      allowed: true, profile: 'quality-local',
    });
    expect(routeGovernedAssistant({ ...base, purpose: 'compliance' })).toMatchObject({
      allowed: true, profile: 'quality-local',
    });
    expect(routeGovernedAssistant({ ...base, selection: 'eu_precise' })).toMatchObject({
      allowed: true, profile: 'quality-local',
    });
  });

  it('never trusts arbitrary provider/profile overrides', () => {
    expect(routeGovernedAssistant({ ...base, selection: 'anthropic' })).toMatchObject({
      allowed: false, code: 'UNSUPPORTED_SELECTION',
    });
    expect(routeGovernedAssistant({ ...base, dataClass: 'not-classified' })).toMatchObject({
      allowed: false, code: 'UNSUPPORTED_SELECTION',
    });
  });
});

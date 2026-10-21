import { describe, expect, it } from 'vitest';
import { containsLikelyPersonalData, routeGovernedAssistant } from '../../../supabase/functions/governed-assistant/policy';

const base = {
  runtimeVerified: true,
  tenantPolicy: 'user_choice',
  purpose: 'general',
  dataClass: 'public',
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

  it('blocks unknown or missing tenant policy', () => {
    expect(routeGovernedAssistant({ ...base, tenantPolicy: '' })).toMatchObject({ allowed: false, code: 'TENANT_POLICY_CONFLICT' });
    expect(routeGovernedAssistant({ ...base, tenantPolicy: 'unrecognized' })).toMatchObject({ allowed: false, code: 'TENANT_POLICY_CONFLICT' });
  });

  it('denies unclassified and personal input until legal basis is established', () => {
    expect(routeGovernedAssistant({ ...base, dataClass: 'unknown' })).toMatchObject({
      allowed: false, code: 'DATA_CLASS_REVIEW_REQUIRED',
    });
    for (const dataClass of ['personal', 'special_category']) {
      expect(routeGovernedAssistant({ ...base, dataClass })).toMatchObject({
        allowed: false, code: 'LEGAL_BASIS_REQUIRED',
      });
    }
  });

  it('uses only EU-private routing for permitted public/internal content', () => {
    for (const dataClass of ['public', 'internal']) {
      const result = routeGovernedAssistant({ ...base, dataClass });
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.zone).toBe('eu_private');
        expect(['fast-local', 'quality-local']).toContain(result.profile);
      }
    }
  });

  it('rejects common personal identifiers regardless of declared class', () => {
    expect(containsLikelyPersonalData('Anfrage an max@example.com senden')).toBe(true);
    expect(containsLikelyPersonalData('EU AI Act Artikel 50')).toBe(false);
    expect(containsLikelyPersonalData('ein öffentliches Website-Audit')).toBe(false);
  });

  it('chooses quality-local for sensitive or governance work', () => {
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

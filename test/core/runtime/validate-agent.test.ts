import { describe, it, expect, beforeEach } from 'vitest';
import {
  SkillRegistry,
  validateAgent,
  type AgentDefinition,
  type SkillManifest,
} from '../../../src/core/runtime';

const auditCookieScan: SkillManifest = {
  id: 'audit.cookie_scan',
  version: 1,
  title: 'Cookie scan',
  description: 'Scans a URL for cookies and trackers.',
  capabilities: ['read:tenant.audit', 'network:external'],
  risk_level: 'low',
  auto_approve: true,
  pii_class: 'none',
  idempotent: true,
};

const shopifyConsentInject: SkillManifest = {
  id: 'shopify.consent_inject',
  version: 1,
  title: 'Inject consent banner',
  description: 'Installs a consent banner in a Shopify storefront.',
  capabilities: ['write:tenant.remediation', 'consent:write'],
  risk_level: 'medium',
  auto_approve: false,
  pii_class: 'none',
  idempotent: false,
};

function makeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'audit-agent',
    tenant_id: 'tenant-1',
    title: 'Audit agent',
    skill_ids: ['audit.cookie_scan'],
    granted_capabilities: ['read:tenant.audit', 'network:external'],
    ...overrides,
  };
}

let registry: SkillRegistry;

beforeEach(() => {
  registry = new SkillRegistry();
  registry.register(auditCookieScan);
  registry.register(shopifyConsentInject);
});

describe('validateAgent', () => {
  it('accepts a well-formed agent with exactly the required capabilities', () => {
    const result = validateAgent(makeAgent(), registry);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects unknown skill ids', () => {
    const result = validateAgent(
      makeAgent({ skill_ids: ['audit.cookie_scan', 'does.not.exist'] }),
      registry,
    );
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      code: 'unknown_skill',
      skill_id: 'does.not.exist',
    });
  });

  it('rejects duplicate skill ids', () => {
    const result = validateAgent(
      makeAgent({ skill_ids: ['audit.cookie_scan', 'audit.cookie_scan'] }),
      registry,
    );
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      code: 'duplicate_skill',
      skill_id: 'audit.cookie_scan',
    });
  });

  it('rejects when a required capability is missing from the grant', () => {
    const result = validateAgent(
      makeAgent({ granted_capabilities: ['read:tenant.audit'] }),
      registry,
    );
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      code: 'missing_capability',
      skill_id: 'audit.cookie_scan',
      capability: 'network:external',
    });
  });

  it('rejects capability surplus by default (least privilege)', () => {
    const result = validateAgent(
      makeAgent({
        granted_capabilities: [
          'read:tenant.audit',
          'network:external',
          'write:tenant.remediation',
        ],
      }),
      registry,
    );
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      code: 'capability_surplus',
      extra: ['write:tenant.remediation'],
    });
  });

  it('allows capability surplus when the agent opts in', () => {
    const result = validateAgent(
      makeAgent({
        allow_capability_surplus: true,
        granted_capabilities: [
          'read:tenant.audit',
          'network:external',
          'write:tenant.remediation',
        ],
      }),
      registry,
    );
    expect(result.valid).toBe(true);
  });

  it('validates a multi-skill agent', () => {
    const result = validateAgent(
      makeAgent({
        id: 'shopify-agent',
        skill_ids: ['audit.cookie_scan', 'shopify.consent_inject'],
        granted_capabilities: [
          'read:tenant.audit',
          'network:external',
          'write:tenant.remediation',
          'consent:write',
        ],
      }),
      registry,
    );
    expect(result.valid).toBe(true);
  });

  it('flags missing required fields', () => {
    const result = validateAgent(
      makeAgent({ id: '', tenant_id: '', title: '' }),
      registry,
    );
    expect(result.valid).toBe(false);
    const missing = result.issues.filter((i) => i.code === 'missing_field');
    expect(missing).toHaveLength(3);
  });

  it('rejects ids with invalid characters', () => {
    const result = validateAgent(makeAgent({ id: 'Invalid ID!' }), registry);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ code: 'invalid_id' });
  });
});

describe('SkillRegistry', () => {
  it('rejects double registration', () => {
    const reg = new SkillRegistry();
    reg.register(auditCookieScan);
    expect(() => reg.register(auditCookieScan)).toThrow(/already registered/);
  });

  it('rejects auto_approve on a writing skill', () => {
    const reg = new SkillRegistry();
    expect(() =>
      reg.register({
        ...shopifyConsentInject,
        auto_approve: true,
      }),
    ).toThrow(/auto_approve/);
  });

  it('rejects auto_approve when risk_level is not low', () => {
    const reg = new SkillRegistry();
    expect(() =>
      reg.register({
        ...auditCookieScan,
        id: 'audit.medium_risk',
        risk_level: 'medium',
        auto_approve: true,
      }),
    ).toThrow(/risk_level/);
  });

  it('treats auto_approve as opt-in (truthy, non-true values are NOT auto-approved)', () => {
    const reg = new SkillRegistry();
    // Simulates an externally loaded manifest with auto_approve omitted /
    // truthy-but-not-true. Must not bypass write/PII guards.
    const externalManifest = {
      ...shopifyConsentInject,
      id: 'shopify.from_external',
      auto_approve: undefined as unknown as boolean,
    };
    expect(() => reg.register(externalManifest)).not.toThrow();
  });

  it('rejects malformed skill ids', () => {
    const reg = new SkillRegistry();
    expect(() =>
      reg.register({ ...auditCookieScan, id: 'NoNamespace' }),
    ).toThrow(/dot-namespaced/);
  });
});

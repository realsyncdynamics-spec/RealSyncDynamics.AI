import { describe, it, expect } from 'vitest';
import {
  validateEvent,
  validateAgentContract,
  validateAgentContractFull,
  validateRuntimeContext,
  validateEvidenceChainLink,
  validateCapability,
  validatePolicy,
  validateEvidenceCoupling,
  validateEscalationMatrix,
  validateOutputConstraints,
  consistencyCheckAgentContract,
  REGISTERED_SCHEMAS,
} from '../../src/runtime/validator';

// ── helpers ────────────────────────────────────────────────────────

function minimalEvent(overrides: Record<string, unknown> = {}) {
  return {
    spec_version: '1.0',
    id:           'evt_01HXYZ8K9M2NQ5P3R7T6V8WJYC',
    subject:      'invoice.received',
    category:     'finance',
    severity:     'medium',
    occurred_at:  '2026-05-15T11:23:04Z',
    source:       { agent: 'detection-agent', runtime: 'realsync-runtime-core', spec_version: '1.0' },
    tenant:       { tenant_id: 'ac1d8c4f-3a4f-4e3a-9b1a-3f4c5b6a7d8e', region: 'eu-central-1' },
    correlation:  { trace_id: 'trace_01HXYZ8K9M2NQ5P3R7T6V8WJYC' },
    payload:      { hello: 'world' },
    compliance:   { gdpr: true, ai_act: false, retention_years: 10 },
    evidence:     { required: true, immutable: true },
    ...overrides,
  };
}

function minimalContract(overrides: Record<string, unknown> = {}) {
  return {
    spec_version: '1.1',
    agent: {
      name:        'test-agent',
      type:        'custom',
      version:     '1.0.0',
      description: 'A minimal contract for tests.',
      owner:       'realsync-platform',
    },
    permissions: ['tenant.read'],
    accepts: [{ subject: 'tracker.detected' }],
    returns: [{ subject: 'fix.snippet.generated' }],
    runtime_context: { required: ['tenant.tenant_id'] },
    compliance: { ai_act_role: 'minimal_risk', decides: false },
    ...overrides,
  };
}

// ── 1. Schema registry sanity ──────────────────────────────────────

describe('REGISTERED_SCHEMAS', () => {
  it('exposes all nine schemas with correct $ids', () => {
    expect(REGISTERED_SCHEMAS.event.$id).toMatch(/event\.schema\.json$/);
    expect(REGISTERED_SCHEMAS.agentContract.$id).toMatch(/agent-contract\.schema\.json$/);
    expect(REGISTERED_SCHEMAS.runtimeContext.$id).toMatch(/runtime-context\.schema\.json$/);
    expect(REGISTERED_SCHEMAS.evidenceChain.$id).toMatch(/evidence-chain\.schema\.json$/);
    expect(REGISTERED_SCHEMAS.capability.$id).toMatch(/capability\.schema\.json$/);
    expect(REGISTERED_SCHEMAS.policy.$id).toMatch(/policy\.schema\.json$/);
    expect(REGISTERED_SCHEMAS.evidenceCoupling.$id).toMatch(/evidence-coupling\.schema\.json$/);
    expect(REGISTERED_SCHEMAS.escalationMatrix.$id).toMatch(/escalation-matrix\.schema\.json$/);
    expect(REGISTERED_SCHEMAS.outputConstraints.$id).toMatch(/output-constraints\.schema\.json$/);
  });
});

// ── 2. ESS event validation ────────────────────────────────────────

describe('validateEvent (ESS)', () => {
  it('accepts a minimal conformant event', () => {
    expect(validateEvent(minimalEvent()).valid).toBe(true);
  });

  it('rejects an event missing spec_version', () => {
    const e = minimalEvent();
    delete (e as Record<string, unknown>).spec_version;
    const r = validateEvent(e);
    expect(r.valid).toBe(false);
    expect(r.errors.some(x => x.keyword === 'required' && (x.params as { missingProperty: string }).missingProperty === 'spec_version')).toBe(true);
  });

  it('rejects an event with severity outside the enum', () => {
    const r = validateEvent(minimalEvent({ severity: 'urgent' }));
    expect(r.valid).toBe(false);
    expect(r.errors.some(x => x.keyword === 'enum' && x.path.includes('severity'))).toBe(true);
  });

  it('rejects a non-platform.* event missing the tenant block', () => {
    const e = minimalEvent();
    delete (e as Record<string, unknown>).tenant;
    const r = validateEvent(e);
    expect(r.valid).toBe(false);
  });

  it('accepts a platform.* event WITHOUT the tenant block', () => {
    const e = minimalEvent({ subject: 'platform.deploy.completed', category: 'platform' });
    delete (e as Record<string, unknown>).tenant;
    expect(validateEvent(e).valid).toBe(true);
  });
});

// ── 3. ACS agent contract — schema-level ──────────────────────────

describe('validateAgentContract (ACS shape)', () => {
  it('accepts a minimal v1.0 contract', () => {
    expect(validateAgentContract(minimalContract({ spec_version: '1.0' })).valid).toBe(true);
  });

  it('accepts a v1.1 contract WITH the three optional blocks', () => {
    const c = minimalContract({
      evidence_coupling: { mode: 'linked', linked_subject: 'tracker.detected' },
      escalation_matrix: { sev_high: { human_review_required: true } },
      output_constraints: { format: 'strict_json', schema_validation: 'required' },
      returns: [
        { subject: 'fix.snippet.generated', requires_human_review: true },
      ],
    });
    expect(validateAgentContract(c).valid).toBe(true);
  });

  it('rejects a contract with an unknown permission', () => {
    const r = validateAgentContract(minimalContract({ permissions: ['bogus.permission'] }));
    expect(r.valid).toBe(false);
  });

  it('rejects a contract with an unknown agent.type', () => {
    const c = minimalContract();
    (c.agent as Record<string, unknown>).type = 'rocket-science';
    expect(validateAgentContract(c).valid).toBe(false);
  });

  it('rejects an output_constraints.format outside the enum', () => {
    const c = minimalContract({ output_constraints: { format: 'yaml' } });
    expect(validateAgentContract(c).valid).toBe(false);
  });
});

// ── 4. Cross-block consistency (ACS §9b, CPS §9c) ─────────────────

describe('consistencyCheckAgentContract (v1.1 cross-block rules)', () => {
  it('mode=mandatory without evidence.create + chain.append → errors', () => {
    const errs = consistencyCheckAgentContract(minimalContract({
      permissions: ['tenant.read'],
      evidence_coupling: { mode: 'mandatory', hash_required: true, ledger_required: true },
    }));
    expect(errs.length).toBeGreaterThanOrEqual(2);
    expect(errs.some(e => e.message.includes("'evidence.create'"))).toBe(true);
    expect(errs.some(e => e.message.includes("'chain.append'"))).toBe(true);
  });

  it('mode=mandatory WITH both permissions → no consistency errors', () => {
    const errs = consistencyCheckAgentContract(minimalContract({
      permissions: ['tenant.read', 'evidence.create', 'chain.append'],
      evidence_coupling: { mode: 'mandatory', hash_required: true, ledger_required: true },
    }));
    expect(errs).toHaveLength(0);
  });

  it('mode=forbidden + evidence.create in permissions → error', () => {
    const errs = consistencyCheckAgentContract(minimalContract({
      permissions: ['tenant.read', 'evidence.create'],
      evidence_coupling: { mode: 'forbidden' },
    }));
    expect(errs.some(e => e.message.includes("mode='forbidden'"))).toBe(true);
  });

  it('escalation_matrix human_review_required without returns[].requires_human_review → error', () => {
    const errs = consistencyCheckAgentContract(minimalContract({
      escalation_matrix: { sev_high: { human_review_required: true } },
      returns: [{ subject: 'fix.snippet.generated' /* no requires_human_review */ }],
    }));
    expect(errs.some(e => e.path === '/escalation_matrix')).toBe(true);
  });

  it('template_locked=true without tenant.read permission → error', () => {
    const errs = consistencyCheckAgentContract(minimalContract({
      permissions: [], // no tenant.read
      output_constraints: { format: 'markdown', template_locked: true },
    }));
    expect(errs.some(e => e.message.includes("'tenant.read'"))).toBe(true);
  });

  it('confidence_score=mandatory with format=markdown → error', () => {
    const errs = consistencyCheckAgentContract(minimalContract({
      output_constraints: { format: 'markdown', confidence_score: 'mandatory' },
    }));
    expect(errs.some(e => e.message.includes('strict_json'))).toBe(true);
  });

  it('pii_access=full requires decides=false + HRP-returns', () => {
    const errs = consistencyCheckAgentContract(minimalContract({
      compliance: { ai_act_role: 'high_risk', decides: true },
      capability: { trust_level: 'execute_with_review', permissions: ['tenant.read'], restrictions: [], isolation: { network: 'none', fs_writes: 'none', secret_scope: [], pii_access: 'full' } },
      returns: [{ subject: 'fix.snippet.generated' }],
    }));
    expect(errs.length).toBeGreaterThanOrEqual(2);
    expect(errs.some(e => e.message.includes('compliance.decides=false'))).toBe(true);
    expect(errs.some(e => e.message.includes('requires_human_review=true'))).toBe(true);
  });

  it('cross_tenant_visibility=full demands trust_level observe_only|annotate AND realsync-platform owner', () => {
    const errs = consistencyCheckAgentContract(minimalContract({
      agent: { name: 'x', type: 'custom', version: '1.0.0', description: 'd', owner: 'tenant-installed' },
      capability: { trust_level: 'prepare', permissions: ['tenant.read'], restrictions: [], isolation: { network: 'none', fs_writes: 'none', secret_scope: [], cross_tenant_visibility: 'full' } },
    }));
    expect(errs.some(e => e.message.includes("trust_level='observe_only'"))).toBe(true);
    expect(errs.some(e => e.message.includes("agent.owner='realsync-platform'"))).toBe(true);
  });
});

// ── 5. validateAgentContractFull (composite) ──────────────────────

describe('validateAgentContractFull', () => {
  it('returns valid=true only when shape AND consistency both pass', () => {
    const goodEvc = minimalContract({
      permissions: ['tenant.read', 'evidence.create', 'chain.append'],
      evidence_coupling: { mode: 'mandatory', hash_required: true, ledger_required: true },
    });
    expect(validateAgentContractFull(goodEvc).valid).toBe(true);
  });

  it('returns valid=false when shape passes but consistency fails', () => {
    const r = validateAgentContractFull(minimalContract({
      permissions: ['tenant.read'],
      evidence_coupling: { mode: 'mandatory', hash_required: true, ledger_required: true },
    }));
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

// ── 6. RCS envelope ────────────────────────────────────────────────

describe('validateRuntimeContext', () => {
  const envelope = {
    spec_version: '1.0',
    tenant: { tenant_id: 't', slug: 'acme', region: 'eu-central-1', plan: 'pro', status: 'active' },
    governance: { gdpr_mode: 'strict', ai_act_profile: 'annex_iii', dpo_present: true, retention_default_years: 10 },
    correlation: { trace_id: 'trace_01HXYZ8K9M2NQ5P3R7T6V8WJYC', request_id: 'req_01HXYZ8K9M2NQ5P3R7T6V8WJYC' },
    issued_at:  '2026-05-15T11:23:04Z',
    expires_at: '2026-05-15T11:33:04Z',
  };

  it('accepts a minimal envelope', () => {
    expect(validateRuntimeContext(envelope).valid).toBe(true);
  });

  it('rejects an envelope with unknown gdpr_mode', () => {
    expect(validateRuntimeContext({ ...envelope, governance: { ...envelope.governance, gdpr_mode: 'whatever' } }).valid).toBe(false);
  });
});

// ── 7. ECS chain link ──────────────────────────────────────────────

describe('validateEvidenceChainLink', () => {
  it('seq=1 with empty previous_hash is valid', () => {
    const link = {
      seq: 1,
      tenant_id: 't',
      event_id: 'evt_01HXYZ8K9M2NQ5P3R7T6V8WJYC',
      event_type: 'invoice.received',
      source: { agent: 'detection-agent', runtime: 'realsync-runtime-core' },
      previous_hash: '',
      current_hash:  'sha256:' + 'a'.repeat(64),
      sealed_at: '2026-05-15T11:23:05Z',
      payload: { ok: true },
    };
    expect(validateEvidenceChainLink(link).valid).toBe(true);
  });

  it('seq>=2 with empty previous_hash is rejected', () => {
    const link = {
      seq: 5,
      tenant_id: 't',
      event_id: 'evt_01HXYZ8K9M2NQ5P3R7T6V8WJYC',
      event_type: 'invoice.received',
      source: { agent: 'detection-agent', runtime: 'realsync-runtime-core' },
      previous_hash: '',                              // bad — only legal at seq=1
      current_hash:  'sha256:' + 'b'.repeat(64),
      sealed_at: '2026-05-15T11:23:05Z',
      payload: {},
    };
    expect(validateEvidenceChainLink(link).valid).toBe(false);
  });
});

// ── 8. Smaller schemas (smoke) ─────────────────────────────────────

describe('leaf v1.1 schemas (smoke)', () => {
  it('evidence-coupling.mode mandatory enum is enforced', () => {
    expect(validateEvidenceCoupling({ mode: 'mandatory', hash_required: true }).valid).toBe(true);
    expect(validateEvidenceCoupling({ mode: 'whatever' }).valid).toBe(false);
  });

  it('escalation-matrix accepts only the known tier keys', () => {
    expect(validateEscalationMatrix({ sev_high: { human_review_required: true } }).valid).toBe(true);
    expect(validateEscalationMatrix({ unknown_tier: { auto_continue: true } }).valid).toBe(false);
  });

  it('output-constraints.format is enum-locked', () => {
    expect(validateOutputConstraints({ format: 'strict_json' }).valid).toBe(true);
    expect(validateOutputConstraints({ format: 'yaml' }).valid).toBe(false);
  });
});

// ── 9. CPS capability standalone ──────────────────────────────────

describe('validateCapability', () => {
  it('accepts a minimal block with required isolation fields', () => {
    expect(validateCapability({
      trust_level: 'observe_only',
      permissions: [],
      restrictions: [],
      isolation: { network: 'none', fs_writes: 'none', secret_scope: [] },
    }).valid).toBe(true);
  });

  it('requires egress_hosts when network=egress_allowlist', () => {
    expect(validateCapability({
      trust_level: 'prepare',
      permissions: [],
      restrictions: [],
      isolation: { network: 'egress_allowlist', fs_writes: 'none', secret_scope: [] },
      // no egress_hosts
    }).valid).toBe(false);
  });
});

// ── 10. Policy ─────────────────────────────────────────────────────

describe('validatePolicy', () => {
  it('accepts a minimal guard policy', () => {
    expect(validatePolicy({
      spec_version: '1.0',
      policy: {
        id: 'finance_export_policy',
        name: 'EU finance exports require owner review',
        version: 1,
        type: 'guard',
        tenant_id: 'tenant_123',
        status: 'active',
        effective_from: '2026-01-01T00:00:00Z',
        domain: 'finance',
      },
      conditions: [{ subject_matches: 'finance.export.*' }],
      actions: ['prepare_export', 'require_human_review'],
    }).valid).toBe(true);
  });

  it('rejects a policy with empty actions', () => {
    expect(validatePolicy({
      spec_version: '1.0',
      policy: {
        id: 'x', name: 'x', version: 1, type: 'guard',
        tenant_id: 't', status: 'active',
        effective_from: '2026-01-01T00:00:00Z', domain: 'finance',
      },
      conditions: [{ subject_matches: 'finance.*' }],
      actions: [],
    }).valid).toBe(false);
  });
});

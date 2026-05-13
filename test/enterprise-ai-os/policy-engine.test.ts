import { describe, it, expect } from 'vitest';
import { evaluateAgentAction } from '../../src/lib/enterprise-ai-os/policy-engine';
import type { AgentPolicy } from '../../src/lib/enterprise-ai-os/types';

const basePolicy: Pick<
  AgentPolicy,
  'allowed_models' | 'forbidden_data_categories' | 'requires_human_approval' | 'external_actions_allowed'
> = {
  allowed_models: ['gpt-4.1', 'claude-3.5-sonnet'],
  forbidden_data_categories: ['payroll_data', 'health_data'],
  requires_human_approval: false,
  external_actions_allowed: false,
};

describe('policy-engine.evaluateAgentAction', () => {
  it('allows a baseline model with no special data', () => {
    const result = evaluateAgentAction({
      model: 'gpt-4.1',
      dataCategories: [],
      externalAction: false,
      riskLevel: 'limited',
      policy: basePolicy,
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
    expect(result.auditRequired).toBe(false);
  });

  it('blocks an unlisted model', () => {
    const result = evaluateAgentAction({
      model: 'gemini-2.0',
      dataCategories: [],
      externalAction: false,
      riskLevel: 'limited',
      policy: basePolicy,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toContain('not allowed');
  });

  it('blocks forbidden data categories', () => {
    const result = evaluateAgentAction({
      model: 'gpt-4.1',
      dataCategories: ['payroll_data'],
      externalAction: false,
      riskLevel: 'limited',
      policy: basePolicy,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toContain('Forbidden data categories');
  });

  it('blocks external actions unless policy permits', () => {
    const result = evaluateAgentAction({
      model: 'gpt-4.1',
      dataCategories: [],
      externalAction: true,
      riskLevel: 'limited',
      policy: basePolicy,
    });
    expect(result.allowed).toBe(false);
  });

  it('flags personal data as audit-required', () => {
    const result = evaluateAgentAction({
      model: 'gpt-4.1',
      dataCategories: ['customer_data'],
      externalAction: false,
      riskLevel: 'limited',
      policy: basePolicy,
    });
    expect(result.allowed).toBe(true);
    expect(result.auditRequired).toBe(true);
  });

  it('blocks sensitive_data + requires audit', () => {
    const result = evaluateAgentAction({
      model: 'gpt-4.1',
      dataCategories: ['sensitive_data'],
      externalAction: false,
      riskLevel: 'limited',
      policy: basePolicy,
    });
    expect(result.allowed).toBe(false);
    expect(result.auditRequired).toBe(true);
  });

  it('requires approval when policy demands it', () => {
    const result = evaluateAgentAction({
      model: 'gpt-4.1',
      dataCategories: [],
      externalAction: false,
      riskLevel: 'limited',
      policy: { ...basePolicy, requires_human_approval: true },
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it('high risk + external action with policy-allowed external requires approval', () => {
    const result = evaluateAgentAction({
      model: 'gpt-4.1',
      dataCategories: [],
      externalAction: true,
      riskLevel: 'high',
      policy: { ...basePolicy, external_actions_allowed: true },
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });
});

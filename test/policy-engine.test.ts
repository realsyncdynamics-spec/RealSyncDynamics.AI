import { describe, it, expect } from 'vitest';
import {
  evaluatePolicies,
  matchPolicy,
  type PolicyRule,
  type RuntimeEventInput,
} from '../supabase/functions/_shared/policy-engine';

// ─── Test-Helpers ────────────────────────────────────────────────────────────

function event(overrides: Partial<RuntimeEventInput> = {}): RuntimeEventInput {
  return {
    event_type: 'prompt_sent',
    vendor: 'openai',
    model: 'gpt-4.1',
    data_class: 'internal',
    risk_level: 'low',
    prompt_category: 'unknown',
    ...overrides,
  };
}

function policy(overrides: Partial<PolicyRule> = {}): PolicyRule {
  return {
    id: 'test-policy',
    name: 'Test Policy',
    rule_type: 'data_transfer',
    action: 'warn',
    enabled: true,
    condition: {},
    ...overrides,
  };
}

// ─── matchPolicy ─────────────────────────────────────────────────────────────

describe('matchPolicy', () => {
  it('returns false for disabled policies', () => {
    const p = policy({ enabled: false });
    expect(matchPolicy(event(), p)).toBe(false);
  });

  describe('rule_type: data_transfer', () => {
    it('matches when data_class is in list', () => {
      const p = policy({
        rule_type: 'data_transfer',
        condition: { data_classes: ['personal_data', 'special_category'] },
      });
      expect(matchPolicy(event({ data_class: 'personal_data' }), p)).toBe(true);
      expect(matchPolicy(event({ data_class: 'public' }), p)).toBe(false);
    });

    it('matches only external vendors when to_external_vendor=true', () => {
      const p = policy({
        rule_type: 'data_transfer',
        condition: { data_classes: ['personal_data'], to_external_vendor: true },
      });
      // External vendor + matching data_class -> match
      expect(
        matchPolicy(event({ vendor: 'openai', data_class: 'personal_data' }), p),
      ).toBe(true);
      // Internal vendor + matching data_class -> NO match (rule only covers external)
      expect(
        matchPolicy(event({ vendor: 'microsoft', data_class: 'personal_data' }), p),
      ).toBe(false);
    });

    it('matches only internal vendors when to_external_vendor=false', () => {
      const p = policy({
        rule_type: 'data_transfer',
        condition: { to_external_vendor: false },
      });
      expect(matchPolicy(event({ vendor: 'microsoft' }), p)).toBe(true);
      expect(matchPolicy(event({ vendor: 'openai' }), p)).toBe(false);
    });
  });

  describe('rule_type: human_review', () => {
    it('matches risk_levels list', () => {
      const p = policy({
        rule_type: 'human_review',
        action: 'require_approval',
        condition: { risk_levels: ['high', 'critical'] },
      });
      expect(matchPolicy(event({ risk_level: 'high' }), p)).toBe(true);
      expect(matchPolicy(event({ risk_level: 'medium' }), p)).toBe(false);
    });

    it('combines risk_levels and prompt_categories AND-style', () => {
      const p = policy({
        rule_type: 'human_review',
        condition: {
          risk_levels: ['high'],
          prompt_categories: ['classification'],
        },
      });
      expect(
        matchPolicy(
          event({ risk_level: 'high', prompt_category: 'classification' }),
          p,
        ),
      ).toBe(true);
      // Right risk, wrong category -> no match
      expect(
        matchPolicy(event({ risk_level: 'high', prompt_category: 'qa' }), p),
      ).toBe(false);
    });
  });

  describe('rule_type: logging_required', () => {
    it('matches when event_type is in list', () => {
      const p = policy({
        rule_type: 'logging_required',
        condition: { event_types: ['agent_action', 'tool_call'] },
      });
      expect(matchPolicy(event({ event_type: 'agent_action' }), p)).toBe(true);
      expect(matchPolicy(event({ event_type: 'prompt_sent' }), p)).toBe(false);
    });

    it('matches all events when condition is empty (no filter)', () => {
      const p = policy({ rule_type: 'logging_required', condition: {} });
      expect(matchPolicy(event(), p)).toBe(true);
    });
  });

  describe('rule_type: vendor_restriction', () => {
    it('matches blocked_vendors list', () => {
      const p = policy({
        rule_type: 'vendor_restriction',
        action: 'block',
        condition: { blocked_vendors: ['perplexity'] },
      });
      expect(matchPolicy(event({ vendor: 'perplexity' }), p)).toBe(true);
      expect(matchPolicy(event({ vendor: 'openai' }), p)).toBe(false);
    });

    it('matches anything NOT in allowed_vendors list', () => {
      const p = policy({
        rule_type: 'vendor_restriction',
        action: 'block',
        condition: { allowed_vendors: ['microsoft'] },
      });
      // microsoft is allowed -> no match (no violation)
      expect(matchPolicy(event({ vendor: 'microsoft' }), p)).toBe(false);
      // openai is not allowed -> match (violation)
      expect(matchPolicy(event({ vendor: 'openai' }), p)).toBe(true);
    });
  });
});

// ─── evaluatePolicies ────────────────────────────────────────────────────────

describe('evaluatePolicies', () => {
  it('returns logged when no policy matches', () => {
    const verdict = evaluatePolicies(event(), []);
    expect(verdict.status).toBe('logged');
    expect(verdict.matched_policy_ids).toEqual([]);
  });

  it('returns block when one block-action policy matches', () => {
    const blockPolicy = policy({
      id: 'p1',
      action: 'block',
      rule_type: 'data_transfer',
      condition: { data_classes: ['personal_data'], to_external_vendor: true },
    });
    const verdict = evaluatePolicies(
      event({ data_class: 'personal_data', vendor: 'openai' }),
      [blockPolicy],
    );
    expect(verdict.status).toBe('blocked');
    expect(verdict.matched_policy_id).toBe('p1');
  });

  it('picks the strictest action when multiple policies match', () => {
    const warnP = policy({ id: 'warn-p', action: 'warn', condition: {} });
    const approvalP = policy({
      id: 'approval-p',
      rule_type: 'human_review',
      action: 'require_approval',
      condition: {},
    });
    const blockP = policy({
      id: 'block-p',
      rule_type: 'vendor_restriction',
      action: 'block',
      condition: { blocked_vendors: ['openai'] },
    });
    const verdict = evaluatePolicies(event({ vendor: 'openai' }), [
      warnP,
      approvalP,
      blockP,
    ]);
    expect(verdict.status).toBe('blocked');
    expect(verdict.matched_policy_id).toBe('block-p');
    // alle drei haben gematched
    expect(verdict.matched_policy_ids).toHaveLength(3);
  });

  it('ignores disabled policies', () => {
    const disabled = policy({
      id: 'disabled',
      action: 'block',
      enabled: false,
      rule_type: 'vendor_restriction',
      condition: { blocked_vendors: ['openai'] },
    });
    const verdict = evaluatePolicies(event({ vendor: 'openai' }), [disabled]);
    expect(verdict.status).toBe('logged');
  });

  it('handles realistic enterprise scenario: PII to external -> block', () => {
    const policies: PolicyRule[] = [
      policy({
        id: 'no-pii-external',
        name: 'Keine personenbezogenen Daten an externe LLMs',
        rule_type: 'data_transfer',
        action: 'block',
        condition: {
          data_classes: ['personal_data', 'special_category'],
          to_external_vendor: true,
        },
      }),
      policy({
        id: 'high-risk-approval',
        name: 'Human-Review fuer high-risk',
        rule_type: 'human_review',
        action: 'require_approval',
        condition: { risk_levels: ['high', 'critical'] },
      }),
      policy({
        id: 'log-agents',
        name: 'Audit-Log fuer Agent-Actions',
        rule_type: 'logging_required',
        action: 'warn',
        condition: { event_types: ['agent_action', 'tool_call'] },
      }),
    ];

    // Szenario: HR-Agent sendet Bewerber-Daten an OpenAI -> sollte geblockt werden
    const piiToExternal = event({
      data_class: 'personal_data',
      vendor: 'openai',
      risk_level: 'high',
      event_type: 'prompt_sent',
    });
    const v1 = evaluatePolicies(piiToExternal, policies);
    expect(v1.status).toBe('blocked');
    expect(v1.matched_policy_id).toBe('no-pii-external');
    // Auch human_review matched (risk_level=high), aber block ist schaerfer
    expect(v1.matched_policy_ids).toContain('high-risk-approval');

    // Szenario: Agent-Tool-Call mit internen Daten -> warn
    const agentInternal = event({
      event_type: 'agent_action',
      data_class: 'internal',
      vendor: 'microsoft',
      risk_level: 'low',
    });
    const v2 = evaluatePolicies(agentInternal, policies);
    expect(v2.status).toBe('warned');
    expect(v2.matched_policy_id).toBe('log-agents');

    // Szenario: Routine-Code-Generation -> logged
    const routine = event({
      event_type: 'prompt_sent',
      data_class: 'internal',
      vendor: 'openai',
      risk_level: 'low',
      prompt_category: 'code_generation',
    });
    const v3 = evaluatePolicies(routine, policies);
    expect(v3.status).toBe('logged');
  });
});

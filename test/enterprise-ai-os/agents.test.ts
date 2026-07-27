import { describe, it, expect } from 'vitest';
import { enterpriseAgents, getEnterpriseAgent } from '../../src/lib/enterprise-ai-os/agents/registry';
import { createEnterpriseAgent } from '../../src/lib/enterprise-ai-os/agents/factory';

describe('Enterprise AI OS · Agent Registry', () => {
  it('contains all 8 agents', () => {
    expect(enterpriseAgents).toHaveLength(8);
  });

  it('every agent has a Position with a layer + order + systemBoundary', () => {
    for (const agent of enterpriseAgents) {
      expect(agent.position.layer).toBeTruthy();
      expect(typeof agent.position.order).toBe('number');
      expect(agent.position.systemBoundary.length).toBeGreaterThan(0);
    }
  });

  it('every agent declares at least one forbiddenAction', () => {
    for (const agent of enterpriseAgents) {
      expect(agent.forbiddenActions.length).toBeGreaterThan(0);
    }
  });

  it('getEnterpriseAgent returns the right definition', () => {
    expect(getEnterpriseAgent('audit-agent')?.shortName).toBe('Audit');
    expect(getEnterpriseAgent('does-not-exist')).toBeUndefined();
  });
});

describe('Enterprise AI OS · Discovery Agent', () => {
  it('detects ChatGPT / Claude / Copilot signals', async () => {
    const agent = createEnterpriseAgent('ai-discovery-agent');
    const result = await agent.run({
      agentId: 'ai-discovery-agent',
      actor: 'test',
      payload: {
        sources: [
          'employee uses ChatGPT every day',
          'random tooling line',
          'CRM integrates with Claude',
          'GitHub Copilot helps developers',
        ],
      },
    });
    expect(result.status).toBe('success');
    expect(result.findings.length).toBe(3);
    expect(result.metadata.detected).toEqual(
      expect.arrayContaining([
        'employee uses ChatGPT every day',
        'CRM integrates with Claude',
        'GitHub Copilot helps developers',
      ]),
    );
  });
});

describe('Enterprise AI OS · Risk Classification Agent', () => {
  it('classifies health_data as high risk', async () => {
    const agent = createEnterpriseAgent('risk-classification-agent');
    const result = await agent.run({
      agentId: 'risk-classification-agent',
      payload: { dataCategories: ['health_data'], usageContext: 'patient triage' },
    });
    expect(result.status).toBe('requires_approval');
    expect(result.metadata.riskLevel).toBe('high');
    expect(result.metadata.requiresApproval).toBe(true);
  });

  it('classifies social_scoring usage as prohibited', async () => {
    const agent = createEnterpriseAgent('risk-classification-agent');
    const result = await agent.run({
      agentId: 'risk-classification-agent',
      payload: { usageContext: 'used for social scoring of citizens' },
    });
    expect(result.metadata.riskLevel).toBe('prohibited');
  });
});

describe('Enterprise AI OS · Policy Enforcement Agent', () => {
  it('blocks sensitive_data with external action', async () => {
    const agent = createEnterpriseAgent('policy-enforcement-agent');
    const result = await agent.run({
      agentId: 'policy-enforcement-agent',
      payload: {
        model: 'gpt-4.1',
        dataCategories: ['sensitive_data'],
        externalAction: true,
        riskLevel: 'high',
        policy: {
          allowed_models: ['gpt-4.1'],
          forbidden_data_categories: [],
          requires_human_approval: false,
          external_actions_allowed: false,
        },
      },
    });
    expect(result.status).toBe('blocked');
  });

  it('allows a clean action', async () => {
    const agent = createEnterpriseAgent('policy-enforcement-agent');
    const result = await agent.run({
      agentId: 'policy-enforcement-agent',
      payload: {
        model: 'gpt-4.1',
        dataCategories: [],
        externalAction: false,
        riskLevel: 'limited',
        policy: {
          allowed_models: ['gpt-4.1'],
          forbidden_data_categories: [],
          requires_human_approval: false,
          external_actions_allowed: false,
        },
      },
    });
    expect(result.status).toBe('success');
  });
});

describe('Enterprise AI OS · Remediation Agent', () => {
  it('always requires human approval', async () => {
    const agent = createEnterpriseAgent('remediation-agent');
    const result = await agent.run({
      agentId: 'remediation-agent',
      payload: { riskLevel: 'high', issue: 'Unapproved Copilot use detected.' },
    });
    expect(result.status).toBe('requires_approval');
    expect(result.recommendations.every((r) => r.requiresHumanApproval)).toBe(true);
  });
});

describe('Enterprise AI OS · Workflow Agent', () => {
  it('creates task drafts but never executes', async () => {
    const agent = createEnterpriseAgent('workflow-agent');
    const result = await agent.run({
      agentId: 'workflow-agent',
      payload: { steps: ['Schritt A', 'Schritt B'] },
    });
    expect(result.status).toBe('requires_approval');
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations.every((r) => r.requiresHumanApproval)).toBe(true);
  });
});

describe('Enterprise AI OS · Audit Agent', () => {
  it('prepares an audit event without writing anywhere', async () => {
    const agent = createEnterpriseAgent('audit-agent');
    const result = await agent.run({
      agentId: 'audit-agent',
      payload: {
        action: 'policy_blocked',
        systemName: 'Microsoft Copilot',
        riskLevel: 'high',
        metadata: { reason: 'Sensitive data' },
      },
    });
    expect(result.status).toBe('success');
    expect(result.auditEvents).toHaveLength(1);
    expect(result.auditEvents[0].action).toBe('policy_blocked');
  });
});

describe('Enterprise AI OS · Feedback Intelligence Agent', () => {
  it('summarises bug + feature_request + critical counts', async () => {
    const agent = createEnterpriseAgent('feedback-intelligence-agent');
    const result = await agent.run({
      agentId: 'feedback-intelligence-agent',
      payload: {
        reports: [
          { type: 'bug', severity: 'critical' },
          { type: 'bug', severity: 'medium' },
          { type: 'feature_request', severity: 'low' },
        ],
      },
    });
    expect(result.status).toBe('requires_approval');
    expect(result.metadata.bugCount).toBe(2);
    expect(result.metadata.featureCount).toBe(1);
    expect(result.metadata.criticalCount).toBe(1);
  });
});

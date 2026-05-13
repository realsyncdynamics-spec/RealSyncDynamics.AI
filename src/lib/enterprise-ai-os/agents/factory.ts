import type { BaseEnterpriseAgent } from './base-agent';
import { AiDiscoveryAgent } from './discovery-agent';
import { RiskClassificationAgent } from './risk-classification-agent';
import { PolicyEnforcementAgent } from './policy-enforcement-agent';
import { AuditAgent } from './audit-agent';
import { FeedbackIntelligenceAgent } from './feedback-intelligence-agent';
import { RemediationAgent } from './remediation-agent';
import { WorkflowAgent } from './workflow-agent';
import type { AgentId } from './types';

export function createEnterpriseAgent(agentId: AgentId): BaseEnterpriseAgent {
  switch (agentId) {
    case 'ai-discovery-agent':
      return new AiDiscoveryAgent();
    case 'risk-classification-agent':
      return new RiskClassificationAgent();
    case 'policy-enforcement-agent':
      return new PolicyEnforcementAgent();
    case 'audit-agent':
      return new AuditAgent();
    case 'feedback-intelligence-agent':
      return new FeedbackIntelligenceAgent();
    case 'remediation-agent':
      return new RemediationAgent();
    case 'workflow-agent':
      return new WorkflowAgent();
    default: {
      const _exhaust: never = agentId;
      throw new Error(`Unknown agent: ${_exhaust as string}`);
    }
  }
}

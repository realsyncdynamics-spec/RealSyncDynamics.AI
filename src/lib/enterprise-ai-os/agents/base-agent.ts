import type {
  AgentRunInput,
  AgentRunResult,
  EnterpriseAgentDefinition,
} from './types';

export abstract class BaseEnterpriseAgent {
  constructor(public readonly definition: EnterpriseAgentDefinition) {}

  abstract run(input: AgentRunInput): Promise<AgentRunResult>;

  protected success(
    input: AgentRunInput,
    result: Omit<AgentRunResult, 'agentId' | 'status'>,
  ): AgentRunResult {
    return { agentId: input.agentId, status: 'success', ...result };
  }

  protected requiresApproval(
    input: AgentRunInput,
    result: Omit<AgentRunResult, 'agentId' | 'status'>,
  ): AgentRunResult {
    return { agentId: input.agentId, status: 'requires_approval', ...result };
  }

  protected blocked(
    input: AgentRunInput,
    result: Omit<AgentRunResult, 'agentId' | 'status'>,
  ): AgentRunResult {
    return { agentId: input.agentId, status: 'blocked', ...result };
  }
}

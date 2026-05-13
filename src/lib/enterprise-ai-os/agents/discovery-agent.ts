import { BaseEnterpriseAgent } from './base-agent';
import type { AgentRunInput, AgentRunResult } from './types';
import { getEnterpriseAgent } from './registry';

const KNOWN_AI_SIGNALS = [
  'openai',
  'chatgpt',
  'claude',
  'anthropic',
  'gemini',
  'copilot',
  'mistral',
  'perplexity',
  'huggingface',
];

export class AiDiscoveryAgent extends BaseEnterpriseAgent {
  constructor() {
    const definition = getEnterpriseAgent('ai-discovery-agent');
    if (!definition) throw new Error('AI Discovery Agent definition missing');
    super(definition);
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const sources = Array.isArray(input.payload.sources)
      ? (input.payload.sources as unknown[]).map(String)
      : [];

    const detected = sources.filter((source) =>
      KNOWN_AI_SIGNALS.some((signal) => source.toLowerCase().includes(signal)),
    );

    const findings = detected.map((source, index) => ({
      id: `ai-signal-${index}`,
      title: 'Potential AI system detected',
      description: `Detected AI-related signal: ${source}`,
      severity: 'medium' as const,
      riskLevel: 'limited' as const,
      evidence: { source },
    }));

    return this.success(input, {
      summary: `${detected.length} potential AI systems detected.`,
      findings,
      recommendations: detected.map((source, index) => ({
        id: `review-ai-${index}`,
        title: 'Review AI system',
        description: `Review whether ${source} is approved, documented and policy-compliant.`,
        priority: 'medium' as const,
        requiresHumanApproval: true,
      })),
      auditEvents: detected.map((source) => ({
        actor: input.actor || 'ai-discovery-agent',
        action: 'ai_system_detected',
        systemName: source,
        riskLevel: 'limited' as const,
        metadata: { source, tenantId: input.tenantId },
      })),
      metadata: { detected },
    });
  }
}

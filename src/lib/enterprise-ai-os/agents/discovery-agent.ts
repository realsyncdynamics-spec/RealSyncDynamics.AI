import { BaseEnterpriseAgent } from './base-agent';
import type { AgentRunInput, AgentRunResult } from './types';
import { getEnterpriseAgent } from './registry';

const AI_PROVIDERS = {
  cloud: ['openai', 'chatgpt', 'claude', 'anthropic', 'gemini', 'copilot', 'mistral', 'perplexity'],
  opensource: ['huggingface', 'ollama', 'llama', 'mistral', 'phi', 'qwen'],
  saas: ['intercom-ai', 'zendesk-ai', 'salesforce-einstein', 'hubspot-ai', 'slack-ai'],
  embedded: ['transformers', 'pytorch', 'tensorflow', 'onnx', 'mlflow'],
};

const SHADOW_AI_SIGNALS = [
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'bedrock',
  'sagemaker',
  'cohere.ai',
  'replicate.com',
];

export class AiDiscoveryAgent extends BaseEnterpriseAgent {
  constructor() {
    const definition = getEnterpriseAgent('ai-discovery-agent');
    if (!definition) throw new Error('AI Discovery Agent definition missing');
    super(definition);
  }

  private categorizeProvider(source: string): string {
    const lower = source.toLowerCase();
    for (const [category, providers] of Object.entries(AI_PROVIDERS)) {
      if (providers.some((p) => lower.includes(p))) return category;
    }
    return 'unknown';
  }

  private assessDataSensitivity(metadata: Record<string, unknown> | undefined): 'low' | 'high' {
    if (!metadata) return 'low';
    const sensitive = ['customer', 'personal', 'health', 'financial', 'pii', 'gdpr'];
    const dataTypes = String(metadata.dataTypes || '').toLowerCase();
    return sensitive.some((s) => dataTypes.includes(s)) ? 'high' : 'low';
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const sources = Array.isArray(input.payload.sources)
      ? (input.payload.sources as unknown[]).map(String)
      : [];
    const metadata = input.payload.metadata as Record<string, unknown> | undefined;

    const allSignals = Object.values(AI_PROVIDERS).flat();
    const detected = sources.filter((source) =>
      allSignals.some((signal) => source.toLowerCase().includes(signal)),
    );

    const shadowAiDetected = sources.filter((source) =>
      SHADOW_AI_SIGNALS.some((signal) => source.toLowerCase().includes(signal)),
    );

    const findings: Array<{
      id: string;
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      riskLevel: 'minimal' | 'limited' | 'high' | 'prohibited' | 'unknown';
      evidence: Record<string, unknown>;
    }> = detected.map((source, index) => {
      const category = this.categorizeProvider(source);
      const isShadow = shadowAiDetected.includes(source);
      return {
        id: `ai-signal-${index}`,
        title: isShadow
          ? `Shadow AI detected: ${category} (${source})`
          : `AI system detected: ${category} (${source})`,
        description: isShadow
          ? `Unapproved/undocumented AI provider detected via ${source}. Requires immediate review.`
          : `Detected ${category} AI provider: ${source}. Verify compliance and documentation.`,
        severity: isShadow ? 'high' : 'medium',
        riskLevel: isShadow ? 'high' : 'limited',
        evidence: { source, category, isShadow, dataSensitivity: this.assessDataSensitivity(metadata) },
      };
    });

    const recommendations: Array<{
      id: string;
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      requiresHumanApproval: boolean;
    }> = detected.map((source, index) => ({
      id: `review-ai-${index}`,
      title: shadowAiDetected.includes(source)
        ? 'Immediately audit shadow AI usage'
        : 'Document AI system usage',
      description: shadowAiDetected.includes(source)
        ? `${source} appears to be used but not approved. Assess impact and get compliance sign-off.`
        : `Ensure ${source} has vendor assessment, data handling policy, and DPA in place.`,
      priority: shadowAiDetected.includes(source) ? 'urgent' : 'high',
      requiresHumanApproval: true,
    }));

    return this.success(input, {
      summary: `Discovery complete: ${detected.length} AI systems, ${shadowAiDetected.length} shadow AI flagged`,
      findings,
      recommendations,
      auditEvents: [
        {
          actor: input.actor || 'ai-discovery-agent',
          action: 'ai_discovery_scan',
          systemName: 'enterprise-scan',
          riskLevel: shadowAiDetected.length > 0 ? 'high' : 'limited',
          metadata: {
            totalDetected: detected.length,
            shadowAiCount: shadowAiDetected.length,
            categories: [...new Set(detected.map((s) => this.categorizeProvider(s)))],
            tenantId: input.tenantId,
          },
        },
      ],
      metadata: {
        detected,
        shadowAi: shadowAiDetected,
        categories: Object.keys(AI_PROVIDERS),
      },
    });
  }
}

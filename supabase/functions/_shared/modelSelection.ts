// Smart Model Selection for Governance Agent
//
// Detects question complexity and routes to optimal model:
// - Simple (FAQ-like): Haiku 4.5 (~€0.80/M input) — 5x cheaper, sufficient for basic Q&A
// - Complex (multi-turn, tools, analysis): Sonnet 4.6 (~€3.00/M input) — for nuanced compliance
//
// Cost impact: ~40-50% reduction if 40-50% of queries are simple
// Latency impact: ~30% faster for simple queries (Haiku is ~3x faster)

export type ModelTier = 'haiku' | 'sonnet';

interface ComplexitySignals {
  messageLength: number;
  isFollowUp: boolean;
  historyLength: number;
  hasSpecialTerms: boolean;
  mentionedTools: string[];
}

function analyzeComplexity(message: string, historyLength: number, isFollowUp: boolean): ComplexitySignals {
  // Compliance-specific keywords that signal complex analysis
  const complexTerms = [
    // Legal concepts
    'dpia', 'dsfa', 'datenschutzfolgenabschätzung',
    'risikofolgenabschätzung', 'folgenabschätzung',
    'auditbericht', 'audit trail',
    'datenfluss', 'datenverarbeitung', 'datenflüsse',
    'speicherdauer', 'aufbewahrungsfrist', 'aufbewahrungsfristen',
    'löschkonzept', 'datentreu', 'datentreuhand',
    'unterauftragsverarbeiter', 'auftragsverarbeiter',
    'risikobeurteilung', 'risikoanalyse',
    'ai act', 'eu ai act', 'hochrisiko-ki',
    'notwendige massnahmen', 'compliance-massnahmen',

    // Multi-step concepts
    'wie kann ich', 'schritt für schritt', 'prozess',
    'implementierung', 'umsetzung',
    'mehrere', 'kombiniert', 'zusammen',
    'template', 'vorlage', 'beispiel',
    'vendor', 'lieferant', 'integration',

    // Audit/Governance
    'audit', 'compliance', 'governance', 'policy',
    'evidence', 'proof', 'documentation',
    'scan', 'tracking', 'monitoring',
  ];

  const lowerMessage = message.toLowerCase();
  const hasComplex = complexTerms.some(term => lowerMessage.includes(term));

  return {
    messageLength: message.length,
    isFollowUp,
    historyLength,
    hasSpecialTerms: hasComplex,
    mentionedTools: extractToolHints(message),
  };
}

function extractToolHints(message: string): string[] {
  const toolKeywords = {
    'dpia': ['dpia', 'datenschutzfolgenanschätzung'],
    'dsr': ['dsr', 'löschanfrage', 'auskunftsantrag', 'subject request'],
    'vendor': ['vendor', 'unterauftragsverarbeiter', 'auftragsverarbeiter'],
    'policy': ['policy', 'richtlinie', 'prozess', 'verfahren'],
    'incident': ['incident', 'zwischenfall', 'datenabfall', 'datenabfluss'],
  };

  const mentioned: string[] = [];
  for (const [tool, keywords] of Object.entries(toolKeywords)) {
    if (keywords.some(kw => message.toLowerCase().includes(kw))) {
      mentioned.push(tool);
    }
  }
  return mentioned;
}

function scoreComplexity(signals: ComplexitySignals): number {
  let score = 0;

  // Message length: 0-100 chars = simple (0), 100-500 = medium (50), 500+ = complex (100)
  if (signals.messageLength < 100) score += 0;
  else if (signals.messageLength < 500) score += 50;
  else score += 100;

  // Follow-up in conversation: likely building on previous context (add 30)
  if (signals.isFollowUp && signals.historyLength > 4) score += 30;

  // Special terms increase complexity (add 40)
  if (signals.hasSpecialTerms) score += 40;

  // Multiple tools suggest complex workflow (add 20 per tool)
  score += Math.min(signals.mentionedTools.length * 20, 60);

  // Conversation history: if short and simple terms, reduce complexity
  // (ephemeral cache is warm, but new topics are simpler)
  if (signals.historyLength <= 2 && !signals.hasSpecialTerms) score -= 20;

  return Math.max(0, Math.min(score, 100));
}

export function selectModel(
  message: string,
  historyLength: number,
  isFollowUp: boolean,
): ModelTier {
  const signals = analyzeComplexity(message, historyLength, isFollowUp);
  const complexity = scoreComplexity(signals);

  // Thresholds:
  // 0-40: Simple (Haiku)
  // 40-100: Complex (Sonnet)
  return complexity < 40 ? 'haiku' : 'sonnet';
}

export function getModelId(tier: ModelTier): string {
  return tier === 'haiku' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6-20250514';
}

export const MODEL_PRICING = {
  haiku: { input: 0.80, output: 4.00 },      // $0.80/$4.00 per 1M tokens
  sonnet: { input: 3.00, output: 15.00 },    // $3.00/$15.00 per 1M tokens
};

export function estimateSavings(
  routedToHaiku: number,   // % of queries that could use Haiku
  avgInputTokens: number,  // typical input token count
  avgOutputTokens: number, // typical output token count
): { savings: number; percentage: number } {
  const perQuery = {
    sonnet: (avgInputTokens * MODEL_PRICING.sonnet.input + avgOutputTokens * MODEL_PRICING.sonnet.output) / 1_000_000,
    haiku: (avgInputTokens * MODEL_PRICING.haiku.input + avgOutputTokens * MODEL_PRICING.haiku.output) / 1_000_000,
  };

  // Cost if all queries used Sonnet
  const allSonnet = 100 * perQuery.sonnet;

  // Cost with smart routing
  const hybrid = (routedToHaiku * perQuery.haiku) + ((100 - routedToHaiku) * perQuery.sonnet);

  return {
    savings: (allSonnet - hybrid) / allSonnet,
    percentage: Math.round(((allSonnet - hybrid) / allSonnet) * 100),
  };
}

/**
 * Example usage in governance-agent/index.ts:
 *
 * import { selectModel, getModelId } from '../_shared/modelSelection.ts';
 *
 * // In handleChat():
 * const selectedTier = selectModel(message, history.length, !!body.session_id);
 * const effectiveModel = getModelId(selectedTier);
 *
 * const resp = await client.messages.create({
 *   model: effectiveModel,
 *   max_tokens: MAX_TOKENS_PER_TURN,
 *   ...
 * });
 */

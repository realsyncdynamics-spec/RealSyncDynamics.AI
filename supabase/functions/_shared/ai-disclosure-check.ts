/**
 * AI Disclosure Detection — Heuristic check for Art. 52 AI Act compliance
 *
 * Detects whether a website discloses its use of AI systems.
 * Art. 52 AI Act (Limited-Risk AI) requires users to be informed when
 * they interact with AI systems.
 *
 * This is a simplified, MVP-level heuristic:
 * 1. Detect presence of AI-service APIs (ChatGPT, Claude, Gemini, etc.)
 * 2. Detect AI-disclosure text patterns
 * 3. Return clear finding for dashboard
 */

interface AIDisclosureResult {
  detected_ai_tools: string[];
  has_disclosure: boolean;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
}

/**
 * Detect AI service APIs being loaded or called
 */
function detectAIServiceAPIs(html: string): string[] {
  const detectedTools: string[] = [];
  const lc = html.toLowerCase();

  // API endpoints and SDK patterns
  const patterns: Record<string, RegExp[]> = {
    'OpenAI (ChatGPT)': [
      /api\.openai\.com/i,
      /chat\.openai\.com/i,
      /openai\.com.*api/i,
      /new OpenAI\(/,
      /createChatCompletion/i,
      /gpt-[34]/i, // GPT model references
    ],
    'Anthropic (Claude)': [
      /api\.anthropic\.com/i,
      /messages\.claude/i,
      /anthropic\.com.*api/i,
      /new Anthropic\(/,
      /createMessage/i,
      /claude-[23]/i,
    ],
    'Google (Gemini)': [
      /generativelanguage\.googleapis\.com/i,
      /gemini\.google\.com/i,
      /google\.generativeai/i,
      /genai/i,
      /createGenerativeModel/i,
      /gemini-pro/i,
    ],
    'Cohere': [
      /api\.cohere\.com/i,
      /cohere\.com.*api/i,
      /new CohereClient/i,
    ],
    'Mistral': [
      /api\.mistral\.ai/i,
      /mistralai\.com/i,
      /new MistralClient/i,
    ],
    'Hugging Face': [
      /huggingface\.co.*inference/i,
      /huggingface\.js/i,
      /hf_[a-zA-Z0-9]{20,}/i, // HF API tokens pattern
    ],
  };

  for (const [tool, regexps] of Object.entries(patterns)) {
    const found = regexps.some((re) => re.test(lc));
    if (found) {
      detectedTools.push(tool);
    }
  }

  return [...new Set(detectedTools)];
}

/**
 * Detect AI-disclosure text patterns
 * (Indicates author is aware and disclosing AI usage)
 */
function detectAIDisclosureText(html: string): boolean {
  const lc = html.toLowerCase();

  const disclosurePatterns = [
    // English
    /powered by\s+(openai|anthropic|google|cohere|hugging\s?face|ai|artificial\s+intelligence)/,
    /this\s+(site|website|page)\s+(uses|is\s+powered\s+by)\s+(ai|artificial\s+intelligence)/,
    /ai[- ]?generated|ai\s+generated/,
    /generated\s+by\s+(ai|artificial\s+intelligence)/,
    /chatbot|chat\s+with\s+ai/,
    /this\s+.*?is\s+an?\s+(ai|artificial\s+intelligence)\s+assistant/,
    /artificial\s+intelligence/,

    // German
    /angetrieben\s+durch\s+(openai|anthropic|google|cohere|ki|künstliche\s+intelligenz)/,
    /diese\s+(seite|website).*?nutzt\s+(ki|künstliche\s+intelligenz)/,
    /(ki|künstliche\s+intelligenz)[- ]?generiert/,
    /von\s+(ki|künstliche\s+intelligenz)\s+generiert/,
    /chatbot|chat\s+mit\s+ki/,
    /dies.*?ist\s+ein[e]?\s+(ki|künstliche\s+intelligenz)[- ]?assistent/,
    /einsatz\s+(von\s+)?(ki|künstlich\w*\s+intelligenz)/,
    /künstlich\w*\s+intelligenz/,
  ];

  return disclosurePatterns.some((pattern) => pattern.test(lc));
}

/**
 * Main detection function
 */
export function detectAIDisclosure(html: string): AIDisclosureResult {
  const detectedTools = detectAIServiceAPIs(html);
  const hasTextDisclosure = detectAIDisclosureText(html);
  const evidence: string[] = [];

  if (detectedTools.length > 0) {
    evidence.push(`AI APIs detected: ${detectedTools.join(', ')}`);
  }
  if (hasTextDisclosure) {
    evidence.push('AI disclosure text found');
  }

  // Determine findings
  const hasAI = detectedTools.length > 0;
  const disclosed = hasTextDisclosure;

  return {
    detected_ai_tools: detectedTools,
    has_disclosure: disclosed,
    confidence: evidence.length > 1 ? 'high' : evidence.length === 1 ? 'medium' : 'low',
    evidence,
  };
}

/**
 * Export for tests
 */
export const __test = {
  detectAIServiceAPIs,
  detectAIDisclosureText,
};

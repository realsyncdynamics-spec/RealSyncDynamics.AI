// Provider abstraction for AI tools.
//
// Routes a normalized request to the right model SDK and returns a normalized
// {text, inputTokens, outputTokens, cachedTokens} result.
//
// Anthropic:  prompt-caching enabled on the system prompt so repeated tool
//             invocations only pay full input price for the user prompt.
// Google:     uses @google/genai (already in the repo, mirrors gateway.ts).
// OpenAI:     not implemented in v1 — throws PROVIDER_NOT_IMPLEMENTED so the
//             surface is uniform and callers see a clear error.

import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1';
import { GoogleGenAI } from 'npm:@google/genai@1.29.0';

export type ProviderId = 'anthropic' | 'google' | 'openai';

export interface ProviderRequest {
  provider: ProviderId;
  modelId: string;
  systemPrompt: string | null;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
}

export interface ProviderResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** Tokens served from prompt cache (counts toward inputTokens for billing display, separate for clarity). */
  cachedTokens: number;
}

export class ProviderError extends Error {
  code: string;
  constructor(message: string, code = 'PROVIDER_ERROR') {
    super(message); this.code = code;
  }
}

export async function callProvider(req: ProviderRequest): Promise<ProviderResult> {
  switch (req.provider) {
    case 'anthropic': return await callAnthropic(req);
    case 'google':    return await callGoogle(req);
    case 'openai':    throw new ProviderError('OpenAI provider not implemented in v1', 'PROVIDER_NOT_IMPLEMENTED');
    default:
      throw new ProviderError(`unsupported provider: ${req.provider}`, 'PROVIDER_UNSUPPORTED');
  }
}

// ─── Anthropic ──────────────────────────────────────────────────────────────
async function callAnthropic(req: ProviderRequest): Promise<ProviderResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new ProviderError('ANTHROPIC_API_KEY not set', 'PROVIDER_NOT_CONFIGURED');

  const client = new Anthropic({ apiKey });

  // Cache the system prompt so repeated tool invocations get the prompt-cache discount.
  // The user prompt is per-request and intentionally NOT cached.
  const systemBlocks = req.systemPrompt
    ? [{ type: 'text' as const, text: req.systemPrompt, cache_control: { type: 'ephemeral' as const } }]
    : undefined;

  const resp = await client.messages.create({
    model: req.modelId,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    system: systemBlocks,
    messages: [{ role: 'user', content: req.userPrompt }],
  });

  // Concatenate all text blocks of the response.
  const text = resp.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  // The Anthropic SDK exposes cache stats on usage when caching is in use.
  // deno-lint-ignore no-explicit-any
  const u: any = resp.usage;
  return {
    text,
    inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    outputTokens: u.output_tokens ?? 0,
    cachedTokens: u.cache_read_input_tokens ?? 0,
  };
}

// ─── Google (Gemini) ────────────────────────────────────────────────────────
async function callGoogle(req: ProviderRequest): Promise<ProviderResult> {
  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('GOOGLE_API_KEY');
  if (!apiKey) throw new ProviderError('GEMINI_API_KEY not set', 'PROVIDER_NOT_CONFIGURED');

  const ai = new GoogleGenAI({ apiKey });

  // Gemini takes a single contents array; we prepend the system prompt as instruction.
  const contents = req.systemPrompt
    ? `${req.systemPrompt}\n\n---\n\n${req.userPrompt}`
    : req.userPrompt;

  // deno-lint-ignore no-explicit-any
  const resp: any = await ai.models.generateContent({
    model: req.modelId,
    contents,
    config: { maxOutputTokens: req.maxTokens, temperature: req.temperature },
  });

  const text: string = resp.text ?? '';
  const usage = resp.usageMetadata ?? {};
  return {
    text,
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
    cachedTokens: usage.cachedContentTokenCount ?? 0,
  };
}

// Provider abstraction for AI tools.
//
// Routes a normalized request to the right model SDK and returns a normalized
// {text, inputTokens, outputTokens, cachedTokens} result.
//
// Anthropic:  prompt-caching enabled on the system prompt so repeated tool
//             invocations only pay full input price for the user prompt.
// Google:     uses @google/genai (already in the repo, mirrors gateway.ts).
// OpenAI:     uses openai SDK (Chat Completions). Token counts come back from
//             response.usage so cost tracking works the same way as the other
//             providers.

import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1';
import { GoogleGenAI } from 'npm:@google/genai@1.29.0';
import OpenAI from 'npm:openai@4.77.0';

export type ProviderId = 'anthropic' | 'google' | 'openai' | 'ollama';

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
    case 'openai':    return await callOpenAI(req);
    case 'ollama':    return await callOllama(req);
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

// ─── Ollama (self-hosted, EU-local) ─────────────────────────────────────────
// Routed via a Bearer-protected reverse-proxy on the Kodee-VPS.
// The Ollama /api/chat endpoint streams by default — we request stream=false
// so we can parse a single JSON body and stay aligned with the other
// providers' synchronous shape.
async function callOllama(req: ProviderRequest): Promise<ProviderResult> {
  const baseUrl = Deno.env.get('OLLAMA_URL');
  if (!baseUrl) throw new ProviderError('OLLAMA_URL not set', 'PROVIDER_NOT_CONFIGURED');

  const token = Deno.env.get('OLLAMA_AUTH_TOKEN');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
  messages.push({ role: 'user', content: req.userPrompt });

  // CPU-only inference on the VPS can take 30-60s for a 200-token reply.
  // Edge Functions cap at 150s — abort earlier so we surface a clean error.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let resp: Response;
  try {
    resp = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: req.modelId,
        messages,
        stream: false,
        options: {
          temperature: req.temperature,
          num_predict: req.maxTokens,
        },
      }),
    });
  } catch (e) {
    clearTimeout(timeout);
    const msg = (e as Error).name === 'AbortError'
      ? 'Ollama request timed out (>120s)'
      : `Ollama fetch failed: ${(e as Error).message}`;
    throw new ProviderError(msg, 'PROVIDER_ERROR');
  }
  clearTimeout(timeout);

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new ProviderError(`Ollama HTTP ${resp.status}: ${body.slice(0, 200)}`, 'PROVIDER_ERROR');
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await resp.json();
  const text: string = data?.message?.content ?? '';

  return {
    text,
    inputTokens: data?.prompt_eval_count ?? 0,
    outputTokens: data?.eval_count ?? 0,
    cachedTokens: 0,
  };
}

// ─── OpenAI (Chat Completions) ──────────────────────────────────────────────
async function callOpenAI(req: ProviderRequest): Promise<ProviderResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new ProviderError('OPENAI_API_KEY not set', 'PROVIDER_NOT_CONFIGURED');

  const client = new OpenAI({ apiKey });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
  messages.push({ role: 'user', content: req.userPrompt });

  const resp = await client.chat.completions.create({
    model: req.modelId,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    messages,
  });

  const text = resp.choices[0]?.message?.content ?? '';
  const usage = resp.usage;

  // OpenAI exposes cached prompt tokens via prompt_tokens_details.cached_tokens
  // (when prompt caching is in use; safe-default to 0 otherwise).
  // deno-lint-ignore no-explicit-any
  const cached = (usage as any)?.prompt_tokens_details?.cached_tokens ?? 0;

  return {
    text,
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    cachedTokens: cached,
  };
}

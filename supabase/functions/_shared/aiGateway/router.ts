import type { AiGatewayRequest, AiGatewayResponse, AiProviderAdapter, ModelProfile } from './types.ts';
import { LMStudioAdapter } from './lmStudioAdapter.ts';
import { AnthropicAdapter, type AnthropicConfig } from './anthropicAdapter.ts';
import { OpenAIAdapter, type OpenAIConfig } from './openaiAdapter.ts';

// Deno mirror of src/core/ai-gateway/router.ts. Wires the LM Studio
// adapter as the primary provider and a fallback chain (Anthropic →
// OpenAI) for generate() + extractJson(). embed() goes straight to the
// routed adapter — no cloud fallback (no Anthropic embeddings; we don't
// silently swap a local embedder for a paid cloud one).
//
// Fallback chain: LM Studio → Anthropic → OpenAI. Each step activates
// only if (a) the previous step threw a transport-level error AND
// (b) the next step is configured. Strict-EU-locality deployments
// disable a step by simply not setting its API key in Vault.

const DEFAULTS = {
  timeoutMs:   8_000,
  maxTokens:   1200,
  temperature: 0.2,
};

const PROVIDER_BY_PROFILE: Record<ModelProfile, 'lm_studio' | 'openai' | 'anthropic'> = {
  'fast-local':     'lm_studio',
  'quality-local':  'lm_studio',
  'strict-json':    'lm_studio',
  'embed-default':  'lm_studio',
  'cloud-fallback': 'anthropic',
};

export interface ServerAiGatewayDeps {
  lmStudio?: AiProviderAdapter;
  /** Env-resolved LM Studio base URL. */
  lmStudioBaseUrl: string;
  /** Env-resolved LM Studio API key. */
  lmStudioApiKey?: string;
  /** Inject an Anthropic adapter (enables Anthropic step in the chain). */
  anthropic?: AiProviderAdapter;
  /** Construct the default Anthropic adapter with this config. */
  anthropicConfig?: AnthropicConfig;
  /** Inject an OpenAI adapter (enables OpenAI step AFTER Anthropic). */
  openai?: AiProviderAdapter;
  /** Construct the default OpenAI adapter with this config. */
  openaiConfig?: OpenAIConfig;
}

export class ServerAiGateway {
  private readonly lmStudio: AiProviderAdapter;
  private readonly fallbackChain: readonly AiProviderAdapter[];

  constructor(deps: ServerAiGatewayDeps) {
    this.lmStudio = deps.lmStudio ?? new LMStudioAdapter({
      baseUrl: deps.lmStudioBaseUrl,
      apiKey:  deps.lmStudioApiKey,
    });
    const chain: AiProviderAdapter[] = [];
    const anthropic = deps.anthropic ?? (deps.anthropicConfig ? new AnthropicAdapter(deps.anthropicConfig) : null);
    if (anthropic) chain.push(anthropic);
    const openai = deps.openai ?? (deps.openaiConfig ? new OpenAIAdapter(deps.openaiConfig) : null);
    if (openai) chain.push(openai);
    this.fallbackChain = chain;
  }

  async health(): Promise<{ ok: boolean; primary: unknown; fallback: Array<{ id: string; health: unknown }> }> {
    const primary = await this.lmStudio.health();
    const fallback: Array<{ id: string; health: unknown }> = [];
    for (const fb of this.fallbackChain) {
      fallback.push({ id: fb.id, health: await fb.health() });
    }
    const anyFallbackOk = fallback.some((f) => (f.health as { ok: boolean }).ok);
    return { ok: primary.ok || anyFallbackOk, primary, fallback };
  }

  generate(request: AiGatewayRequest): Promise<AiGatewayResponse<string>> {
    return this.withFallback(request, (adapter) => adapter.generate(this.withDefaults(request)));
  }

  extractJson<T>(request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    return this.withFallback(request, (adapter) => adapter.extractJson<T>(this.withDefaults(request)));
  }

  embed(request: AiGatewayRequest) {
    return this.resolveAdapter(request.model_profile).embed(this.withDefaults(request));
  }

  hasCloudFallback(): boolean { return this.fallbackChain.length > 0; }
  fallbackChainIds(): readonly string[] { return this.fallbackChain.map((a) => a.id); }

  private resolveAdapter(profile: ModelProfile): AiProviderAdapter {
    const provider = PROVIDER_BY_PROFILE[profile];
    if (provider === 'lm_studio') return this.lmStudio;
    if (provider === 'anthropic') {
      const a = this.fallbackChain.find((x) => x.id === 'anthropic');
      if (a) return a;
    }
    if (provider === 'openai') {
      const o = this.fallbackChain.find((x) => x.id === 'openai');
      if (o) return o;
    }
    throw new Error(`Provider not configured for profile: ${profile}`);
  }

  private withDefaults(request: AiGatewayRequest): AiGatewayRequest {
    return {
      ...request,
      timeout_ms:  request.timeout_ms  ?? DEFAULTS.timeoutMs,
      max_tokens:  request.max_tokens  ?? DEFAULTS.maxTokens,
      temperature: request.temperature ?? DEFAULTS.temperature,
      trace_id:    request.trace_id    ?? crypto.randomUUID(),
    };
  }

  private async withFallback<T>(
    request: AiGatewayRequest,
    run: (adapter: AiProviderAdapter) => Promise<AiGatewayResponse<T>>,
  ): Promise<AiGatewayResponse<T>> {
    const primary = this.resolveAdapter(request.model_profile);
    try {
      return await run(primary);
    } catch (err) {
      if (!isTransportLevelFailure(err)) throw err;
      let lastErr: unknown = err;
      for (const fb of this.fallbackChain) {
        if (fb === primary) continue;
        try {
          return await run(fb);
        } catch (fbErr) {
          lastErr = fbErr;
          if (!isTransportLevelFailureOrApiError(fbErr)) throw fbErr;
        }
      }
      throw lastErr;
    }
  }
}

const TRANSPORT_PATTERNS = [
  /failed to lookup address information/i,
  /dns error/i,
  /name or service not known/i,
  /connection refused/i,
  /connect ECONNREFUSED/i,
  /network request failed/i,
  /fetch failed/i,
  /aborted/i,
  /timeout/i,
  /no LM Studio model available/i,
  /LM Studio HTTP 5\d\d/,
  /LM Studio embeddings HTTP 5\d\d/,
];

const CHAIN_CONTINUE_PATTERNS = [
  ...TRANSPORT_PATTERNS,
  /Anthropic HTTP 5\d\d/,
  /OpenAI HTTP 5\d\d/,
  /OpenAI HTTP 429/,
  /rate.?limit/i,
];

export function isTransportLevelFailure(err: unknown): boolean {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  return TRANSPORT_PATTERNS.some((p) => p.test(message));
}

export function isTransportLevelFailureOrApiError(err: unknown): boolean {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  return CHAIN_CONTINUE_PATTERNS.some((p) => p.test(message));
}

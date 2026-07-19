import type { AiGatewayRequest, AiGatewayResponse, AiProviderAdapter } from './types';
import { LMStudioAdapter, type LmStudioConfig } from './providers/lmStudioAdapter';
import { AnthropicAdapter, type AnthropicConfig } from './providers/anthropicAdapter';
import { OpenAIAdapter, type OpenAIConfig } from './providers/openaiAdapter';
import { aiGatewayConfig } from './config';

// AiGateway — single seam between product code and inference. Routes by
// model_profile, applies defaults, runs a CHAIN of cloud fallbacks when
// the primary (LM Studio) adapter fails with a transport-level error.
// Product code MUST NOT instantiate an adapter directly.
//
// NOTE: this lives at `router.ts` (not `gateway.ts` as the original spec
// proposed) because the legacy `gateway.ts` in this directory is still
// used by KodeeView + CreatorDashboard. The two coexist until the
// integration PR replaces them.
//
// Fallback chain (linear, ordered):
//
//   LM Studio (primary)  →  Anthropic  →  OpenAI
//
// Each link only activates if the previous link threw a transport-level
// failure AND the next link is configured. Anthropic is preferred over
// OpenAI because of EU-data-locality friendliness (Anthropic offers EU
// region pinning; OpenAI's EU controls are weaker). Operators with
// strict EU-only constraints can disable the OpenAI link by simply not
// setting OPENAI_API_KEY in Vault.
//
// Semantics:
//   - Only generate() + extractJson() chain — embed() goes straight to
//     the routed provider; Anthropic has no embed API and we don't want
//     to silently switch from a local embedder to a paid cloud one.
//   - We fall back ONLY on transport-level errors (DNS / connect / 5xx
//     / timeout / no-model-available). 4xx validation errors propagate.
//   - Chain stops at the first OK response; remaining fallbacks are not
//     consulted.

export interface AiGatewayDeps {
  /** Inject a custom LM Studio adapter (DI for tests + Edge Function). */
  lmStudio?: AiProviderAdapter;
  /** Override the LM Studio adapter config when constructing the default. */
  lmStudioConfig?: Partial<LmStudioConfig>;
  /** Inject an Anthropic adapter (enables Anthropic fallback for generate/extractJson). */
  anthropic?: AiProviderAdapter;
  /** Construct the default Anthropic adapter with this config. */
  anthropicConfig?: AnthropicConfig;
  /** Inject an OpenAI adapter (enables OpenAI fallback AFTER Anthropic). */
  openai?: AiProviderAdapter;
  /** Construct the default OpenAI adapter with this config. */
  openaiConfig?: OpenAIConfig;
}

export class AiGateway {
  private readonly lmStudio: AiProviderAdapter;
  private readonly fallbackChain: readonly AiProviderAdapter[];

  constructor(deps: AiGatewayDeps = {}) {
    const baseUrl = (deps.lmStudioConfig?.baseUrl ?? aiGatewayConfig.providers.lm_studio.baseUrl) as string;
    const apiKey = (deps.lmStudioConfig?.apiKey ?? aiGatewayConfig.providers.lm_studio.apiKey) as string | undefined;
    this.lmStudio = deps.lmStudio ?? new LMStudioAdapter({
      baseUrl,
      apiKey,
      defaultModel: deps.lmStudioConfig?.defaultModel,
      fetchImpl:    deps.lmStudioConfig?.fetchImpl,
    });

    const chain: AiProviderAdapter[] = [];
    const anthropic = deps.anthropic ?? (deps.anthropicConfig ? new AnthropicAdapter(deps.anthropicConfig) : null);
    if (anthropic) chain.push(anthropic);
    const openai = deps.openai ?? (deps.openaiConfig ? new OpenAIAdapter(deps.openaiConfig) : null);
    if (openai) chain.push(openai);
    this.fallbackChain = chain;
  }

  health() {
    return this.lmStudio.health();
  }

  generate(request: AiGatewayRequest): Promise<AiGatewayResponse<string>> {
    return this.withFallback(request, (adapter) => adapter.generate(this.withDefaults(request)));
  }

  extractJson<T>(request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    return this.withFallback(request, (adapter) => adapter.extractJson<T>(this.withDefaults(request)));
  }

  embed(request: AiGatewayRequest) {
    // No fallback for embed — see header.
    return this.resolveAdapter(request.model_profile).embed(this.withDefaults(request));
  }

  /** Expose whether cloud-fallback is wired (for /health responses + tests). */
  hasCloudFallback(): boolean {
    return this.fallbackChain.length > 0;
  }

  /** Names of providers in the fallback chain, in order of attempt. */
  fallbackChainIds(): readonly string[] {
    return this.fallbackChain.map((a) => a.id);
  }

  private resolveAdapter(profile: AiGatewayRequest['model_profile']): AiProviderAdapter {
    const profileConfig = aiGatewayConfig.modelProfiles[profile];
    if (profileConfig.provider === 'lm_studio') return this.lmStudio;
    if (profileConfig.provider === 'anthropic') {
      const anthropic = this.fallbackChain.find((a) => a.id === 'anthropic');
      if (anthropic) return anthropic;
    }
    if (profileConfig.provider === 'openai') {
      const openai = this.fallbackChain.find((a) => a.id === 'openai');
      if (openai) return openai;
    }
    throw new Error(`Provider not configured for profile: ${profile}`);
  }

  private withDefaults(request: AiGatewayRequest): AiGatewayRequest {
    return {
      ...request,
      timeout_ms:  request.timeout_ms  ?? aiGatewayConfig.defaults.timeoutMs,
      max_tokens:  request.max_tokens  ?? aiGatewayConfig.defaults.maxTokens,
      temperature: request.temperature ?? aiGatewayConfig.defaults.temperature,
      trace_id:    request.trace_id    ?? cryptoRandomUUID(),
    };
  }

  /**
   * Try the primary, then walk the fallback chain. Each step only
   * activates if the previous step threw a transport-level error.
   * The last error in the chain propagates if every step fails.
   */
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
        if (fb === primary) continue;  // already tried
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

export const aiGateway = new AiGateway();

// ── Transport-failure detection ───────────────────────────────────
//
// We only fall back on errors that look like the primary is UNREACHABLE
// or TEMPORARILY DOWN, not on errors that mean the request itself was
// rejected. The exact taxonomy of fetch/Deno errors varies by runtime,
// so we match on common message patterns.

const TRANSPORT_PATTERNS = [
  /failed to lookup address information/i,    // Deno DNS
  /dns error/i,                                // generic
  /name or service not known/i,                // Linux DNS
  /connection refused/i,                        // ECONNREFUSED
  /connect ECONNREFUSED/i,
  /network request failed/i,                    // Node fetch
  /fetch failed/i,                              // undici
  /aborted/i,                                   // AbortController timeout
  /timeout/i,
  /no LM Studio model available/i,              // adapter returns this when /models empty
  /LM Studio HTTP 5\d\d/,                       // 5xx upstream
  /LM Studio embeddings HTTP 5\d\d/,
];

// Errors that allow continuing the fallback chain. Broader than the
// primary-trip patterns because Anthropic / OpenAI emit their own
// error shapes (rate-limit, 5xx) that should let us try the NEXT step.
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

function cryptoRandomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

import type { AiGatewayRequest, AiGatewayResponse, AiProviderAdapter, ModelProfile } from './types.ts';
import { LMStudioAdapter } from './lmStudioAdapter.ts';
import { AnthropicAdapter, type AnthropicConfig } from './anthropicAdapter.ts';

// Deno mirror of src/core/ai-gateway/router.ts. Wires the LM Studio
// adapter as the primary provider and optionally an Anthropic adapter
// as a cloud-fallback for generate() + extractJson() (embed() has no
// Anthropic equivalent).
//
// Fallback semantics (must stay identical to the frontend mirror):
//   - Only triggers on transport-level failures from the primary
//     (DNS / connect / 5xx / timeout / no-model-available).
//   - 4xx validation errors propagate unchanged — retrying wouldn't help.
//   - Fallback is OFF when no AnthropicAdapter is injected, preserving
//     the EU-lokal promise for opt-out deployments.

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
  /** Inject an Anthropic adapter (enables cloud-fallback). */
  anthropic?: AiProviderAdapter;
  /** Construct the default Anthropic adapter with this config. */
  anthropicConfig?: AnthropicConfig;
}

export class ServerAiGateway {
  private readonly lmStudio: AiProviderAdapter;
  private readonly anthropic: AiProviderAdapter | null;

  constructor(deps: ServerAiGatewayDeps) {
    this.lmStudio = deps.lmStudio ?? new LMStudioAdapter({
      baseUrl: deps.lmStudioBaseUrl,
      apiKey:  deps.lmStudioApiKey,
    });
    if (deps.anthropic) {
      this.anthropic = deps.anthropic;
    } else if (deps.anthropicConfig) {
      this.anthropic = new AnthropicAdapter(deps.anthropicConfig);
    } else {
      this.anthropic = null;
    }
  }

  async health(): Promise<{ ok: boolean; primary: unknown; fallback: unknown }> {
    const primary = await this.lmStudio.health();
    const fallback = this.anthropic ? await this.anthropic.health() : { ok: false, error: 'not configured' };
    // We're "ok" if EITHER provider can answer; the gateway can route
    // around an outage.
    return { ok: primary.ok || (this.anthropic !== null && (fallback as { ok: boolean }).ok), primary, fallback };
  }

  generate(request: AiGatewayRequest): Promise<AiGatewayResponse<string>> {
    return this.withFallback(request, () =>
      this.resolveAdapter(request.model_profile).generate(this.withDefaults(request)),
    );
  }

  extractJson<T>(request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    return this.withFallback(request, () =>
      this.resolveAdapter(request.model_profile).extractJson<T>(this.withDefaults(request)),
    );
  }

  embed(request: AiGatewayRequest) {
    return this.resolveAdapter(request.model_profile).embed(this.withDefaults(request));
  }

  hasCloudFallback(): boolean { return this.anthropic !== null; }

  private resolveAdapter(profile: ModelProfile): AiProviderAdapter {
    const provider = PROVIDER_BY_PROFILE[profile];
    if (provider === 'lm_studio') return this.lmStudio;
    if (provider === 'anthropic' && this.anthropic) return this.anthropic;
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
    runPrimary: () => Promise<AiGatewayResponse<T>>,
  ): Promise<AiGatewayResponse<T>> {
    try {
      return await runPrimary();
    } catch (err) {
      if (!this.anthropic) throw err;
      if (!isTransportLevelFailure(err)) throw err;
      const isJson = request.task_type === 'extract_json';
      const fallback = isJson
        ? (this.anthropic.extractJson<T>(this.withDefaults(request)) as Promise<AiGatewayResponse<T>>)
        : (this.anthropic.generate(this.withDefaults(request)) as unknown as Promise<AiGatewayResponse<T>>);
      return fallback;
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

export function isTransportLevelFailure(err: unknown): boolean {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  return TRANSPORT_PATTERNS.some((p) => p.test(message));
}

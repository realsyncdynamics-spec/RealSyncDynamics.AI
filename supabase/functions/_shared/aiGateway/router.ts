import type { AiGatewayRequest, AiGatewayResponse, AiProviderAdapter, ModelProfile } from './types.ts';
import { LMStudioAdapter } from './lmStudioAdapter.ts';

// Deno mirror of src/core/ai-gateway/router.ts — wires the LM Studio
// adapter and applies request defaults. Cloud-fallback retry stub stays
// non-functional until the OpenAI/Anthropic adapter lands.

const DEFAULTS = {
  timeoutMs:   8_000,
  maxTokens:   1200,
  temperature: 0.2,
};

const PROVIDER_BY_PROFILE: Record<ModelProfile, 'lm_studio' | 'openai'> = {
  'fast-local':     'lm_studio',
  'quality-local':  'lm_studio',
  'strict-json':    'lm_studio',
  'embed-default':  'lm_studio',
  'cloud-fallback': 'openai',
};

export interface ServerAiGatewayDeps {
  lmStudio?: AiProviderAdapter;
  /** Env-resolved LM Studio base URL. */
  lmStudioBaseUrl: string;
  /** Env-resolved LM Studio API key. */
  lmStudioApiKey?: string;
}

export class ServerAiGateway {
  private readonly lmStudio: AiProviderAdapter;

  constructor(deps: ServerAiGatewayDeps) {
    this.lmStudio = deps.lmStudio ?? new LMStudioAdapter({
      baseUrl: deps.lmStudioBaseUrl,
      apiKey:  deps.lmStudioApiKey,
    });
  }

  health() {
    return this.lmStudio.health();
  }

  generate(request: AiGatewayRequest): Promise<AiGatewayResponse<string>> {
    return this.resolveAdapter(request.model_profile).generate(this.withDefaults(request));
  }

  extractJson<T>(request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    return this.resolveAdapter(request.model_profile).extractJson<T>(this.withDefaults(request));
  }

  embed(request: AiGatewayRequest) {
    return this.resolveAdapter(request.model_profile).embed(this.withDefaults(request));
  }

  private resolveAdapter(profile: ModelProfile): AiProviderAdapter {
    if (PROVIDER_BY_PROFILE[profile] === 'lm_studio') return this.lmStudio;
    throw new Error(`Provider not implemented for profile: ${profile}`);
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
}

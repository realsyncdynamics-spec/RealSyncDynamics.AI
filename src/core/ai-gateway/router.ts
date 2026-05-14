import type { AiGatewayRequest, AiGatewayResponse, AiProviderAdapter } from './types';
import { LMStudioAdapter, type LmStudioConfig } from './providers/lmStudioAdapter';
import { aiGatewayConfig } from './config';

// AiGateway — single seam between product code and inference. Routes by
// model_profile, applies defaults, runs the optional cloud-fallback when
// a local profile errors out. Product code MUST NOT instantiate an
// adapter directly.
//
// NOTE: this lives at `router.ts` (not `gateway.ts` as the original spec
// proposed) because the legacy `gateway.ts` in this directory is still
// used by KodeeView + CreatorDashboard. The two coexist until the
// integration PR replaces them.

export interface AiGatewayDeps {
  /** Inject a custom LM Studio adapter (DI for tests + Edge Function). */
  lmStudio?: AiProviderAdapter;
  /** Override the LM Studio adapter config when constructing the default. */
  lmStudioConfig?: Partial<LmStudioConfig>;
}

export class AiGateway {
  private readonly lmStudio: AiProviderAdapter;

  constructor(deps: AiGatewayDeps = {}) {
    this.lmStudio = deps.lmStudio ?? new LMStudioAdapter({
      baseUrl:      deps.lmStudioConfig?.baseUrl      ?? aiGatewayConfig.providers.lm_studio.baseUrl,
      apiKey:       deps.lmStudioConfig?.apiKey       ?? aiGatewayConfig.providers.lm_studio.apiKey,
      defaultModel: deps.lmStudioConfig?.defaultModel,
      fetchImpl:    deps.lmStudioConfig?.fetchImpl,
    });
  }

  health() {
    return this.lmStudio.health();
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

  private resolveAdapter(profile: AiGatewayRequest['model_profile']): AiProviderAdapter {
    const profileConfig = aiGatewayConfig.modelProfiles[profile];
    if (profileConfig.provider === 'lm_studio') return this.lmStudio;
    throw new Error(`Provider not implemented for profile: ${profile}`);
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
   * Cloud-fallback retry stub — wired in a follow-up PR when the
   * OpenAI/Anthropic adapter lands. For now this is a structural seam
   * only and any error from the primary adapter propagates.
   */
  private async withFallback<T>(
    _request: AiGatewayRequest,
    run: () => Promise<AiGatewayResponse<T>>,
  ): Promise<AiGatewayResponse<T>> {
    return run();
  }
}

export const aiGateway = new AiGateway();

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

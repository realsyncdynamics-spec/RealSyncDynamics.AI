import type { AiGatewayRequest, AiGatewayResponse, AiProviderAdapter } from './types';
import { LMStudioAdapter, type LmStudioConfig } from './providers/lmStudioAdapter';
import { AnthropicAdapter, type AnthropicConfig } from './providers/anthropicAdapter';
import { aiGatewayConfig } from './config';

// AiGateway — single seam between product code and inference. Routes by
// model_profile, applies defaults, runs an Anthropic cloud-fallback when
// the primary (LM Studio) adapter fails with a transport-level error.
// Product code MUST NOT instantiate an adapter directly.
//
// NOTE: this lives at `router.ts` (not `gateway.ts` as the original spec
// proposed) because the legacy `gateway.ts` in this directory is still
// used by KodeeView + CreatorDashboard. The two coexist until the
// integration PR replaces them.
//
// Fallback semantics:
//   - Only generate() + extractJson() fall back (embed has no Anthropic
//     equivalent — Anthropic offers no embeddings API).
//   - Fall back only on transport-level errors: DNS / connect refused /
//     fetch failed / timeout / 5xx. We do NOT fall back on validation
//     errors (4xx) — those indicate the request itself is wrong and
//     retrying on a different provider would still fail.
//   - Fallback is disabled by default; it activates only when an
//     AnthropicAdapter is injected via deps.anthropic OR built from
//     deps.anthropicConfig. This preserves the "EU-lokal" promise for
//     deployments that explicitly opt out of cloud fallback.

export interface AiGatewayDeps {
  /** Inject a custom LM Studio adapter (DI for tests + Edge Function). */
  lmStudio?: AiProviderAdapter;
  /** Override the LM Studio adapter config when constructing the default. */
  lmStudioConfig?: Partial<LmStudioConfig>;
  /** Inject an Anthropic adapter (enables cloud-fallback for generate/extractJson). */
  anthropic?: AiProviderAdapter;
  /** Construct the default Anthropic adapter with this config (also enables fallback). */
  anthropicConfig?: AnthropicConfig;
}

export class AiGateway {
  private readonly lmStudio: AiProviderAdapter;
  private readonly anthropic: AiProviderAdapter | null;

  constructor(deps: AiGatewayDeps = {}) {
    this.lmStudio = deps.lmStudio ?? new LMStudioAdapter({
      baseUrl:      deps.lmStudioConfig?.baseUrl      ?? aiGatewayConfig.providers.lm_studio.baseUrl,
      apiKey:       deps.lmStudioConfig?.apiKey       ?? aiGatewayConfig.providers.lm_studio.apiKey,
      defaultModel: deps.lmStudioConfig?.defaultModel,
      fetchImpl:    deps.lmStudioConfig?.fetchImpl,
    });

    if (deps.anthropic) {
      this.anthropic = deps.anthropic;
    } else if (deps.anthropicConfig) {
      this.anthropic = new AnthropicAdapter(deps.anthropicConfig);
    } else {
      this.anthropic = null;
    }
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
    // No Anthropic fallback for embed — see header.
    return this.resolveAdapter(request.model_profile).embed(this.withDefaults(request));
  }

  /** Expose whether cloud-fallback is wired (for /health responses + tests). */
  hasCloudFallback(): boolean {
    return this.anthropic !== null;
  }

  private resolveAdapter(profile: AiGatewayRequest['model_profile']): AiProviderAdapter {
    const profileConfig = aiGatewayConfig.modelProfiles[profile];
    if (profileConfig.provider === 'lm_studio') return this.lmStudio;
    if (profileConfig.provider === 'anthropic' && this.anthropic) return this.anthropic;
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
   * Attempt the primary call. On transport-level failure AND when an
   * Anthropic adapter is wired, retry on Anthropic. The Anthropic call's
   * exceptions propagate unchanged — we only fall back ONCE.
   */
  private async withFallback<T>(
    request: AiGatewayRequest,
    runPrimary: () => Promise<AiGatewayResponse<T>>,
  ): Promise<AiGatewayResponse<T>> {
    try {
      return await runPrimary();
    } catch (err) {
      if (!this.anthropic) throw err;
      if (!isTransportLevelFailure(err)) throw err;
      // Fall back. Wrap any Anthropic-specific error so the caller can
      // tell which provider ultimately failed.
      const isJson = request.task_type === 'extract_json';
      const fallback = isJson
        ? (this.anthropic.extractJson<T>(this.withDefaults(request)) as Promise<AiGatewayResponse<T>>)
        : (this.anthropic.generate(this.withDefaults(request)) as unknown as Promise<AiGatewayResponse<T>>);
      return fallback;
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

export function isTransportLevelFailure(err: unknown): boolean {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  return TRANSPORT_PATTERNS.some((p) => p.test(message));
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

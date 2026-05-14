import type { ModelProfile, ProviderId } from './types';

// AI Gateway config — provider endpoints, model-profile routing, defaults.
//
// IMPORTANT: this module is shared between client and server. Anything
// secret-looking on the server side (API keys, internal URLs) MUST be
// resolved via Deno.env in the Edge Function, NEVER via VITE_* in the
// browser. The fields below carry only public hints for build-time
// awareness.

export const aiGatewayConfig = {
  providers: {
    lm_studio: {
      /**
       * Browser-side hint. The Edge Function reads `LM_STUDIO_BASE_URL`
       * from Deno.env. The `VITE_*` fallback exists so a developer can
       * point the React app at a local LM Studio for dev pages, but the
       * production AI Gateway always goes through the Edge Function.
       */
      baseUrl: (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_LM_STUDIO_BASE_URL) ?? 'http://localhost:1234/v1',
      apiKey:  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_LM_STUDIO_API_KEY)  ?? 'lm-studio',
      healthcheckPath: '/models',
    },
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      apiKeyEnv: 'OPENAI_API_KEY',
    },
    anthropic: {
      apiKeyEnv: 'ANTHROPIC_API_KEY',
    },
  },

  modelProfiles: {
    'fast-local': {
      provider: 'lm_studio' as ProviderId,
      modelSelector: 'first_available' as const,
      fallbackProfile: 'cloud-fallback' as ModelProfile | null,
    },
    'quality-local': {
      provider: 'lm_studio' as ProviderId,
      modelSelector: 'largest_available' as const,
      fallbackProfile: 'cloud-fallback' as ModelProfile | null,
    },
    'strict-json': {
      provider: 'lm_studio' as ProviderId,
      modelSelector: 'first_available' as const,
      fallbackProfile: 'cloud-fallback' as ModelProfile | null,
    },
    'embed-default': {
      provider: 'lm_studio' as ProviderId,
      modelSelector: 'embedding_available' as const,
      fallbackProfile: null,
    },
    'cloud-fallback': {
      provider: 'openai' as ProviderId,
      model: 'gpt-4.1-mini',
      fallbackProfile: null,
    },
  } satisfies Record<ModelProfile, {
    provider: ProviderId;
    modelSelector?: 'first_available' | 'largest_available' | 'embedding_available';
    model?: string;
    fallbackProfile: ModelProfile | null;
  }>,

  defaults: {
    timeoutMs:  8_000,
    maxTokens:  1200,
    temperature: 0.2,
  },
} as const;

export type AiGatewayConfig = typeof aiGatewayConfig;

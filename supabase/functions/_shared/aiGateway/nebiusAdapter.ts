import type {
  AiGatewayRequest,
  AiGatewayResponse,
  AiProviderAdapter,
  AiProviderHealth,
  AiStreamChunk,
} from './types.ts';
import { OpenAIAdapter } from './openaiAdapter.ts';

// Nebius Token Factory — OpenAI-kompatibler Inferenz-Anbieter (Gateway v2).
// Server-only, reines HTTP über den bestehenden OpenAIAdapter.
//
// MP-0-Einordnung: Nebius ist ein EXTERNER Anbieter, kein selbst betriebener
// Endpunkt. Residency daher `cloud` (siehe CLOUD_PROVIDERS in callEvidence.ts),
// niemals `eu_local`. Der Adapter meldet sich überall als `nebius`, damit
// Evidence, Usage und Art.-50-Offenlegung den echten Verarbeiter nennen.
//
// Aktiviert nur, wenn ai-gateway mit AI_GATEWAY_PROVIDER=nebius läuft und
// NEBIUS_API_KEY gesetzt ist (Edge-Secret oder Vault). Zero Data Retention
// wird im Nebius-Konto eingeschaltet, nicht pro Request.

export const NEBIUS_DEFAULT_BASE_URL = 'https://api.tokenfactory.eu-south1.nebius.com';
export const NEBIUS_DEFAULT_MODEL = 'deepseek-ai/DeepSeek-V4.1-Flash-1017-fast';

export interface NebiusConfig {
  apiKey: string;
  model?: string;
  embeddingModel?: string;
  /** Ohne `/v1` — der OpenAIAdapter hängt `/v1/...` selbst an. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/** Normalisiert die Basis-URL: kein abschließender Slash, kein `/v1`-Suffix. */
export function normalizeNebiusBaseUrl(raw: string | undefined | null): string {
  const value = (raw ?? '').trim() || NEBIUS_DEFAULT_BASE_URL;
  return value.replace(/\/+$/, '').replace(/\/v1$/i, '');
}

function relabelError(err: unknown): never {
  if (err instanceof Error) {
    const msg = err.message.replace(/OpenAI/g, 'Nebius');
    throw new Error(msg);
  }
  throw err;
}

export class NebiusAdapter implements AiProviderAdapter {
  readonly id = 'nebius' as const;
  private readonly inner: OpenAIAdapter;
  private readonly model: string;

  constructor(private readonly config: NebiusConfig) {
    this.model = config.model?.trim() || NEBIUS_DEFAULT_MODEL;
    this.inner = new OpenAIAdapter({
      apiKey: config.apiKey,
      model: this.model,
      embeddingModel: config.embeddingModel,
      baseUrl: normalizeNebiusBaseUrl(config.baseUrl),
      fetchImpl: config.fetchImpl,
    });
  }

  health(): Promise<AiProviderHealth> {
    if (!this.config.apiKey) {
      return Promise.resolve({ ok: false, error: 'NEBIUS_API_KEY not set' });
    }
    const models = [this.model];
    if (this.config.embeddingModel) models.push(this.config.embeddingModel);
    return Promise.resolve({ ok: true, models });
  }

  async generate(request: AiGatewayRequest): Promise<AiGatewayResponse<string>> {
    try {
      return { ...(await this.inner.generate(request)), provider: 'nebius' };
    } catch (err) {
      relabelError(err);
    }
  }

  async extractJson<T>(request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    try {
      return { ...(await this.inner.extractJson<T>(request)), provider: 'nebius' };
    } catch (err) {
      relabelError(err);
    }
  }

  async embed(request: AiGatewayRequest): Promise<AiGatewayResponse<number[]>> {
    if (!this.config.embeddingModel) {
      throw new Error('NebiusAdapter.embed: NEBIUS_EMBEDDING_MODEL not configured');
    }
    try {
      return { ...(await this.inner.embed(request)), provider: 'nebius' };
    } catch (err) {
      relabelError(err);
    }
  }

  async *generateStream(request: AiGatewayRequest): AsyncIterable<AiStreamChunk> {
    try {
      for await (const chunk of this.inner.generateStream(request)) {
        yield { ...chunk, provider: 'nebius' };
      }
    } catch (err) {
      relabelError(err);
    }
  }
}

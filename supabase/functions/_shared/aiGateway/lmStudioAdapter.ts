import type {
  AiGatewayRequest,
  AiGatewayResponse,
  AiProviderAdapter,
  AiProviderHealth,
} from './types.ts';

// Deno mirror of src/core/ai-gateway/providers/lmStudioAdapter.ts. Server-
// only by definition (runs in the Supabase Edge Function), so no browser
// guard needed.

export interface LmStudioConfig {
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
}

export class LMStudioAdapter implements AiProviderAdapter {
  readonly id = 'lm_studio' as const;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: LmStudioConfig) {
    // Bind to globalThis for parity with the frontend mirror.
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
  }

  async health(): Promise<AiProviderHealth> {
    try {
      const res = await this.fetchImpl(`${this.config.baseUrl}/models`, {
        headers: this.headers(),
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const json = (await res.json()) as { data?: Array<{ id?: string }> };
      const models = Array.isArray(json.data) ? json.data.map((m) => String(m.id ?? '')) : [];
      return { ok: true, models };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'unknown' };
    }
  }

  async generate(request: AiGatewayRequest): Promise<AiGatewayResponse<string>> {
    const started = Date.now();
    const model = await this.resolveModel();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms ?? 8_000);

    try {
      const res = await this.fetchImpl(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            ...(request.system_prompt ? [{ role: 'system', content: request.system_prompt }] : []),
            { role: 'user', content: request.input },
          ],
          temperature: request.temperature ?? 0.2,
          max_tokens:  request.max_tokens  ?? 1200,
        }),
      });

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        error?: { message?: string };
      };

      if (!res.ok) {
        throw new Error(json?.error?.message ?? `LM Studio HTTP ${res.status}`);
      }

      const text = json?.choices?.[0]?.message?.content ?? '';

      return {
        provider: 'lm_studio',
        model,
        profile:  request.model_profile,
        output:   text,
        raw_text: text,
        usage: {
          input_tokens:  json?.usage?.prompt_tokens,
          output_tokens: json?.usage?.completion_tokens,
          total_tokens:  json?.usage?.total_tokens,
        },
        trace_id:   request.trace_id ?? crypto.randomUUID(),
        latency_ms: Date.now() - started,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async extractJson<T>(request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    const response = await this.generate({
      ...request,
      system_prompt: `${request.system_prompt ?? ''}\n\nReturn only valid JSON. No markdown.`.trim(),
      temperature:   request.temperature ?? 0,
    });

    let parsed: T;
    try {
      parsed = JSON.parse(response.output) as T;
    } catch {
      throw new Error('LM Studio returned invalid JSON');
    }

    return { ...response, output: parsed };
  }

  async embed(request: AiGatewayRequest): Promise<AiGatewayResponse<number[]>> {
    const started = Date.now();
    // `embed-default` requires an embedding-capable model. Any other
    // profile falls back to first-available (no harm in trying — LM
    // Studio returns a clear error if the chosen model can't embed).
    const selector: ModelSelector = request.model_profile === 'embed-default' ? 'embedding' : 'first';
    const model = await this.resolveModel(selector);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms ?? 8_000);

    try {
      const res = await this.fetchImpl(`${this.config.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.headers(),
        signal: controller.signal,
        body: JSON.stringify({ model, input: request.input }),
      });

      const json = (await res.json()) as {
        data?: Array<{ embedding?: number[] }>;
        error?: { message?: string };
      };

      if (!res.ok) {
        throw new Error(json?.error?.message ?? `LM Studio embeddings HTTP ${res.status}`);
      }

      return {
        provider:   'lm_studio',
        model,
        profile:    request.model_profile,
        output:     json?.data?.[0]?.embedding ?? [],
        trace_id:   request.trace_id ?? crypto.randomUUID(),
        latency_ms: Date.now() - started,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      authorization:  `Bearer ${this.config.apiKey ?? 'lm-studio'}`,
    };
  }

  private async resolveModel(selector: ModelSelector = 'first'): Promise<string> {
    if (this.config.defaultModel) return this.config.defaultModel;
    const health = await this.health();
    if (!health.ok || !health.models?.length) {
      throw new Error('No LM Studio model available');
    }
    if (selector === 'embedding') {
      const embedModel = health.models.find(isEmbeddingModelId);
      if (embedModel) return embedModel;
      throw new Error('No LM Studio embedding model available');
    }
    return health.models[0];
  }
}

type ModelSelector = 'first' | 'embedding';

function isEmbeddingModelId(id: string): boolean {
  const lower = id.toLowerCase();
  return (
    lower.includes('embed') ||
    lower.startsWith('bge') || lower.includes('/bge') ||
    lower.startsWith('e5-') || lower.includes('/e5-') ||
    lower.startsWith('gte-') || lower.includes('/gte-') ||
    lower.startsWith('mxbai') ||
    lower.startsWith('snowflake-arctic-embed')
  );
}

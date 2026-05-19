import type {
  AiGatewayRequest,
  AiGatewayResponse,
  AiProviderAdapter,
  AiProviderHealth,
} from './types.ts';

// Deno mirror of src/core/ai-gateway/providers/openaiAdapter.ts.
// Server-only. Pure HTTP, no SDK dependency.
//
// Provider position: second cloud-fallback after Anthropic. Operators
// who want the strictest EU-data-locality may skip OpenAI entirely
// (just don't set OPENAI_API_KEY in Vault).

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  embeddingModel?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface OpenAIChatResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { type?: string; message?: string; code?: string };
}

interface OpenAIEmbeddingResponse {
  data?: Array<{ embedding?: number[]; index?: number }>;
  model?: string;
  usage?: { prompt_tokens?: number; total_tokens?: number };
  error?: { type?: string; message?: string };
}

export class OpenAIAdapter implements AiProviderAdapter {
  readonly id = 'openai' as const;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl:   string;

  constructor(private readonly config: OpenAIConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
    this.baseUrl   = config.baseUrl   ?? 'https://api.openai.com';
  }

  health(): Promise<AiProviderHealth> {
    if (!this.config.apiKey) {
      return Promise.resolve({ ok: false, error: 'OPENAI_API_KEY not set' });
    }
    const models = [this.config.model];
    if (this.config.embeddingModel) models.push(this.config.embeddingModel);
    return Promise.resolve({ ok: true, models });
  }

  async generate(request: AiGatewayRequest): Promise<AiGatewayResponse<string>> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms ?? 8_000);

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        signal: controller.signal,
        body: JSON.stringify(this.buildChatBody(request)),
      });

      const json = (await res.json()) as OpenAIChatResponse;
      if (!res.ok) throw new Error(json?.error?.message ?? `OpenAI HTTP ${res.status}`);

      const text = json?.choices?.[0]?.message?.content ?? '';

      return {
        provider:  'openai',
        model:     json.model ?? this.config.model,
        profile:   request.model_profile,
        output:    text,
        raw_text:  text,
        usage: {
          input_tokens:  json.usage?.prompt_tokens,
          output_tokens: json.usage?.completion_tokens,
          total_tokens:  json.usage?.total_tokens,
        },
        trace_id:   request.trace_id ?? crypto.randomUUID(),
        latency_ms: Date.now() - started,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async extractJson<T>(request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms ?? 8_000);

    try {
      const body = this.buildChatBody({
        ...request,
        system_prompt: `${request.system_prompt ?? ''}\n\nReturn only valid JSON. No prose.`.trim(),
        temperature:   request.temperature ?? 0,
      });
      body.response_format = { type: 'json_object' };

      const res = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as OpenAIChatResponse;
      if (!res.ok) throw new Error(json?.error?.message ?? `OpenAI HTTP ${res.status}`);

      const text = json?.choices?.[0]?.message?.content ?? '';
      let parsed: T;
      try {
        parsed = JSON.parse(text) as T;
      } catch {
        throw new Error('OpenAI returned invalid JSON');
      }

      return {
        provider:  'openai',
        model:     json.model ?? this.config.model,
        profile:   request.model_profile,
        output:    parsed,
        raw_text:  text,
        usage: {
          input_tokens:  json.usage?.prompt_tokens,
          output_tokens: json.usage?.completion_tokens,
          total_tokens:  json.usage?.total_tokens,
        },
        trace_id:   request.trace_id ?? crypto.randomUUID(),
        latency_ms: Date.now() - started,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async embed(request: AiGatewayRequest): Promise<AiGatewayResponse<number[]>> {
    if (!this.config.embeddingModel) {
      throw new Error('OpenAIAdapter.embed: embeddingModel not configured');
    }
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms ?? 8_000);

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/v1/embeddings`, {
        method: 'POST',
        headers: this.headers(),
        signal: controller.signal,
        body: JSON.stringify({ model: this.config.embeddingModel, input: request.input }),
      });
      const json = (await res.json()) as OpenAIEmbeddingResponse;
      if (!res.ok) throw new Error(json?.error?.message ?? `OpenAI HTTP ${res.status}`);

      const vec = json.data?.[0]?.embedding ?? [];
      return {
        provider:   'openai',
        model:      json.model ?? this.config.embeddingModel,
        profile:    request.model_profile,
        output:     vec,
        usage: {
          input_tokens:  json.usage?.prompt_tokens,
          total_tokens:  json.usage?.total_tokens,
        },
        trace_id:   request.trace_id ?? crypto.randomUUID(),
        latency_ms: Date.now() - started,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private headers(): Record<string, string> {
    return {
      'content-type':   'application/json',
      'authorization':  `Bearer ${this.config.apiKey}`,
    };
  }

  private buildChatBody(request: AiGatewayRequest): Record<string, unknown> {
    return {
      model:       this.config.model,
      messages: [
        ...(request.system_prompt
          ? [{ role: 'system', content: request.system_prompt }]
          : []),
        { role: 'user', content: request.input },
      ],
      max_tokens:  request.max_tokens ?? 1200,
      temperature: request.temperature ?? 0.2,
    };
  }
}

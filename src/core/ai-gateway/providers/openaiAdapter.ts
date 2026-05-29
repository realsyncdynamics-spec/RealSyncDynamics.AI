import type {
  AiGatewayRequest,
  AiGatewayResponse,
  AiProviderAdapter,
  AiProviderHealth,
} from '../types';

// OpenAI adapter — implements AiProviderAdapter against OpenAI's REST
// API. Pure HTTP, no SDK dependency. Mirrors LMStudioAdapter shape so
// the OpenAI-compat /v1/chat/completions wire format we send to LM
// Studio is the SAME wire format we send to OpenAI — only the base URL
// and auth header differ.
//
// SERVER-ONLY in production. The API key is read from Vault via
// supabase/functions/ai-gateway/index.ts and passed to the constructor.
//
// Provider position: this is the SECOND cloud-fallback after Anthropic.
// Operators with strict EU-data-locality requirements may choose to
// configure OPENAI_API_KEY alongside ANTHROPIC_API_KEY; the router tries
// Anthropic first (EU-region-pinned via Anthropic's EU endpoint where
// applicable), then OpenAI as the final safety-net.

export interface OpenAIConfig {
  apiKey: string;
  /** Model id, e.g. 'gpt-4.1-mini'. */
  model: string;
  /** Embedding model id, e.g. 'text-embedding-3-small'. Required only when embed() is called. */
  embeddingModel?: string;
  /** API base URL. Default 'https://api.openai.com'. EU-pinned tenants may override. */
  baseUrl?: string;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

interface OpenAIChatResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
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
    // OpenAI has no free unauthenticated health endpoint — a real call
    // costs tokens. Treat "API key present" as healthy and let actual
    // call-paths surface errors.
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

      if (!res.ok) {
        throw new Error(json?.error?.message ?? `OpenAI HTTP ${res.status}`);
      }

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
        trace_id:   request.trace_id ?? cryptoRandomUUID(),
        latency_ms: Date.now() - started,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async extractJson<T>(request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    // OpenAI supports response_format: { type: 'json_object' } natively.
    // We use it when available to skip the markdown-strip dance.
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
        trace_id:   request.trace_id ?? cryptoRandomUUID(),
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
        body: JSON.stringify({
          model: this.config.embeddingModel,
          input: request.input,
        }),
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
        trace_id:   request.trace_id ?? cryptoRandomUUID(),
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

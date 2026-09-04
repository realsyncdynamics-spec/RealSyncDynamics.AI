import type {
  AiGatewayRequest,
  AiGatewayResponse,
  AiProviderAdapter,
  AiProviderHealth,
} from './types.ts';

// Ollama adapter — server-only, pure HTTP, no SDK.
//
// Talks to a local/EU-hosted Ollama daemon (OLLAMA_BASE_URL, default
// http://localhost:11434) over its documented REST API. This is the
// EU-local / on-prem fallback named in CLAUDE.md §2: inference stays on
// infrastructure the operator controls, so it carries locality 'eu' in the
// registry and needs no API key.
//
// Frontend mirror: src/core/ai-gateway/providers/ollamaAdapter.ts.

export interface OllamaConfig {
  model: string;
  embeddingModel?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface OllamaChatResponse {
  model?: string;
  message?: { role?: string; content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

interface OllamaEmbedResponse {
  embedding?: number[];
  error?: string;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

export class OllamaAdapter implements AiProviderAdapter {
  readonly id = 'ollama' as const;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly config: OllamaConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
    this.baseUrl = (config.baseUrl ?? 'http://localhost:11434').replace(/\/+$/, '');
  }

  async health(): Promise<AiProviderHealth> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/tags`, { method: 'GET' });
      if (!res.ok) return { ok: false, error: `Ollama HTTP ${res.status}` };
      const json = (await res.json()) as OllamaTagsResponse;
      const models = (json.models ?? []).map((m) => m.name ?? '').filter(Boolean);
      return { ok: true, models };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async generate(request: AiGatewayRequest): Promise<AiGatewayResponse<string>> {
    const { json, started } = await this.callChat(request, false);
    const text = json.message?.content ?? '';
    return this.toResponse(request, json.model ?? this.config.model, text, text, json, started);
  }

  async extractJson<T>(request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    const { json, started } = await this.callChat(
      {
        ...request,
        system_prompt: `${request.system_prompt ?? ''}\n\nReturn only valid JSON. No prose.`.trim(),
        temperature: request.temperature ?? 0,
      },
      true,
    );
    const text = json.message?.content ?? '';
    let parsed: T;
    try {
      parsed = JSON.parse(text) as T;
    } catch {
      throw new Error('Ollama returned invalid JSON');
    }
    return this.toResponse(request, json.model ?? this.config.model, parsed, text, json, started);
  }

  async embed(request: AiGatewayRequest): Promise<AiGatewayResponse<number[]>> {
    const model = this.config.embeddingModel ?? this.config.model;
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms ?? 8_000);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ model, prompt: request.input }),
      });
      const json = (await res.json()) as OllamaEmbedResponse;
      if (!res.ok) throw new Error(json?.error ?? `Ollama HTTP ${res.status}`);
      return {
        provider: 'ollama',
        model,
        profile: request.model_profile,
        output: json.embedding ?? [],
        trace_id: request.trace_id ?? crypto.randomUUID(),
        latency_ms: Date.now() - started,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callChat(
    request: AiGatewayRequest,
    jsonMode: boolean,
  ): Promise<{ json: OllamaChatResponse; started: number }> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms ?? 8_000);
    try {
      const body: Record<string, unknown> = {
        model: this.config.model,
        stream: false,
        messages: [
          ...(request.system_prompt ? [{ role: 'system', content: request.system_prompt }] : []),
          { role: 'user', content: request.input },
        ],
        options: {
          temperature: request.temperature ?? 0.2,
          num_predict: request.max_tokens ?? 1200,
        },
      };
      if (jsonMode) body.format = 'json';

      const res = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as OllamaChatResponse;
      if (!res.ok) throw new Error(json?.error ?? `Ollama HTTP ${res.status}`);
      return { json, started };
    } finally {
      clearTimeout(timeout);
    }
  }

  private toResponse<T>(
    request: AiGatewayRequest,
    model: string,
    output: T,
    rawText: string,
    json: OllamaChatResponse,
    started: number,
  ): AiGatewayResponse<T> {
    const input = json.prompt_eval_count;
    const out = json.eval_count;
    return {
      provider: 'ollama',
      model,
      profile: request.model_profile,
      output,
      raw_text: rawText,
      usage: {
        input_tokens: input,
        output_tokens: out,
        total_tokens: input !== undefined && out !== undefined ? input + out : undefined,
      },
      trace_id: request.trace_id ?? crypto.randomUUID(),
      latency_ms: Date.now() - started,
    };
  }
}

import type {
  AiGatewayRequest,
  AiGatewayResponse,
  AiProviderAdapter,
  AiProviderHealth,
} from '../types';

// Google GenAI (Gemini) adapter — server-only, pure HTTP, no SDK.
//
// Talks to the REGULAR public Generative Language API
// (generativelanguage.googleapis.com) with the deployment's own API key.
// No proxy, no MITM, no third-party client impersonation — the adapter is a
// plain fetch client against a documented endpoint.
//
// Position: an additional cloud provider in the registry. Operators with
// strict EU-locality requirements can simply not set GOOGLE_GENAI_API_KEY.
//
// Deno mirror: supabase/functions/_shared/aiGateway/googleGenAIAdapter.ts.

export interface GoogleGenAIConfig {
  apiKey: string;
  model: string;
  embeddingModel?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface GeminiPart {
  text?: string;
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { role?: string; parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { code?: number; message?: string; status?: string };
}

interface GeminiEmbedResponse {
  embedding?: { values?: number[] };
  error?: { code?: number; message?: string; status?: string };
}

export class GoogleGenAIAdapter implements AiProviderAdapter {
  readonly id = 'google' as const;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly config: GoogleGenAIConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
    this.baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com';
  }

  health(): Promise<AiProviderHealth> {
    if (!this.config.apiKey) {
      return Promise.resolve({ ok: false, error: 'GOOGLE_GENAI_API_KEY not set' });
    }
    const models = [this.config.model];
    if (this.config.embeddingModel) models.push(this.config.embeddingModel);
    return Promise.resolve({ ok: true, models });
  }

  async generate(request: AiGatewayRequest): Promise<AiGatewayResponse<string>> {
    const { json, started } = await this.callGenerate(request, false);
    const text = this.firstText(json);
    return this.toResponse(request, this.config.model, text, text, json.usageMetadata, started);
  }

  async extractJson<T>(request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    const { json, started } = await this.callGenerate(
      {
        ...request,
        system_prompt: `${request.system_prompt ?? ''}\n\nReturn only valid JSON. No prose.`.trim(),
        temperature: request.temperature ?? 0,
      },
      true,
    );
    const text = this.firstText(json);
    let parsed: T;
    try {
      parsed = JSON.parse(text) as T;
    } catch {
      throw new Error('Google GenAI returned invalid JSON');
    }
    return this.toResponse(request, this.config.model, parsed, text, json.usageMetadata, started);
  }

  async embed(request: AiGatewayRequest): Promise<AiGatewayResponse<number[]>> {
    if (!this.config.embeddingModel) {
      throw new Error('GoogleGenAIAdapter.embed: embeddingModel not configured');
    }
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms ?? 8_000);
    try {
      const url = `${this.baseUrl}/v1beta/models/${this.config.embeddingModel}:embedContent?key=${encodeURIComponent(this.config.apiKey)}`;
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: `models/${this.config.embeddingModel}`,
          content: { parts: [{ text: request.input }] },
        }),
      });
      const json = (await res.json()) as GeminiEmbedResponse;
      if (!res.ok) throw new Error(json?.error?.message ?? `Google GenAI HTTP ${res.status}`);
      return {
        provider: 'google',
        model: this.config.embeddingModel,
        profile: request.model_profile,
        output: json.embedding?.values ?? [],
        trace_id: request.trace_id ?? crypto.randomUUID(),
        latency_ms: Date.now() - started,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callGenerate(
    request: AiGatewayRequest,
    jsonMode: boolean,
  ): Promise<{ json: GeminiGenerateResponse; started: number }> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms ?? 8_000);
    try {
      const url = `${this.baseUrl}/v1beta/models/${this.config.model}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`;
      const generationConfig: Record<string, unknown> = {
        maxOutputTokens: request.max_tokens ?? 1200,
        temperature: request.temperature ?? 0.2,
      };
      if (jsonMode) generationConfig.responseMimeType = 'application/json';

      const body: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: request.input }] }],
        generationConfig,
      };
      if (request.system_prompt) {
        body.systemInstruction = { parts: [{ text: request.system_prompt }] };
      }

      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as GeminiGenerateResponse;
      if (!res.ok) throw new Error(json?.error?.message ?? `Google GenAI HTTP ${res.status}`);
      return { json, started };
    } finally {
      clearTimeout(timeout);
    }
  }

  private firstText(json: GeminiGenerateResponse): string {
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p) => p.text ?? '').join('');
  }

  private toResponse<T>(
    request: AiGatewayRequest,
    model: string,
    output: T,
    rawText: string,
    usage: GeminiGenerateResponse['usageMetadata'],
    started: number,
  ): AiGatewayResponse<T> {
    return {
      provider: 'google',
      model,
      profile: request.model_profile,
      output,
      raw_text: rawText,
      usage: {
        input_tokens: usage?.promptTokenCount,
        output_tokens: usage?.candidatesTokenCount,
        total_tokens: usage?.totalTokenCount,
      },
      trace_id: request.trace_id ?? crypto.randomUUID(),
      latency_ms: Date.now() - started,
    };
  }
}

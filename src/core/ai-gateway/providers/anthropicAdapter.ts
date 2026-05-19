import type {
  AiGatewayRequest,
  AiGatewayResponse,
  AiProviderAdapter,
  AiProviderHealth,
} from '../types';

// Anthropic adapter — implements AiProviderAdapter against the Anthropic
// Messages API (POST /v1/messages). Pure HTTP, no SDK dependency. Works
// from Node, Deno (Edge Function), and browser-test harnesses with
// jsdom + injected fetch.
//
// SERVER-ONLY in production. The API key is read from Vault via
// supabase/functions/ai-gateway/index.ts and passed to the constructor.
// The adapter itself does NOT read env — that's the caller's job.
//
// Embedding support: Anthropic does NOT offer first-party embeddings, so
// embed() throws ProviderUnsupported. The router should not route
// embedding requests here.

export interface AnthropicConfig {
  apiKey: string;
  /** Model id, e.g. 'claude-haiku-4-5-20251001'. */
  model: string;
  /** API base URL. Default 'https://api.anthropic.com'. */
  baseUrl?: string;
  /** Anthropic-Version header. Default '2023-06-01' (current stable). */
  apiVersion?: string;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

interface AnthropicMessagesResponse {
  id?: string;
  model?: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  error?: { type?: string; message?: string };
}

export class AnthropicAdapter implements AiProviderAdapter {
  readonly id = 'anthropic' as const;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl:    string;
  private readonly apiVersion: string;

  constructor(private readonly config: AnthropicConfig) {
    this.fetchImpl  = config.fetchImpl  ?? fetch.bind(globalThis);
    this.baseUrl    = config.baseUrl    ?? 'https://api.anthropic.com';
    this.apiVersion = config.apiVersion ?? '2023-06-01';
  }

  async health(): Promise<AiProviderHealth> {
    // Anthropic doesn't expose a free unauthenticated health endpoint, and
    // a real /v1/messages probe costs tokens. We treat "API key present"
    // as healthy and let actual call-paths surface errors. Models list is
    // hard-coded — the Anthropic SDK doesn't expose a discovery endpoint
    // either, so we mirror what the API publicly accepts as of the
    // 2023-06-01 API version.
    if (!this.config.apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY not set' };
    return { ok: true, models: [this.config.model] };
  }

  async generate(request: AiGatewayRequest): Promise<AiGatewayResponse<string>> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms ?? 8_000);

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: this.headers(),
        signal: controller.signal,
        body: JSON.stringify(this.buildBody(request)),
      });

      const json = (await res.json()) as AnthropicMessagesResponse;

      if (!res.ok) {
        throw new Error(json?.error?.message ?? `Anthropic HTTP ${res.status}`);
      }

      const text = (json.content ?? [])
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text as string)
        .join('\n');

      return {
        provider:  'anthropic',
        model:     json.model ?? this.config.model,
        profile:   request.model_profile,
        output:    text,
        raw_text:  text,
        usage: {
          input_tokens:
            (json.usage?.input_tokens ?? 0) +
            (json.usage?.cache_creation_input_tokens ?? 0),
          output_tokens: json.usage?.output_tokens,
          total_tokens:
            ((json.usage?.input_tokens ?? 0) +
             (json.usage?.cache_creation_input_tokens ?? 0)) +
            (json.usage?.output_tokens ?? 0),
        },
        trace_id:   request.trace_id ?? cryptoRandomUUID(),
        latency_ms: Date.now() - started,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async extractJson<T>(request: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    const response = await this.generate({
      ...request,
      system_prompt: `${request.system_prompt ?? ''}\n\nReturn only valid JSON. No markdown, no prose.`.trim(),
      temperature:   request.temperature ?? 0,
    });

    let parsed: T;
    try {
      parsed = JSON.parse(response.output) as T;
    } catch {
      throw new Error('Anthropic returned invalid JSON');
    }

    return { ...response, output: parsed };
  }

  async embed(_request: AiGatewayRequest): Promise<AiGatewayResponse<number[]>> {
    // Anthropic offers no first-party embeddings. Callers should route
    // embed-default to a provider that supports it (LM Studio with a
    // local embed model, or OpenAI's embeddings endpoint).
    throw new Error('AnthropicAdapter.embed: Anthropic offers no embeddings API; route embed-default elsewhere.');
  }

  private headers(): Record<string, string> {
    return {
      'content-type':      'application/json',
      'x-api-key':         this.config.apiKey,
      'anthropic-version': this.apiVersion,
    };
  }

  private buildBody(request: AiGatewayRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model:      this.config.model,
      max_tokens: request.max_tokens ?? 1200,
      messages:   [{ role: 'user', content: request.input }],
    };
    if (request.system_prompt) {
      // Cache the system prompt for repeated tool invocations (matches
      // the pattern in supabase/functions/_shared/providers.ts).
      body.system = [
        {
          type: 'text',
          text: request.system_prompt,
          cache_control: { type: 'ephemeral' },
        },
      ];
    }
    // Anthropic deprecated `temperature` for Claude 4.x+ models; passing
    // it returns 400 invalid_request_error. Only set it for older ids.
    if (!/^claude-(opus|sonnet|haiku)-4/.test(this.config.model)) {
      body.temperature = request.temperature ?? 0.2;
    }
    return body;
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

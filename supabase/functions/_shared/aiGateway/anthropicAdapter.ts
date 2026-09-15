import type {
  AiGatewayRequest,
  AiGatewayResponse,
  AiProviderAdapter,
  AiProviderHealth,
  AiStreamChunk,
} from './types.ts';
import { parseAnthropicSse } from './streamParse.ts';

// Deno mirror of src/core/ai-gateway/providers/anthropicAdapter.ts.
// Server-only (runs in the Edge Function). Pure HTTP — no @anthropic-ai/sdk
// dependency so the cold-start cost stays low and the bundle is identical
// to the LM Studio adapter's footprint.

export interface AnthropicConfig {
  apiKey: string;
  /** Model id, e.g. 'claude-haiku-4-5-20251001'. */
  model: string;
  /** API base URL. Default 'https://api.anthropic.com'. */
  baseUrl?: string;
  /** Anthropic-Version header. Default '2023-06-01'. */
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

/**
 * Anthropic removed the sampling parameters (`temperature`, `top_p`, `top_k`)
 * with the Claude 4.7 generation. Both directions of getting this wrong are
 * real defects:
 *
 *   - sending one to a model that removed it fails the whole request with
 *     HTTP 400 invalid_request_error;
 *   - omitting one where it is still supported silently discards the
 *     caller's intent — notably the `temperature: 0` that `extractJson()`
 *     sets to keep JSON extraction deterministic.
 *
 * So this is an explicit version check, not a `claude-*-4` prefix heuristic.
 *
 *   sampling supported : Opus 4.6/4.5/4.1/4, Sonnet 4.6/4.5, Haiku 4.5,
 *                        and the whole pre-4 line (claude-3*, claude-2*).
 *   sampling removed   : Opus 4.7 and newer, Sonnet 5, Opus 5,
 *                        Fable 5/5.1, Mythos 5/5.1.
 *
 * Unrecognised ids default to "removed". Anthropic has removed sampling in
 * every generation since 4.7, so an unknown id is far likelier to reject the
 * parameter than to need it — and the costs are asymmetric: guessing wrong
 * here loses a default sampling temperature, guessing wrong the other way
 * loses the entire request.
 */
export function supportsSamplingParams(model: string): boolean {
  const id = model.trim().toLowerCase();

  // Pre-4 ids put the version before the family (claude-3-5-sonnet-20241022,
  // claude-3.5-sonnet, claude-2.1) and all predate the removal.
  if (/^claude-\d/.test(id)) return true;
  if (id.startsWith('claude-instant')) return true;

  const m = /^claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:[-.](\d+))?/.exec(id);
  if (!m) return false;

  const [, family, majorRaw, minorRaw] = m;
  // Fable and Mythos exist only from the 5 generation onward.
  if (family === 'fable' || family === 'mythos') return false;

  const major = Number(majorRaw);
  const minor = minorRaw === undefined ? 0 : Number(minorRaw);
  if (major !== 4) return major < 4;
  return minor < 7;
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

  health(): Promise<AiProviderHealth> {
    // Anthropic has no free unauthenticated health endpoint. We treat
    // "API key present" as healthy; actual call-paths surface errors.
    if (!this.config.apiKey) {
      return Promise.resolve({ ok: false, error: 'ANTHROPIC_API_KEY not set' });
    }
    return Promise.resolve({ ok: true, models: [this.config.model] });
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
        trace_id:   request.trace_id ?? crypto.randomUUID(),
        latency_ms: Date.now() - started,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async *generateStream(request: AiGatewayRequest): AsyncIterable<AiStreamChunk> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms ?? 8_000);
    try {
      const body = this.buildBody(request);
      body.stream = true;
      const res = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: this.headers(),
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let message = `Anthropic HTTP ${res.status}`;
        try {
          const json = (await res.json()) as AnthropicMessagesResponse;
          if (json?.error?.message) message = json.error.message;
        } catch { /* keep */ }
        throw new Error(message);
      }
      if (!res.body) throw new Error('Anthropic stream empty');
      let usage: AiStreamChunk['usage'];
      let model = this.config.model;
      for await (const ev of parseAnthropicSse(res.body)) {
        if (ev.model) model = ev.model;
        if (ev.usage) usage = { ...usage, ...ev.usage };
        if (ev.text) yield { event: 'delta', text: ev.text, provider: 'anthropic', model };
      }
      yield {
        event: 'done',
        provider: 'anthropic',
        model,
        profile: request.model_profile,
        usage,
        trace_id: request.trace_id ?? crypto.randomUUID(),
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

  embed(_request: AiGatewayRequest): Promise<AiGatewayResponse<number[]>> {
    return Promise.reject(new Error(
      'AnthropicAdapter.embed: Anthropic offers no embeddings API; route embed-default elsewhere.',
    ));
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
      body.system = [
        {
          type: 'text',
          text: request.system_prompt,
          cache_control: { type: 'ephemeral' },
        },
      ];
    }
    // Sampling params are version-gated — see supportsSamplingParams().
    // On models that removed them, JSON determinism rests on the prompt
    // instruction extractJson() adds, because temperature cannot be sent.
    if (supportsSamplingParams(this.config.model)) {
      body.temperature = request.temperature ?? 0.2;
    }
    return body;
  }
}

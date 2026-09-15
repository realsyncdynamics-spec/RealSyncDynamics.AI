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

/**
 * Akzeptiert dieses Modell die Sampling-Parameter (`temperature`, `top_p`,
 * `top_k`)?
 *
 * ## Warum das eine eigene Funktion ist
 *
 * Vorher stand hier `!/^claude-(opus|sonnet|haiku)-4/.test(model)`, mit dem
 * Kommentar "Anthropic deprecated temperature for Claude 4.x+ models". Diese
 * Regel ist in BEIDE Richtungen falsch:
 *
 *   - Sie unterdrueckt den Parameter fuer Haiku 4.5 — das Standardmodell
 *     dieses Adapters. Haiku 4.5 akzeptiert ihn. Ein Aufrufer, der
 *     `temperature` setzt, bekam ihn also still verworfen. Dasselbe gilt
 *     fuer Opus 4.6 und Sonnet 4.6.
 *   - Sie unterdrueckt ihn NICHT fuer `claude-opus-5`, `claude-sonnet-5`
 *     oder die Fable-Familie, weil die Regex ein "-4" verlangt. Genau dort
 *     sind die Sampling-Parameter entfernt und die API antwortet mit
 *     HTTP 400. Der Fehler schlaegt also erst zu, wenn jemand das Modell
 *     wechselt — und dann sofort bei jedem Aufruf.
 *
 * Die Grenze verlaeuft bei 4.6: bis einschliesslich dahin werden die
 * Parameter akzeptiert, ab 4.7 sind sie entfernt.
 *
 * ## Verhalten bei Unbekanntem
 *
 * Unbekannte Familien und nicht parsbare Ids gelten als "unterstuetzt
 * nicht". Das ist die sichere Richtung: ein weggelassener Parameter kostet
 * hoechstens Steuerbarkeit, ein faelschlich gesendeter bricht den Aufruf
 * mit 400. Neue Modelle muessen hier bewusst eingetragen werden.
 *
 * Die Modell-Id selbst bleibt Sache der Konfiguration — diese Funktion
 * liest sie nur, sie schlaegt keine vor und aendert keine.
 */
export function supportsSamplingParams(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();

  // Alte Namensform (claude-3-5-sonnet-…, claude-3-opus-…): Familie steht
  // hinter der Version. Alles, was so heisst, ist Claude 3.x und nimmt die
  // Parameter an.
  if (/^claude-\d/.test(id)) return true;

  // Neue Form: claude-<familie>-<major>[-<minor>][-<datum>].
  // Der Minor ist ein- bis zweistellig; ein laengerer Zahlenblock ist ein
  // Datumssuffix, kein Minor — sonst laese man claude-sonnet-4-20250514
  // als Version 4.20250514.
  const teile = /^claude-(opus|sonnet|haiku)-(\d+)(?:-(\d{1,2}))?(?:-\d{3,})?$/.exec(id);
  if (!teile) return false;

  const version = Number(teile[2]) * 100 + Number(teile[3] ?? 0);
  return version <= 406;
}

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
    // Sampling-Parameter nur an Modelle, die sie annehmen — siehe
    // supportsSamplingParams(). Kommen spaeter top_p oder top_k dazu,
    // gehoeren sie in denselben Block.
    if (supportsSamplingParams(this.config.model)) {
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

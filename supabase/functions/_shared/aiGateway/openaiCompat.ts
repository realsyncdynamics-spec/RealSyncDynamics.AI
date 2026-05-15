import type {
  AiGatewayRequest,
  AiGatewayResponse,
  ModelProfile,
} from './types.ts';

// Deno mirror of src/core/ai-gateway/openaiCompat.ts. Keep in sync.

export const KNOWN_PROFILES: readonly ModelProfile[] = [
  'fast-local',
  'quality-local',
  'strict-json',
  'embed-default',
  'cloud-fallback',
];

export function routeOf(reqUrl: string): string {
  const u = new URL(reqUrl);
  const idx = u.pathname.indexOf('/ai-gateway');
  if (idx < 0) return u.pathname;
  return u.pathname.slice(idx + '/ai-gateway'.length) || '/';
}

// ── /v1/models response ───────────────────────────────────────────

export interface OpenAIModelEntry {
  id: ModelProfile;
  object: 'model';
  owned_by: string;
  created: number;
}

export interface OpenAIModelsResponse {
  object: 'list';
  data: OpenAIModelEntry[];
}

export function modelsResponse(now: number = Date.now()): OpenAIModelsResponse {
  const created = Math.floor(now / 1000);
  return {
    object: 'list',
    data: KNOWN_PROFILES.map((id) => ({
      id,
      object: 'model',
      owned_by: 'realsyncdynamics',
      created,
    })),
  };
}

// ── /v1/chat/completions request parsing ──────────────────────────

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface OpenAIChatRequest {
  model?: string;
  messages?: OpenAIChatMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type?: 'text' | 'json_object' };
  user?: string;
}

export type ParseChatResult =
  | { ok: true; request: AiGatewayRequest; wantsJson: boolean }
  | { ok: false; status: number; code: string; message: string };

export function parseChatRequest(body: OpenAIChatRequest): ParseChatResult {
  const profile = body.model as ModelProfile | undefined;
  if (!profile || !(KNOWN_PROFILES as readonly string[]).includes(profile)) {
    return {
      ok: false,
      status: 400,
      code: 'BAD_REQUEST',
      message: `model must be one of: ${KNOWN_PROFILES.join(', ')}`,
    };
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, status: 400, code: 'BAD_REQUEST', message: 'messages[] required' };
  }

  const systemPrompt = body.messages
    .filter((m) => m.role === 'system' && typeof m.content === 'string')
    .map((m) => m.content)
    .join('\n\n');

  const lastUser = [...body.messages]
    .reverse()
    .find((m) => m.role === 'user' && typeof m.content === 'string');
  if (!lastUser) {
    return { ok: false, status: 400, code: 'BAD_REQUEST', message: 'no user message in messages[]' };
  }

  const wantsJson = body.response_format?.type === 'json_object';

  const request: AiGatewayRequest = {
    feature:       'openai_compat',
    task_type:     wantsJson ? 'extract_json' : 'chat',
    model_profile: profile,
    input:         lastUser.content,
    system_prompt: systemPrompt || undefined,
    max_tokens:    body.max_tokens,
    temperature:   body.temperature,
    user_id:       body.user ?? null,
  };

  return { ok: true, request, wantsJson };
}

// ── /v1/chat/completions response formatting ──────────────────────

export interface OpenAIChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: 'assistant'; content: string };
    finish_reason: 'stop';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  _gateway: {
    provider: string;
    profile: ModelProfile;
    model: string;
    trace_id: string;
    latency_ms: number;
  };
}

export function formatChatResponse(
  response: AiGatewayResponse<unknown>,
  profile: ModelProfile,
  now: number = Date.now(),
): OpenAIChatResponse {
  const content = typeof response.output === 'string'
    ? response.output
    : JSON.stringify(response.output);

  return {
    id:      `chatcmpl-${response.trace_id}`,
    object:  'chat.completion',
    created: Math.floor(now / 1000),
    model:   profile,
    choices: [{
      index:         0,
      message:       { role: 'assistant', content },
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens:     response.usage?.input_tokens  ?? 0,
      completion_tokens: response.usage?.output_tokens ?? 0,
      total_tokens:      response.usage?.total_tokens  ?? 0,
    },
    _gateway: {
      provider:   response.provider,
      profile:    response.profile,
      model:      response.model,
      trace_id:   response.trace_id,
      latency_ms: response.latency_ms,
    },
  };
}

// ── Error mapping ─────────────────────────────────────────────────

export interface MappedError {
  status: number;
  code: string;
  message: string;
}

export function mapInferenceError(error: unknown): MappedError {
  const message = error instanceof Error ? error.message : 'unknown error';
  // Order matters: see comment in src/core/ai-gateway/openaiCompat.ts.
  if (/invalid JSON/i.test(message)) {
    return { status: 502, code: 'UPSTREAM_BAD_OUTPUT', message };
  }
  if (/LM Studio|No LM Studio|fetch failed|HTTP 5\d\d/i.test(message)) {
    return { status: 502, code: 'UPSTREAM_UNAVAILABLE', message };
  }
  return   { status: 500, code: 'INFERENCE_ERROR', message };
}

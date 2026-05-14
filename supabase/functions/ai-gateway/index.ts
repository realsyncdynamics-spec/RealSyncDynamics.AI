// ai-gateway — provider-neutral inference endpoint.
//
// Two compatible APIs on the same Supabase function:
//
//   A) Native op-based API (preferred for internal callers):
//      POST /functions/v1/ai-gateway
//      Body: { op, feature, task_type, model_profile, input, ... }
//
//   B) OpenAI-compatible shell (so any OpenAI SDK / client can talk to
//      the gateway without knowing the platform's vocabulary):
//      GET  /functions/v1/ai-gateway/v1/models
//      POST /functions/v1/ai-gateway/v1/chat/completions
//      Body: { model, messages, max_tokens, temperature, response_format }
//
// Both routes funnel through the same ServerAiGateway / LMStudioAdapter
// pipeline. The OpenAI shell is a thin translator — no extra inference
// path, no extra adapters.
//
// Reads `LM_STUDIO_BASE_URL` + `LM_STUDIO_API_KEY` from Deno.env. The
// LM Studio host is never reachable from the browser; the platform
// talks to this endpoint only.

import { ServerAiGateway } from '../_shared/aiGateway/router.ts';
import type {
  AiGatewayRequest,
  AiGatewayResponse,
  ModelProfile,
} from '../_shared/aiGateway/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const ALLOWED_OPS = new Set(['health', 'generate', 'extract_json', 'embed']);

const KNOWN_PROFILES: readonly ModelProfile[] = [
  'fast-local',
  'quality-local',
  'strict-json',
  'embed-default',
  'cloud-fallback',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const route = routeOf(req);

  try {
    // ── OpenAI-compatible shell ────────────────────────────────────
    if (route === '/v1/models' && req.method === 'GET') {
      return handleOpenAIModels();
    }
    if (route === '/v1/chat/completions' && req.method === 'POST') {
      return await handleOpenAIChatCompletions(req);
    }

    // ── Native op-based API ────────────────────────────────────────
    if ((route === '/' || route === '') && req.method === 'POST') {
      return await handleOpBased(req);
    }

    return jsonError(404, 'NOT_FOUND', `unknown route: ${req.method} ${route}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return jsonError(500, 'INFERENCE_ERROR', message);
  }
});

// ── Native op-based handler ───────────────────────────────────────

async function handleOpBased(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const op = String(body.op ?? '');
  if (!ALLOWED_OPS.has(op)) return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`);

  const gateway = buildGateway();
  if (gateway instanceof Response) return gateway;

  if (op === 'health') {
    const health = await gateway.health();
    return json({ ok: health.ok, ...health });
  }

  const request = body as unknown as AiGatewayRequest;
  if (!request.feature || !request.task_type || !request.model_profile || !request.input) {
    return jsonError(400, 'BAD_REQUEST', 'feature, task_type, model_profile and input are required');
  }

  if (op === 'generate')     return json({ ok: true, ...(await gateway.generate(request)) });
  if (op === 'extract_json') return json({ ok: true, ...(await gateway.extractJson(request)) });
  if (op === 'embed')        return json({ ok: true, ...(await gateway.embed(request)) });

  return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`);
}

// ── OpenAI-compat: GET /v1/models ─────────────────────────────────

function handleOpenAIModels(): Response {
  // We surface model PROFILES (fast-local, quality-local, …) here, not
  // the concrete LM Studio model id. The mapping profile → model is the
  // gateway's responsibility and intentionally hidden from callers.
  const data = KNOWN_PROFILES.map((id) => ({
    id,
    object:   'model',
    owned_by: 'realsyncdynamics',
    created:  Math.floor(Date.now() / 1000),
  }));
  return json({ object: 'list', data });
}

// ── OpenAI-compat: POST /v1/chat/completions ──────────────────────

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

interface OpenAIChatRequest {
  model?: string;
  messages?: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type?: 'text' | 'json_object' };
  user?: string;
}

async function handleOpenAIChatCompletions(req: Request): Promise<Response> {
  let body: OpenAIChatRequest;
  try {
    body = (await req.json()) as OpenAIChatRequest;
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const profile = body.model as ModelProfile | undefined;
  if (!profile || !KNOWN_PROFILES.includes(profile)) {
    return jsonError(400, 'BAD_REQUEST', `model must be one of: ${KNOWN_PROFILES.join(', ')}`);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonError(400, 'BAD_REQUEST', 'messages[] required');
  }

  const systemPrompt = body.messages
    .filter((m) => m.role === 'system' && typeof m.content === 'string')
    .map((m) => m.content)
    .join('\n\n');

  // Use the last user message as `input`. Multi-turn history isn't a
  // first-class concept of the native op-based API yet — that's a
  // follow-up.
  const lastUser = [...body.messages].reverse().find((m) => m.role === 'user' && typeof m.content === 'string');
  if (!lastUser) return jsonError(400, 'BAD_REQUEST', 'no user message in messages[]');

  const wantsJson = body.response_format?.type === 'json_object';

  const internalRequest: AiGatewayRequest = {
    feature:        'openai_compat',
    task_type:      wantsJson ? 'extract_json' : 'chat',
    model_profile:  profile,
    input:          lastUser.content,
    system_prompt:  systemPrompt || undefined,
    max_tokens:     body.max_tokens,
    temperature:    body.temperature,
    user_id:        body.user ?? null,
  };

  const gateway = buildGateway();
  if (gateway instanceof Response) return gateway;

  let response: AiGatewayResponse<unknown>;
  try {
    response = wantsJson
      ? await gateway.extractJson(internalRequest)
      : await gateway.generate(internalRequest);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    // LM Studio unreachable / model resolve failures → 502.
    if (/LM Studio|No LM Studio|fetch failed|HTTP 5\d\d/i.test(message)) {
      return jsonError(502, 'UPSTREAM_UNAVAILABLE', message);
    }
    if (/invalid JSON/i.test(message)) {
      return jsonError(502, 'UPSTREAM_BAD_OUTPUT', message);
    }
    throw error;
  }

  const content = typeof response.output === 'string'
    ? response.output
    : JSON.stringify(response.output);

  return json({
    id:      `chatcmpl-${response.trace_id}`,
    object:  'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model:   profile,
    choices: [{
      index:         0,
      message:       { role: 'assistant', content },
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens:     response.usage?.input_tokens     ?? 0,
      completion_tokens: response.usage?.output_tokens    ?? 0,
      total_tokens:      response.usage?.total_tokens     ?? 0,
    },
    // Custom field — useful for debugging without breaking OpenAI clients.
    _gateway: {
      provider:   response.provider,
      profile:    response.profile,
      model:      response.model,
      trace_id:   response.trace_id,
      latency_ms: response.latency_ms,
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────

function buildGateway(): ServerAiGateway | Response {
  const baseUrl = Deno.env.get('LM_STUDIO_BASE_URL');
  if (!baseUrl) {
    return jsonError(503, 'LM_STUDIO_NOT_CONFIGURED', 'LM_STUDIO_BASE_URL not set');
  }
  return new ServerAiGateway({
    lmStudioBaseUrl: baseUrl,
    lmStudioApiKey:  Deno.env.get('LM_STUDIO_API_KEY') ?? 'lm-studio',
  });
}

/**
 * Returns the request path *relative to /functions/v1/ai-gateway*.
 *   `/functions/v1/ai-gateway`                       → '/'
 *   `/functions/v1/ai-gateway/`                      → '/'
 *   `/functions/v1/ai-gateway/v1/models`             → '/v1/models'
 *   `/functions/v1/ai-gateway/v1/chat/completions`   → '/v1/chat/completions'
 */
function routeOf(req: Request): string {
  const u = new URL(req.url);
  const idx = u.pathname.indexOf('/ai-gateway');
  if (idx < 0) return u.pathname;
  const tail = u.pathname.slice(idx + '/ai-gateway'.length) || '/';
  return tail;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}

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
// pipeline. The OpenAI shell is a thin translator built on the pure
// functions in `_shared/aiGateway/openaiCompat.ts` (which is unit-tested
// from the frontend side via its `src/core/ai-gateway/openaiCompat.ts`
// mirror).

import { ServerAiGateway } from '../_shared/aiGateway/router.ts';
import type { AiGatewayRequest } from '../_shared/aiGateway/types.ts';
import {
  routeOf,
  modelsResponse,
  parseChatRequest,
  formatChatResponse,
  mapInferenceError,
  type OpenAIChatRequest,
} from '../_shared/aiGateway/openaiCompat.ts';
import {
  decideRateLimit,
  clientIp,
  type WindowState,
} from '../_shared/aiGateway/rateLimit.ts';
import { sha256Hex } from '../_shared/hash.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const ALLOWED_OPS = new Set(['health', 'generate', 'extract_json', 'embed']);

// Per-instance rate-limit windows. Cleared on cold-start which is fine:
// a bad actor has no cheap way to trigger a cold-start.
const MINUTE_WINDOWS = new Map<string, WindowState>();
const HOUR_WINDOWS   = new Map<string, WindowState>();

// Salt mixes into the IP hash so the stored keys aren't trivially
// derivable from the raw IP. Optional — falls back to a constant when
// not configured, which is still acceptable because the hash is only
// used as a Map key, never persisted or logged.
const IP_HASH_SALT = Deno.env.get('AI_GATEWAY_IP_HASH_SALT') ?? 'ai-gateway-default-salt';

async function enforceRateLimit(req: Request, feature: string): Promise<Response | null> {
  const ip = clientIp(req.headers);
  const ipHash = await sha256Hex(ip + ':' + IP_HASH_SALT);
  const decision = decideRateLimit({
    key: `${ipHash}:${feature}`,
    feature,
    now: Date.now(),
    minuteWindows: MINUTE_WINDOWS,
    hourWindows:   HOUR_WINDOWS,
  });
  if (decision.ok) return null;
  const retryAfterSec = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded (${decision.scope}). Retry after ${retryAfterSec}s.`,
        scope: decision.scope,
        retry_after_ms: decision.retryAfterMs,
      },
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'content-type': 'application/json',
        'retry-after': String(retryAfterSec),
      },
    },
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const route = routeOf(req.url);

  try {
    // OpenAI-compatible shell
    if (route === '/v1/models' && req.method === 'GET') {
      return json(modelsResponse());
    }
    if (route === '/v1/chat/completions' && req.method === 'POST') {
      return await handleOpenAIChatCompletions(req);
    }

    // Native op-based API
    if ((route === '/' || route === '') && req.method === 'POST') {
      return await handleOpBased(req);
    }

    return jsonError(404, 'NOT_FOUND', `unknown route: ${req.method} ${route}`);
  } catch (error) {
    const mapped = mapInferenceError(error);
    return jsonError(mapped.status, mapped.code, mapped.message);
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

  const gateway = await buildGateway();
  if (gateway instanceof Response) return gateway;

  if (op === 'health') {
    const health = await gateway.health();
    return json({ ok: health.ok, ...health });
  }

  const request = body as unknown as AiGatewayRequest;
  if (!request.feature || !request.task_type || !request.model_profile || !request.input) {
    return jsonError(400, 'BAD_REQUEST', 'feature, task_type, model_profile and input are required');
  }

  const limited = await enforceRateLimit(req, request.feature);
  if (limited) return limited;

  if (op === 'generate')     return json({ ok: true, ...(await gateway.generate(request)) });
  if (op === 'extract_json') return json({ ok: true, ...(await gateway.extractJson(request)) });
  if (op === 'embed')        return json({ ok: true, ...(await gateway.embed(request)) });

  return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`);
}

// ── OpenAI-compat: POST /v1/chat/completions ──────────────────────

async function handleOpenAIChatCompletions(req: Request): Promise<Response> {
  let body: OpenAIChatRequest;
  try {
    body = (await req.json()) as OpenAIChatRequest;
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const parsed = parseChatRequest(body);
  if (!parsed.ok) return jsonError(parsed.status, parsed.code, parsed.message);

  const limited = await enforceRateLimit(req, parsed.request.feature);
  if (limited) return limited;

  const gateway = await buildGateway();
  if (gateway instanceof Response) return gateway;

  try {
    const response = parsed.wantsJson
      ? await gateway.extractJson(parsed.request)
      : await gateway.generate(parsed.request);
    return json(formatChatResponse(response, parsed.request.model_profile));
  } catch (error) {
    const mapped = mapInferenceError(error);
    return jsonError(mapped.status, mapped.code, mapped.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────

// Anthropic fallback model — kept here (not in config.ts) because config.ts
// is browser-shared and must not hint at a default cloud model.
const ANTHROPIC_FALLBACK_MODEL =
  Deno.env.get('AI_GATEWAY_ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001';

async function buildGateway(): Promise<ServerAiGateway | Response> {
  const baseUrl = Deno.env.get('LM_STUDIO_BASE_URL');
  if (!baseUrl) {
    return jsonError(503, 'LM_STUDIO_NOT_CONFIGURED', 'LM_STUDIO_BASE_URL not set');
  }
  // Cloud fallback: optional. If ANTHROPIC_API_KEY is in Vault or env,
  // we wire the AnthropicAdapter so the router can recover from
  // LM-Studio transport failures (DNS error, 5xx, timeout). Without the
  // key the router behaves exactly as before (no fallback, errors
  // propagate).
  //
  // Vault-key name lookup: try BOTH uppercase ('ANTHROPIC_API_KEY' — the
  // env-var-style name used by ai-act-classify) AND lowercase
  // ('anthropic_api_key' — the convention in _shared/providers.ts). This
  // dual lookup is intentional: existing deployments may have the secret
  // under either name. Future deploys should use uppercase to match the
  // env-var convention from ai-act-classify.
  const anthropicKey =
    Deno.env.get('ANTHROPIC_API_KEY')
    ?? (await readVaultSecret('ANTHROPIC_API_KEY'))
    ?? (await readVaultSecret('anthropic_api_key'));
  return new ServerAiGateway({
    lmStudioBaseUrl: baseUrl,
    lmStudioApiKey:  Deno.env.get('LM_STUDIO_API_KEY') ?? 'lm-studio',
    anthropicConfig: anthropicKey
      ? { apiKey: anthropicKey, model: ANTHROPIC_FALLBACK_MODEL }
      : undefined,
  });
}

// Best-effort Vault read. Returns null on any failure so the gateway
// can still serve LM-Studio-only requests. Mirrors the pattern in
// supabase/functions/_shared/providers.ts.
async function readVaultSecret(name: string): Promise<string | null> {
  const url = Deno.env.get('SUPABASE_URL');
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !srk) return null;
  try {
    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    const admin = createClient(url, srk, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc('get_app_secret', { secret_name: name });
    if (error) return null;
    return typeof data === 'string' && data.length > 0 ? data : null;
  } catch {
    return null;
  }
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

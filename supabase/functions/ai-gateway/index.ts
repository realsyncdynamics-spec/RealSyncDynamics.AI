// ai-gateway — provider-neutral inference endpoint.
//
// POST /functions/v1/ai-gateway
// Body: {
//   op:           'health' | 'generate' | 'extract_json' | 'embed',
//   feature:      string,
//   task_type:    AiTaskType,
//   model_profile: ModelProfile,
//   input:        string,
//   system_prompt?: string,
//   ...
// }
//
// Reads `LM_STUDIO_BASE_URL` + `LM_STUDIO_API_KEY` from Deno.env. Never
// exposes the LM Studio host to the browser — the platform talks to this
// endpoint only.

import { ServerAiGateway } from '../_shared/aiGateway/router.ts';
import type { AiGatewayRequest } from '../_shared/aiGateway/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_OPS = new Set(['health', 'generate', 'extract_json', 'embed']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return jsonError(405, 'BAD_REQUEST', 'POST only');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const op = String(body.op ?? '');
  if (!ALLOWED_OPS.has(op)) return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`);

  const baseUrl = Deno.env.get('LM_STUDIO_BASE_URL');
  if (!baseUrl) return jsonError(503, 'LM_STUDIO_NOT_CONFIGURED', 'LM_STUDIO_BASE_URL not set');

  const gateway = new ServerAiGateway({
    lmStudioBaseUrl: baseUrl,
    lmStudioApiKey:  Deno.env.get('LM_STUDIO_API_KEY') ?? 'lm-studio',
  });

  try {
    if (op === 'health') {
      const health = await gateway.health();
      return json({ ok: health.ok, ...health });
    }

    const request = body as unknown as AiGatewayRequest;
    if (!request.feature || !request.task_type || !request.model_profile || !request.input) {
      return jsonError(400, 'BAD_REQUEST', 'feature, task_type, model_profile and input are required');
    }

    if (op === 'generate') {
      const response = await gateway.generate(request);
      return json({ ok: true, ...response });
    }

    if (op === 'extract_json') {
      const response = await gateway.extractJson(request);
      return json({ ok: true, ...response });
    }

    if (op === 'embed') {
      const response = await gateway.embed(request);
      return json({ ok: true, ...response });
    }

    return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return jsonError(500, 'INFERENCE_ERROR', message);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}

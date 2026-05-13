// Enterprise AI OS — dispatcher to run a single agent by id.
//
// POST /functions/v1/enterprise-ai-os-agents-run
// Body: { agentId, tenantId?, actor?, payload }
//
// Pure dispatcher, no DB writes. All risky actions return either
// `blocked` or `requires_approval` — no autonomous external effects.

import { runEnterpriseAgent, type AgentId } from '../_shared/enterprise-ai-os-agents.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  let body: { agentId?: string; tenantId?: string; actor?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid JSON' });
  }

  if (!body.agentId) return json(400, { error: 'agentId is required' });

  const result = runEnterpriseAgent({
    agentId: body.agentId as AgentId,
    tenantId: body.tenantId,
    actor: body.actor || 'system',
    payload: body.payload || {},
  });

  return json(200, result);
});

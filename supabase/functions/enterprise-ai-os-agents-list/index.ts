// Enterprise AI OS — list of agents.
//
// GET /functions/v1/enterprise-ai-os-agents-list
//
// Returns the static registry summary. Frontend should prefer importing
// `src/lib/enterprise-ai-os/agents/registry.ts` directly; this endpoint
// exists for external API consumers.

import { enterpriseAgents } from '../_shared/enterprise-ai-os-agents.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'GET')
    return new Response(JSON.stringify({ error: 'GET only' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  return new Response(JSON.stringify({ agents: enterpriseAgents }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});

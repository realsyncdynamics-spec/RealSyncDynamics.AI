// Enterprise AI OS — list of agents.
//
// GET /functions/v1/enterprise-ai-os-agents-list
//
// Returns the static registry summary. Frontend should prefer importing
// `src/lib/enterprise-ai-os/agents/registry.ts` directly; this endpoint
// exists for external API consumers.

import { enterpriseAgents } from '../_shared/enterprise-ai-os-agents.ts';
import { buildCorsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';

const corsHeaders = buildCorsHeaders('GET, OPTIONS');

Deno.serve((req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'GET') return jsonResponse({ error: 'GET only' }, 405, corsHeaders);
  return jsonResponse({ agents: enterpriseAgents }, 200, corsHeaders);
});

// enterprise-ai-os — Domänen-Router (Konsolidierung K1).
//
// Fasst die sieben öffentlichen enterprise-ai-os-*-Functions in einem
// Function-Slot zusammen (Runbook docs/runbooks/edge-function-konsolidierung.md):
//
//   POST /functions/v1/enterprise-ai-os/agents-run
//   GET  /functions/v1/enterprise-ai-os/agent-runs-list
//   GET  /functions/v1/enterprise-ai-os/agents-list
//   POST /functions/v1/enterprise-ai-os/discovery-intake
//   POST /functions/v1/enterprise-ai-os/evaluate
//   POST /functions/v1/enterprise-ai-os/feedback
//   POST /functions/v1/enterprise-ai-os/founding-access
//
// enterprise-ai-os-discovery-pending bleibt bewusst eigenständig: sie ist die
// einzige der Gruppe mit verify_jwt=true, und öffentliche und auth-gated
// Endpunkte gehören nicht in denselben Router (Runbook §2.2).
//
// Jeder Handler behandelt Preflight/Method selbst (unverändert aus den
// Einzel-Functions extrahiert) — der Router löst nur den Pfad auf.

import { jsonResponse } from '../_shared/gateway.ts';
import { resolveEndpoint } from './resolve.ts';
import { handle as agentsList } from './handlers/agents-list.ts';
import { handle as agentsRun } from './handlers/agents-run.ts';
import { handle as agentRunsList } from './handlers/agent-runs-list.ts';
import { handle as discoveryIntake } from './handlers/discovery-intake.ts';
import { handle as evaluate } from './handlers/evaluate.ts';
import { handle as feedback } from './handlers/feedback.ts';
import { handle as foundingAccess } from './handlers/founding-access.ts';

const routes: Record<string, (req: Request) => Response | Promise<Response>> = {
  'agents-list': agentsList,
  'agents-run': agentsRun,
  'agent-runs-list': agentRunsList,
  'discovery-intake': discoveryIntake,
  'evaluate': evaluate,
  'feedback': feedback,
  'founding-access': foundingAccess,
};

Deno.serve((req) => {
  const endpoint = resolveEndpoint(new URL(req.url).pathname);
  const handler = endpoint ? routes[endpoint] : undefined;
  if (!handler) {
    return jsonResponse(
      { error: 'unknown endpoint', endpoints: Object.keys(routes).sort() },
      404,
    );
  }
  return handler(req);
});

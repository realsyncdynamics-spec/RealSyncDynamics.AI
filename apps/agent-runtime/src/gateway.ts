import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { z } from 'zod';

import { findAgent, listAgents } from './agent-registry.js';
import { emitAuditEvent } from './audit-log.js';
import { loadEnv } from './env.js';
import { evaluate } from './policy-engine.js';
import type { RunAgentResponse } from './types.js';

const env = loadEnv();
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

/* ------------------------------------------------------------------ */
/* Auth-Middleware — Bearer-Token-Pflicht für /agents und /run-agent. */
/* ------------------------------------------------------------------ */

function requireBearerToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!env.apiToken) {
    // Nicht-Prod ohne Token: explizit ablehnen statt durchwinken,
    // damit Devs den Token sofort konfigurieren.
    res.status(503).json({
      ok: false,
      status: 'denied',
      reason: 'missing_token',
    });
    return;
  }

  const header = req.header('authorization') ?? '';
  const expected = `Bearer ${env.apiToken}`;
  if (header !== expected) {
    res.status(401).json({
      ok: false,
      status: 'denied',
      reason: 'missing_token',
    });
    return;
  }

  next();
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'realsync-agent-runtime', port: env.port });
});

app.get('/agents', requireBearerToken, (_req, res) => {
  res.json({ agents: listAgents() });
});

const runAgentSchema = z.object({
  tenantId: z.string().min(1),
  agentId: z.string().min(1),
  taskType: z.string().min(1),
  requestedTool: z.string().min(1),
  input: z.record(z.unknown()),
  requestId: z.string().min(1),
});

app.post('/run-agent', requireBearerToken, (req, res) => {
  const parsed = runAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      status: 'denied',
      reason: 'invalid_request',
    });
    return;
  }

  const request = parsed.data;
  const decision = evaluate(request);

  if (!decision.ok) {
    const auditEvent = emitAuditEvent({
      status: 'denied',
      reviewRequired: false,
      reason: decision.reason,
      request,
    });
    const body: RunAgentResponse = {
      ok: false,
      status: 'denied',
      reason: decision.reason,
      auditEvent,
    };
    res.status(403).json(body);
    return;
  }

  const agent = findAgent(request.agentId);
  // `decision.ok` impliziert, dass der Agent existiert — Defensive
  // hier nur für TypeScript-Narrowing.
  if (!agent) {
    res.status(500).json({
      ok: false,
      status: 'denied',
      reason: 'agent_not_found',
    });
    return;
  }

  const auditEvent = emitAuditEvent({
    status: 'accepted',
    reviewRequired: decision.reviewRequired,
    reason: null,
    request,
  });

  const body: RunAgentResponse = {
    ok: true,
    status: 'accepted',
    reviewRequired: decision.reviewRequired,
    agent: { id: agent.id, name: agent.name },
    auditEvent,
  };
  res.json(body);
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

app.listen(env.port, () => {
  process.stdout.write(
    `${JSON.stringify({
      event_type: 'service_boot',
      service: 'realsync-agent-runtime',
      port: env.port,
      node_env: env.nodeEnv,
      auth_enforced: Boolean(env.apiToken),
      timestamp: new Date().toISOString(),
    })}\n`,
  );
});

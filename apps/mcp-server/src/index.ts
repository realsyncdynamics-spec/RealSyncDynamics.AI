import Fastify from 'fastify';
import { testConnection } from './services/supabase.js';
import { authenticateRequest, logRequestUsage, requireScope } from './auth/api-key.js';
import { getQuotaState, secondsUntilQuotaReset } from './services/api-keys-db.js';
import { MctAuthContext } from './types/index.js';
import {
  listEvidence,
  getEvidence,
  verifyHashChain,
  searchEvidenceByControl,
} from './tools/evidence.js';
import { getGovernanceStatus, listControls, checkComplianceStatus } from './tools/governance.js';
import {
  handleMessage,
  isJsonRpcRequest,
  rpcError,
  RpcCode,
} from './mcp/protocol.js';
import { MCP_TOOLS, invokeTool } from './mcp/tools.js';

/** Wird im MCP-Handshake als serverInfo.version gemeldet. */
const SERVER_VERSION = '0.1.0';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

declare global {
  namespace FastifyInstance {
    interface FastifyRequest {
      user?: MctAuthContext;
    }
  }
}

async function start() {
  const fastify = Fastify({
    logger: true,
  });

  // Test Supabase connection at startup
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Failed to connect to Supabase. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  console.log('✓ Supabase connected');

  // Ohne Pepper lässt sich kein Key prüfen. Sofortiger Fehlstart statt eines
  // Dienstes, der erst beim ersten Request auffällt.
  if ((process.env.MCP_KEY_PEPPER ?? '').length < 32) {
    console.error('MCP_KEY_PEPPER fehlt oder ist kürzer als 32 Zeichen — Key-Prüfung nicht möglich.');
    process.exit(1);
  }
  console.log('✓ Key-Pepper vorhanden');

  // Auth middleware
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health') {
      return;
    }

    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    (request as any).user = auth;

    // Kontingent nach der Authentifizierung, vor jeder Arbeit. Der Plan
    // entscheidet zweifach: enthält er überhaupt API-Zugriff (ab Agency), und
    // ist das Monatskontingent noch offen? Beides steht in plan_catalog, der
    // aus shared/pricing.ts erzeugten Projektion.
    const quota = await getQuotaState(auth.tenantId);
    if (quota && !quota.allowed) {
      (request as any).quotaRejected = true;

      if (!quota.apiAccess) {
        return reply.code(403).send({
          error: 'PLAN_WITHOUT_API',
          message: `Der Plan "${quota.planKey}" enthält keinen API-Zugriff. MCP-Zugriff ist ab Agency verfügbar.`,
        });
      }

      const retryAfter = secondsUntilQuotaReset();
      return reply
        .code(429)
        .header('Retry-After', String(retryAfter))
        .send({
          error: 'QUOTA_EXCEEDED',
          message: `Monatskontingent ausgeschöpft (${quota.used} / ${quota.limitCalls}).`,
          retry_after_seconds: retryAfter,
        });
    }
  });

  // Prüfpfad: jeder authentifizierte Request wird protokolliert — zentral,
  // nicht in den einzelnen Tools. Nur hier stehen Statuscode und Latenz zur
  // Verfügung, und nur hier werden auch abgewiesene Requests (403, 500)
  // erfasst; ein Protokoll, das nur die erfolgreichen Fälle kennt, taugt
  // für den Nachweis nichts.
  fastify.addHook('onResponse', async (request, reply) => {
    if (request.url === '/health') {
      return;
    }
    await logRequestUsage(request, reply.statusCode, Math.round(reply.elapsedTime), {
      // Am Kontingent abgewiesen: gehört in den Prüfpfad, aber nicht in die
      // Verbrauchszahl — sonst zählt ein Agent in einer Schleife Aufrufe mit,
      // für die er nie eine Antwort bekommen hat.
      countAgainstQuota: (request as any).quotaRejected !== true,
    });
  });

  // Health check (no auth required)
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // ─── MCP-Protokoll ────────────────────────────────────────
  //
  // JSON-RPC 2.0 über POST. Auth, Scopes und Kontingent laufen über dieselben
  // Hooks wie die HTTP-Routen — der Transport ändert nichts an den Regeln.
  fastify.post('/mcp', async (request, reply) => {
    const auth = (request as any).user as MctAuthContext;
    const body = request.body;

    // Stapelverarbeitung: der Client darf mehrere Nachrichten auf einmal
    // schicken. Reihenfolge und Zuordnung laufen über die id.
    const messages = Array.isArray(body) ? body : [body];
    if (messages.length === 0) {
      return reply.code(400).send(rpcError(null, RpcCode.INVALID_REQUEST, 'Leerer Stapel'));
    }

    const ctx = {
      tools: MCP_TOOLS,
      invoke: (name: string, args: Record<string, unknown>) =>
        invokeTool(auth.tenantId, name, args),
      scopes: auth.scopes,
      serverName: 'realsync-mcp-governance',
      serverVersion: SERVER_VERSION,
    };

    const responses: unknown[] = [];
    for (const message of messages) {
      if (!isJsonRpcRequest(message)) {
        responses.push(rpcError(null, RpcCode.INVALID_REQUEST, 'Keine gültige JSON-RPC-Nachricht'));
        continue;
      }
      const answer = await handleMessage(message, ctx);
      if (answer) responses.push(answer);
    }

    // Bestand der Stapel nur aus Benachrichtigungen, gibt es nichts zu
    // antworten — 202 statt eines leeren Rumpfes.
    if (responses.length === 0) {
      return reply.code(202).send();
    }
    return Array.isArray(body) ? responses : responses[0];
  });

  // ─── Evidence API ─────────────────────────────────────────
  fastify.get('/evidence', { preHandler: requireScope('evidence.read') }, async (request, reply) => {
    const auth = (request as any).user as MctAuthContext;
    const { subject_ref, limit } = request.query as Record<string, any>;

    const evidence = await listEvidence(auth.tenantId, subject_ref, limit || 50);
    return { data: evidence, count: evidence.length };
  });

  fastify.get<{ Params: { id: string } }>('/evidence/:id', { preHandler: requireScope('evidence.read') }, async (request, reply) => {
    const auth = (request as any).user as MctAuthContext;
    const evidence = await getEvidence(auth.tenantId, request.params.id);

    if (!evidence) {
      return reply.code(404).send({ error: 'Evidence not found' });
    }

    return { data: evidence };
  });

  fastify.post<{ Params: { id: string } }>('/evidence/:id/verify-hash', { preHandler: requireScope('evidence.read') }, async (request, reply) => {
    const auth = (request as any).user as MctAuthContext;
    const result = await verifyHashChain(auth.tenantId, request.params.id);
    return { data: result };
  });

  fastify.get<{ Params: { controlId: string } }>(
    '/evidence/control/:controlId',
    { preHandler: requireScope('evidence.read') },
    async (request, reply) => {
      const auth = (request as any).user as MctAuthContext;
      const evidence = await searchEvidenceByControl(auth.tenantId, request.params.controlId);
      return { data: evidence, count: evidence.length };
    },
  );

  // ─── Governance API ──────────────────────────────────────────
  fastify.get('/governance/status', { preHandler: requireScope('governance.read') }, async (request, reply) => {
    const auth = (request as any).user as MctAuthContext;
    const { framework_id } = request.query as Record<string, any>;

    const status = await getGovernanceStatus(auth.tenantId, framework_id || 'iso-42001');
    return { data: status };
  });

  fastify.get('/governance/controls', { preHandler: requireScope('governance.read') }, async (request, reply) => {
    const auth = (request as any).user as MctAuthContext;
    const { framework_id } = request.query as Record<string, any>;

    const controls = await listControls(auth.tenantId, framework_id || 'iso-42001');
    return { data: controls, count: controls.length };
  });

  fastify.get<{ Params: { controlId: string } }>(
    '/governance/controls/:controlId/compliance',
    { preHandler: requireScope('governance.read') },
    async (request, reply) => {
      const auth = (request as any).user as MctAuthContext;
      const status = await checkComplianceStatus(auth.tenantId, request.params.controlId);
      return { data: status };
    },
  );

  // Noch nicht implementierte Tools als 501 ausliefern, nicht als 500 —
  // ein Agent soll unterscheiden können zwischen "geht noch nicht" und
  // "ist kaputt".
  fastify.setErrorHandler((error, request, reply) => {
    if (error.name === 'NotImplementedError') {
      return reply.code(501).send({ error: 'NOT_IMPLEMENTED', message: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'INTERNAL' });
  });

  // Start server
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`✓ MCP Governance Server running on http://${HOST}:${PORT}`);
    console.log('✓ POST to /health for status check');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();

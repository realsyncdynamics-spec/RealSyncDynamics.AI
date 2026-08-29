import Fastify from 'fastify';
import { testConnection } from './services/supabase.js';
import { authenticateRequest } from './auth/api-key.js';
import { MctAuthContext } from './types/index.js';
import {
  listEvidence,
  getEvidence,
  verifyHashChain,
  searchEvidenceByControl,
} from './tools/evidence.js';
import { getGovernanceStatus, listControls, checkComplianceStatus } from './tools/governance.js';

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
  });

  // Health check (no auth required)
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // ─── Evidence API ─────────────────────────────────────────
  fastify.get('/evidence', async (request, reply) => {
    const auth = (request as any).user as MctAuthContext;
    const { subject_ref, limit } = request.query as Record<string, any>;

    const evidence = await listEvidence(auth.tenantId, subject_ref, limit || 50);
    return { data: evidence, count: evidence.length };
  });

  fastify.get<{ Params: { id: string } }>('/evidence/:id', async (request, reply) => {
    const auth = (request as any).user as MctAuthContext;
    const evidence = await getEvidence(auth.tenantId, request.params.id);

    if (!evidence) {
      return reply.code(404).send({ error: 'Evidence not found' });
    }

    return { data: evidence };
  });

  fastify.post<{ Params: { id: string } }>('/evidence/:id/verify-hash', async (request, reply) => {
    const auth = (request as any).user as MctAuthContext;
    const result = await verifyHashChain(auth.tenantId, request.params.id);
    return { data: result };
  });

  fastify.get<{ Params: { controlId: string } }>(
    '/evidence/control/:controlId',
    async (request, reply) => {
      const auth = (request as any).user as MctAuthContext;
      const evidence = await searchEvidenceByControl(auth.tenantId, request.params.controlId);
      return { data: evidence, count: evidence.length };
    },
  );

  // ─── Governance API ──────────────────────────────────────────
  fastify.get('/governance/status', async (request, reply) => {
    const auth = (request as any).user as MctAuthContext;
    const { framework_id } = request.query as Record<string, any>;

    const status = await getGovernanceStatus(auth.tenantId, framework_id || 'iso-42001');
    return { data: status };
  });

  fastify.get('/governance/controls', async (request, reply) => {
    const auth = (request as any).user as MctAuthContext;
    const { framework_id } = request.query as Record<string, any>;

    const controls = await listControls(auth.tenantId, framework_id || 'iso-42001');
    return { data: controls, count: controls.length };
  });

  fastify.get<{ Params: { controlId: string } }>(
    '/governance/controls/:controlId/compliance',
    async (request, reply) => {
      const auth = (request as any).user as MctAuthContext;
      const status = await checkComplianceStatus(auth.tenantId, request.params.controlId);
      return { data: status };
    },
  );

  // Noch nicht implementierte Werkzeuge als 501 ausliefern, nicht als 500 —
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

import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { testConnection } from './services/supabase.js';
import { authenticateRequest, logRequestUsage, requireScope } from './auth/api-key.js';
import { getQuotaState, secondsUntilQuotaReset } from './services/api-keys-db.js';
import { RateLimitError } from './services/rate-window.js';
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

/**
 * Anfragen pro Minute und Herkunfts-IP, bevor überhaupt authentifiziert wird.
 *
 * Diese Schranke schützt den Auth-Pfad selbst: `validateApiKey` kostet eine
 * Datenbank-Rundreise pro Anfrage, und wer keinen gültigen Key hat, kommt bis
 * dorthin. Das Monatskontingent greift erst *nach* der Authentifizierung und
 * kann diesen Verkehr nicht abfangen — es kennt den Tenant ja noch nicht.
 */
const RATE_LIMIT_PER_IP = parseInt(process.env.MCP_RATE_LIMIT_PER_MINUTE || '120', 10);

/**
 * Höchstzahl JSON-RPC-Nachrichten in einem Stapel.
 *
 * Ohne diese Grenze liefe jede Ratenbegrenzung ins Leere: Sie zählt HTTP-
 * Anfragen, ein Stapel kann aber beliebig viele Werkzeugaufrufe in einer
 * einzigen Anfrage tragen.
 */
const MAX_BATCH_SIZE = parseInt(process.env.MCP_MAX_BATCH_SIZE || '20', 10);

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
    // Hinter Traefik ist die Absender-IP jeder Anfrage die des Proxys. Ohne
    // dieses Flag trügen alle Clients denselben Schlüssel und die
    // Ratenbegrenzung würde sie gemeinsam drosseln — ein einzelner Angreifer
    // sperrte damit alle übrigen aus. Standard ist `false`, weil das Vertrauen
    // in X-Forwarded-For nur dort berechtigt ist, wo der Dienst ausschließlich
    // über den Proxy erreichbar ist.
    trustProxy: process.env.TRUST_PROXY === 'true',
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

  // Hinter einem Proxy ohne TRUST_PROXY trägt jede Anfrage dieselbe IP. Die
  // Ratenbegrenzung greift dann zwar, aber für alle Clients gemeinsam — ein
  // einzelner Angreifer sperrte damit sämtliche Kunden aus. Das fällt im
  // Betrieb nicht von selbst auf, deshalb hier ein Hinweis beim Start.
  if (process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY !== 'true') {
    console.warn(
      '⚠ TRUST_PROXY ist nicht gesetzt. Läuft der Dienst hinter Traefik, zählt die ' +
        'Ratenbegrenzung alle Clients unter der Proxy-IP zusammen.',
    );
  }

  // Ratenbegrenzung.
  //
  // `global: false` ist hier wesentlich und nicht etwa eine Abschaltung: Mit
  // `global: true` hängt das Plugin seine Schranke in die *route-eigene*
  // onRequest-Kette. Die läuft nach den globalen Hooks — also nach der
  // Auth-Middleware. Genau der unauthentifizierte Verkehr, der begrenzt werden
  // soll, wäre dann längst mit 401 abgewiesen worden, ohne je gezählt zu
  // werden, und `validateApiKey` hätte für jede dieser Anfragen bereits eine
  // Datenbank-Rundreise ausgelöst. Ein Test hält diese Reihenfolge fest.
  //
  // Stattdessen wird die Schranke als eigener globaler Hook vor die
  // Authentifizierung gesetzt. Route-eigene `config.rateLimit`-Angaben bleiben
  // davon unberührt und gelten zusätzlich.
  await fastify.register(rateLimit, { global: false });

  // Der Schlüssel kann an dieser Stelle nur die IP sein: Der Tenant steht erst
  // nach der Authentifizierung fest. Die Zählung liegt im Prozessspeicher —
  // bei mehreren Instanzen gilt sie je Instanz. Für eine gemeinsame Schranke
  // bräuchte es einen Redis-Store; der ist bewusst nicht eingebaut, weil der
  // Dienst derzeit als eine Instanz läuft.
  const ipRateLimit = fastify.rateLimit({
    max: RATE_LIMIT_PER_IP,
    timeWindow: '1 minute',
    // Das Plugin *wirft*, was dieser Erbauer zurückgibt. Ein einfaches Objekt
    // liefe in den allgemeinen Fehlerzweig und käme als 500 beim Aufrufer an —
    // eine Drosselung, die sich als Serverfehler ausgibt. Deshalb dieselbe
    // Fehlerklasse wie bei der engeren Schranke: beide 429 haben damit
    // denselben Aufbau, egal woher sie stammen.
    errorResponseBuilder: (_request, context) =>
      new RateLimitError(
        `Zu viele Anfragen (${context.max} pro ${context.after}). Bitte drosseln.`,
        Math.max(1, Math.ceil(context.ttl / 1000)),
      ),
  });

  fastify.addHook('onRequest', async (request, reply) => {
    // Der Health-Endpunkt wird vom Container-Healthcheck getaktet und darf
    // nicht am selben Kontingent hängen wie fachliche Aufrufe.
    if (request.url === '/health') return;
    // `.call` mit der Instanz: Der Hook des Plugins erwartet `this` als
    // FastifyInstance, weil er darüber an Logger und Store kommt.
    await ipRateLimit.call(fastify, request, reply);
  });

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
      // Abgewiesen mit 429 — am Monatskontingent oder an der Ratenbegrenzung:
      // gehört in den Prüfpfad, aber nicht in die Verbrauchszahl. Sonst zählt
      // ein Agent in einer Schleife Aufrufe mit, für die er nie eine Antwort
      // bekommen hat, und drosselt sich zusätzlich selbst aus dem Kontingent.
      countAgainstQuota: reply.statusCode !== 429,
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
    // Ohne diese Grenze wäre die Ratenbegrenzung wirkungslos: sie zählt
    // HTTP-Anfragen, ein Stapel trüge aber beliebig viele Werkzeugaufrufe in
    // einer einzigen. Abgewiesen wird der ganze Stapel, nicht der Überhang —
    // eine halb ausgeführte Anfrage wäre für den Aufrufer nicht zu deuten.
    if (messages.length > MAX_BATCH_SIZE) {
      return reply
        .code(413)
        .send(
          rpcError(
            null,
            RpcCode.INVALID_REQUEST,
            `Stapel zu groß: ${messages.length} Nachrichten, erlaubt sind ${MAX_BATCH_SIZE}.`,
          ),
        );
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

  fastify.post<{ Params: { id: string } }>(
    '/evidence/:id/verify-hash',
    // Die engere Schranke für diesen Aufruf sitzt in `verifyHashChain` selbst,
    // nicht hier: dieselbe Prüfung ist auch über `/mcp` erreichbar, und eine
    // an die Route gehängte Schranke ließe diesen Weg offen.
    { preHandler: requireScope('evidence.read') },
    async (request, reply) => {
      const auth = (request as any).user as MctAuthContext;
      const result = await verifyHashChain(auth.tenantId, request.params.id);
      return { data: result };
    },
  );

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
    if (error instanceof RateLimitError) {
      return reply
        .code(429)
        .header('Retry-After', String(error.retryAfterSeconds))
        .send({
          error: 'RATE_LIMITED',
          message: error.message,
          retry_after_seconds: error.retryAfterSeconds,
        });
    }
    // Fehler, die bereits einen 4xx-Code tragen, behalten ihn. Ohne das würde
    // jede künftige Client-Fehlermeldung aus einem Plugin als Serverfehler
    // ausgeliefert — der Aufrufer könnte dann nicht unterscheiden, ob er selbst
    // etwas falsch gemacht hat oder der Dienst kaputt ist.
    const status = (error as { statusCode?: number }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply.code(status).send({ error: error.name || 'BAD_REQUEST', message: error.message });
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

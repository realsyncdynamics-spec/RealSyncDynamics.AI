import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';

const { consume, enforce, RateLimitError, resetWindows } = await import(
  '../src/services/rate-window.js'
);

/**
 * Prüft die Verdrahtung der Ratenbegrenzung aus `src/index.ts`.
 *
 * Der Aufbau wird hier nachgebaut statt importiert: `src/index.ts` startet den
 * Server beim Import und verlangt eine erreichbare Supabase-Instanz. Geprüft
 * wird deshalb die *Kompositionsregel*, auf der die Umsetzung beruht — nicht
 * die laufende Instanz. Fällt eine dieser Annahmen, ist die Begrenzung im
 * Produktivpfad ebenso still wirkungslos:
 *
 *  1. Die globale Schranke greift, bevor die Auth-Middleware eine
 *     Datenbank-Rundreise auslöst.
 *  2. Eine route-eigene Schranke sieht `request.user` — nur dann kann sie je
 *     Tenant zählen statt je IP.
 *  3. `/health` hängt nicht am selben Kontingent.
 */

// Die IP-Schranke muss hier deutlich über der Tenant-Schranke liegen, sonst
// prüft der Tenant-Test in Wahrheit die IP-Schranke: Wären beide gleich eng,
// hätte Tenant A mit seinen Aufrufen bereits das IP-Kontingent aufgebraucht
// und Tenant B liefe unabhängig vom Schlüssel in dieselbe 429.
const PER_IP = 10;
const PER_TENANT = 2;

/** Baut eine Instanz in derselben Reihenfolge wie `src/index.ts`. */
async function buildTestServer(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({ logger: false });

  // global: false — sonst hängt die Schranke in der route-eigenen Hook-Kette
  // und liefe erst nach der Auth-Middleware.
  await app.register(rateLimit, { global: false });

  const ipRateLimit = app.rateLimit({
    max: PER_IP,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) =>
      new RateLimitError('Zu viele Anfragen', Math.max(1, Math.ceil(context.ttl / 1000))),
  });
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health') return;
    await ipRateLimit.call(app, request, reply);
  });

  // Steht für authenticateRequest: setzt den Tenant aus dem Bearer-Token.
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health') return;
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    (request as any).authCalls = true;
    (request as any).user = { tenantId: header.substring(7), scopes: ['evidence.read'] };
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/evidence', async () => ({ data: [] }));

  // Die engere Schranke liegt im Aufruf selbst, nicht in der Route-Konfiguration
  // — genau wie in `verifyHashChain`.
  app.post('/verify', async (request) => {
    enforce(`verify:${(request as any).user.tenantId}`, PER_TENANT, 60_000, 'Kettenprüfung');
    return { ok: true };
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof RateLimitError) {
      return reply
        .code(429)
        .header('Retry-After', String(error.retryAfterSeconds))
        .send({ error: 'RATE_LIMITED' });
    }
    return reply.code(500).send({ error: 'INTERNAL' });
  });

  await app.ready();
  return app;
}

test('globale Schranke greift vor der Authentifizierung', async () => {
  const app = await buildTestServer();
  const statuses: number[] = [];

  // Ohne Authorization-Header: ohne Schranke liefe jede dieser Anfragen in die
  // Auth-Middleware und damit in eine Datenbankabfrage.
  for (let i = 0; i < PER_IP + 2; i++) {
    const res = await app.inject({ method: 'GET', url: '/evidence' });
    statuses.push(res.statusCode);
  }

  assert.deepEqual(statuses.slice(0, PER_IP), Array(PER_IP).fill(401));
  assert.deepEqual(statuses.slice(PER_IP), [429, 429]);
  await app.close();
});

test('429 der globalen Schranke trägt Retry-After', async () => {
  const app = await buildTestServer();
  for (let i = 0; i < PER_IP; i++) await app.inject({ method: 'GET', url: '/evidence' });

  const res = await app.inject({ method: 'GET', url: '/evidence' });
  assert.equal(res.statusCode, 429);
  assert.ok(res.headers['retry-after'], 'Retry-After fehlt — der Client kann nicht sinnvoll warten');
  await app.close();
});

test('engere Schranke zählt je Tenant, nicht je IP', async () => {
  resetWindows();
  const app = await buildTestServer();

  // Tenant A schöpft seine engere Schranke aus.
  for (let i = 0; i < PER_TENANT; i++) {
    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      headers: { authorization: 'Bearer tenant-a' },
    });
    assert.equal(res.statusCode, 200);
  }

  const blocked = await app.inject({
    method: 'POST',
    url: '/verify',
    headers: { authorization: 'Bearer tenant-a' },
  });
  assert.equal(blocked.statusCode, 429, 'Tenant A hätte gedrosselt werden müssen');

  // Tenant B kommt von derselben IP und darf davon unberührt bleiben. Schlägt
  // das fehl, sah der keyGenerator kein request.user und fiel auf die IP
  // zurück — dann teilen sich alle Kunden ein Kontingent.
  const other = await app.inject({
    method: 'POST',
    url: '/verify',
    headers: { authorization: 'Bearer tenant-b' },
  });
  assert.equal(other.statusCode, 200, 'Tenant B darf von Tenant A nicht mitgedrosselt werden');

  await app.close();
});

test('das Fenster läuft ab und gibt das Kontingent wieder frei', () => {
  resetWindows();
  const t0 = 1_000_000;
  assert.equal(consume('t', 1, 60_000, t0).allowed, true);
  assert.equal(consume('t', 1, 60_000, t0 + 1_000).allowed, false);
  // Nach Fensterende wieder offen — sonst wäre eine einmal überschrittene
  // Schranke dauerhaft gesperrt.
  assert.equal(consume('t', 1, 60_000, t0 + 60_001).allowed, true);
});

test('abgelaufene Fenster werden aufgeräumt', () => {
  resetWindows();
  const t0 = 2_000_000;
  for (let i = 0; i < 500; i++) consume(`tenant-${i}`, 5, 60_000, t0);
  // Ein Aufruf nach Fensterende räumt die alten Einträge ab. Ohne das wüchse
  // die Map mit jedem je gesehenen Schlüssel.
  consume('spaeter', 5, 60_000, t0 + 60_001);
  // Der erste Tenant muss wieder bei 1 anfangen — sein Fenster ist weg.
  const again = consume('tenant-0', 1, 60_000, t0 + 60_002);
  assert.equal(again.allowed, true);
});

test('Retry-After der engeren Schranke ist nie null', () => {
  resetWindows();
  const t0 = 3_000_000;
  consume('x', 1, 60_000, t0);
  const blocked = consume('x', 1, 60_000, t0 + 59_999);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1, 'Wartezeit 0 lüde zum sofortigen Wiederholen ein');
});

test('enforce wirft RateLimitError mit Wartezeit', () => {
  resetWindows();
  enforce('e', 1, 60_000, 'Kettenprüfung');
  assert.throws(
    () => enforce('e', 1, 60_000, 'Kettenprüfung'),
    (err: unknown) =>
      err instanceof RateLimitError && err.retryAfterSeconds >= 1 && err.name === 'RateLimitError',
  );
});

test('/health hängt nicht am Kontingent', async () => {
  const app = await buildTestServer();

  // Deutlich über der globalen Schranke — der Container-Healthcheck taktet
  // häufiger als fachliche Aufrufe und darf den Dienst nicht aussperren.
  for (let i = 0; i < PER_IP * 3; i++) {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
  }
  await app.close();
});

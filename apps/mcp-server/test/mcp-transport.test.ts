import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';

const { acceptHeaderFor, dispatchMcpRequest, PROTOCOL_VERSION } = await import('../src/mcp/protocol.js');

type Ctx = Parameters<typeof dispatchMcpRequest>[1];

function ctx(): Ctx {
  return {
    tools: [
      {
        name: 'evidence_list',
        scope: 'evidence.read',
        description: 'Listet Nachweise.',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
    scopes: ['evidence.read'],
    serverName: 'realsync-mcp-governance',
    serverVersion: '0.1.0',
    invoke: async (name) => ({ content: [{ type: 'text' as const, text: `ok:${name}` }] }),
  };
}

const ping = { jsonrpc: '2.0' as const, id: 1, method: 'ping' };

test('fehlender Accept-Header bleibt für bestehende JSON-Clients annehmbar', async () => {
  const outcome = await dispatchMcpRequest(ping, ctx());
  assert.equal(outcome.status, 200);
  assert.deepEqual(outcome.body, { jsonrpc: '2.0', id: 1, result: {} });
});

test('Accept nur application/json wird ergänzt, die Antwort bleibt JSON', async () => {
  assert.match(acceptHeaderFor('application/json'), /text\/event-stream/);
  const outcome = await dispatchMcpRequest(ping, ctx(), { accept: 'application/json' });
  assert.equal(outcome.status, 200);
  const body = outcome.body as { result?: unknown };
  assert.deepEqual(body.result, {});
});

test('ein fremder Accept-Wert wird vom offiziellen Transport mit 406 abgelehnt', async () => {
  const outcome = await dispatchMcpRequest(ping, ctx(), { accept: 'text/html' });
  assert.equal(outcome.status, 406);
  const body = outcome.body as { error?: { code: number } };
  assert.equal(body.error?.code, -32000);
});

test('ein Stapel aus zwei Anfragen kommt als JSON-Array zurück', async () => {
  const outcome = await dispatchMcpRequest(
    [ping, { jsonrpc: '2.0', id: 2, method: 'tools/list' }],
    ctx(),
  );
  assert.equal(outcome.status, 200);
  assert.ok(Array.isArray(outcome.body));
  const bodies = outcome.body as Array<{ id: number; result: { tools?: Array<{ name: string }> } }>;
  assert.deepEqual(
    bodies.map((entry) => entry.id),
    [1, 2],
  );
  assert.deepEqual(bodies[1].result.tools?.map((tool) => tool.name), ['evidence_list']);
});

test('Benachrichtigungen ohne Anfrage antworten mit 202', async () => {
  const outcome = await dispatchMcpRequest(
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    ctx(),
  );
  assert.equal(outcome.status, 202);
  assert.equal(outcome.body, undefined);
});

test('unbekannte Protokollfassung fällt auf die Fassung des SDK zurück', async () => {
  const outcome = await dispatchMcpRequest(
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '1999-01-01',
        capabilities: {},
        clientInfo: { name: 'test', version: '0' },
      },
    },
    ctx(),
  );
  assert.equal(outcome.status, 200);
  const body = outcome.body as { result: { protocolVersion: string; serverInfo: { name: string } } };
  assert.equal(body.result.protocolVersion, PROTOCOL_VERSION);
  assert.equal(body.result.serverInfo.name, 'realsync-mcp-governance');
});

test('eine nicht unterstützte mcp-protocol-version wird abgelehnt', async () => {
  const outcome = await dispatchMcpRequest(ping, ctx(), { protocolVersion: '1999-01-01' });
  assert.equal(outcome.status, 400);
});

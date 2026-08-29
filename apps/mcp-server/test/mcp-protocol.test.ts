import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';

const { handleMessage, isJsonRpcRequest, PROTOCOL_VERSION, RpcCode } = await import(
  '../src/mcp/protocol.js'
);

type Ctx = Parameters<typeof handleMessage>[1];

const TOOLS: Ctx['tools'] = [
  {
    name: 'evidence_list',
    scope: 'evidence.read',
    description: 'Listet Nachweise.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'governance_status',
    scope: 'governance.read',
    description: 'Compliance-Stand.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function ctx(scopes: string[], invoke?: Ctx['invoke']): Ctx {
  return {
    tools: TOOLS,
    scopes,
    serverName: 'realsync-mcp-governance',
    serverVersion: '0.1.0',
    invoke:
      invoke ??
      (async (name) => ({ content: [{ type: 'text' as const, text: `ok:${name}` }] })),
  };
}

test('initialize bestätigt eine unterstützte Protokollfassung des Clients', async () => {
  const res = await handleMessage(
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
    ctx(['evidence.read']),
  );
  const result = res?.result as { protocolVersion: string; capabilities: Record<string, unknown> };
  assert.equal(result.protocolVersion, '2025-03-26');
  // Nur Werkzeuge — was hier nicht steht, darf der Client nicht anfragen.
  assert.deepEqual(Object.keys(result.capabilities), ['tools']);
});

test('initialize fällt bei unbekannter Fassung auf die eigene zurück', async () => {
  const res = await handleMessage(
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } },
    ctx(['evidence.read']),
  );
  assert.equal((res?.result as { protocolVersion: string }).protocolVersion, PROTOCOL_VERSION);
});

test('Benachrichtigungen bleiben unbeantwortet', async () => {
  // Ohne id erwartet der Client keine Antwort; eine zu senden bricht den
  // Handshake bei strengen Clients.
  for (const method of ['notifications/initialized', 'notifications/cancelled']) {
    assert.equal(await handleMessage({ jsonrpc: '2.0', method }, ctx([])), null);
  }
});

test('tools/list zeigt nur Werkzeuge, für die der Key den Scope hat', async () => {
  const res = await handleMessage(
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    ctx(['evidence.read']),
  );
  const { tools } = res?.result as { tools: Array<{ name: string }> };
  assert.deepEqual(tools.map((t) => t.name), ['evidence_list']);
});

test('tools/list gibt keine internen Felder preis', async () => {
  const res = await handleMessage(
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    ctx(['evidence.read', 'governance.read']),
  );
  const { tools } = res?.result as { tools: Array<Record<string, unknown>> };
  for (const t of tools) {
    assert.deepEqual(Object.keys(t).sort(), ['description', 'inputSchema', 'name']);
  }
});

test('tools/call ohne passenden Scope liefert ein Fehler-Ergebnis, keinen RPC-Fehler', async () => {
  // Als JSON-RPC-Fehler sähe das Modell die Begründung nicht.
  const res = await handleMessage(
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'governance_status' } },
    ctx(['evidence.read']),
  );
  assert.equal(res?.error, undefined);
  const result = res?.result as { isError: boolean; content: Array<{ text: string }> };
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /governance\.read/);
});

test('tools/call reicht Argumente durch und liefert das Ergebnis', async () => {
  let gesehen: Record<string, unknown> | undefined;
  const res = await handleMessage(
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'evidence_list', arguments: { limit: 5 } },
    },
    ctx(['evidence.read'], async (_name, args) => {
      gesehen = args;
      return { content: [{ type: 'text' as const, text: 'fertig' }] };
    }),
  );
  assert.deepEqual(gesehen, { limit: 5 });
  assert.equal((res?.result as { content: Array<{ text: string }> }).content[0].text, 'fertig');
});

test('Ein geworfener Fehler wird zum Ergebnis mit isError, nicht zum RPC-Fehler', async () => {
  const res = await handleMessage(
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'evidence_list' } },
    ctx(['evidence.read'], async () => {
      throw new Error('governance.get_status ist noch nicht implementiert');
    }),
  );
  assert.equal(res?.error, undefined);
  const result = res?.result as { isError: boolean; content: Array<{ text: string }> };
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /nicht implementiert/);
});

test('Unbekanntes Werkzeug ist ein Protokollfehler', async () => {
  const res = await handleMessage(
    { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'gibts_nicht' } },
    ctx(['evidence.read']),
  );
  assert.equal(res?.error?.code, RpcCode.INVALID_PARAMS);
});

test('Unbekannte Methode ergibt METHOD_NOT_FOUND', async () => {
  const res = await handleMessage(
    { jsonrpc: '2.0', id: 7, method: 'resources/list' },
    ctx(['evidence.read']),
  );
  assert.equal(res?.error?.code, RpcCode.METHOD_NOT_FOUND);
});

test('isJsonRpcRequest weist Fremdkörper ab', () => {
  assert.equal(isJsonRpcRequest({ jsonrpc: '2.0', method: 'ping' }), true);
  assert.equal(isJsonRpcRequest({ jsonrpc: '1.0', method: 'ping' }), false);
  assert.equal(isJsonRpcRequest({ method: 'ping' }), false);
  assert.equal(isJsonRpcRequest(null), false);
  assert.equal(isJsonRpcRequest('ping'), false);
});

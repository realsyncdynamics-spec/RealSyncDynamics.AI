/**
 * MCP-Protokoll über das offizielle SDK (`@modelcontextprotocol/sdk`, MIT).
 *
 * Der Dienst bleibt bei Fastify. Das SDK übernimmt Handshake, JSON-RPC und
 * die Streamable-HTTP-Nachrichtenhülle (`WebStandardStreamableHTTPServerTransport`,
 * zustandslos, JSON statt SSE). Auth, Scopes, Kontingent und die
 * Werkzeugausführung liegen weiterhin hier — das SDK kennt keinen Tenant.
 *
 * Pro HTTP-Anfrage entstehen Server und Transport neu. Das SDK verbietet,
 * einen zustandslosen Transport wiederzuverwenden, und ein geteilter Server
 * würde parallele Aufrufe über denselben Handshake-Zustand schicken.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  LATEST_PROTOCOL_VERSION,
  ListToolsRequestSchema,
  McpError,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

/** Neueste vom SDK gesprochene Fassung. Bekannte ältere Fassungen werden bestätigt. */
export const PROTOCOL_VERSION = LATEST_PROTOCOL_VERSION;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  /** Fehlt bei Benachrichtigungen — dann erwartet der Client keine Antwort. */
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

/** Fehlercodes nach JSON-RPC 2.0 — dieselben Zahlen wie `ErrorCode` im SDK. */
export const RpcCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export interface McpToolDefinition {
  name: string;
  description: string;
  /** JSON Schema der Argumente. */
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Scope, den ein Key für dieses Werkzeug tragen muss. */
  scope: string;
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export type ToolInvoker = (
  name: string,
  args: Record<string, unknown>,
) => Promise<McpToolResult>;

export interface HandlerContext {
  tools: McpToolDefinition[];
  invoke: ToolInvoker;
  /** Scopes des verwendeten API-Keys. */
  scopes: string[];
  serverName: string;
  serverVersion: string;
}

export interface McpHttpHeaders {
  /** Rohwert von `Accept`. Fehlt er, wird der vom SDK verlangte Wert ergänzt. */
  accept?: string;
  contentType?: string;
  protocolVersion?: string;
}

export interface McpHttpOutcome {
  status: number;
  body: unknown;
}

export function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } };
}

/**
 * Accept-Wert für den offiziellen Transport.
 *
 * Die Spec verlangt `application/json` und `text/event-stream`. Bestehende
 * Aufrufer (curl, interne Agenten) senden das oft nicht. Fehlt der Header
 * oder nennt er nur JSON, wird `text/event-stream` ergänzt — die Antwort
 * bleibt JSON (`enableJsonResponse`), es wird kein SSE-Strom geöffnet.
 * Ein ausdrücklich anderer Accept-Wert geht unverändert ans SDK und wird
 * dort mit 406 abgelehnt.
 */
export function acceptHeaderFor(accept: string | undefined): string {
  if (!accept?.trim()) return 'application/json, text/event-stream';
  const hasJson = accept.includes('application/json');
  const hasSse = accept.includes('text/event-stream');
  if (hasJson && hasSse) return accept;
  if (hasJson) return `${accept}, text/event-stream`;
  return accept;
}

/** Grobprüfung, ob ein Objekt als JSON-RPC-Nachricht durchgeht. */
export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.jsonrpc === '2.0' && typeof v.method === 'string';
}

function toCallToolResult(result: McpToolResult): CallToolResult {
  return {
    content: result.content.map((part) => ({ type: 'text' as const, text: part.text })),
    ...(result.isError ? { isError: true } : {}),
  };
}

function createGovernanceServer(ctx: HandlerContext): Server {
  const server = new Server(
    { name: ctx.serverName, version: ctx.serverVersion },
    // Nur Werkzeuge. Was hier nicht steht, darf der Client nicht anfragen.
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Werkzeuge ohne passenden Scope werden nicht angeboten: ein Modell soll
    // nichts vorgeschlagen bekommen, was anschliessend scheitert.
    const tools = ctx.tools
      .filter((tool) => ctx.scopes.includes(tool.scope))
      .map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const tool = ctx.tools.find((candidate) => candidate.name === name);

    if (!tool) {
      throw new McpError(ErrorCode.InvalidParams, `Unbekanntes Werkzeug: ${name}`);
    }
    if (!ctx.scopes.includes(tool.scope)) {
      // Fehlender Scope ist ein Ergebnis des Aufrufs, kein Protokollfehler —
      // so kann das Modell die Begründung sehen und dem Nutzer nennen.
      return toCallToolResult({
        content: [
          {
            type: 'text',
            text: `Dieser Key hat den Scope "${tool.scope}" nicht und darf ${name} nicht aufrufen.`,
          },
        ],
        isError: true,
      });
    }

    try {
      return toCallToolResult(await ctx.invoke(name, args));
    } catch (err) {
      // Fehler bei der Ausführung gehören ins Ergebnis, nicht in die
      // JSON-RPC-Fehlerhülle: der Client soll sie dem Modell zeigen können.
      return toCallToolResult({
        content: [{ type: 'text', text: (err as Error)?.message ?? 'Unbekannter Fehler' }],
        isError: true,
      });
    }
  });

  return server;
}

/**
 * Eine HTTP-POST-Hülle durch den offiziellen Streamable-HTTP-Transport.
 *
 * Zustandslos und JSON-Antworten: kein Sitzungs-Header, kein SSE. Stapel
 * verarbeitet das SDK; die engere Stapelgrenze des Dienstes prüft der
 * Aufrufer, bevor er hierher kommt.
 */
export async function dispatchMcpRequest(
  body: unknown,
  ctx: HandlerContext,
  headers?: McpHttpHeaders,
): Promise<McpHttpOutcome> {
  const server = createGovernanceServer(ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const requestHeaders = new Headers();
    requestHeaders.set('accept', acceptHeaderFor(headers?.accept));
    requestHeaders.set('content-type', headers?.contentType?.trim() || 'application/json');
    if (headers?.protocolVersion) {
      requestHeaders.set('mcp-protocol-version', headers.protocolVersion);
    }

    const request = new Request('http://mcp.local/mcp', {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body ?? null),
    });
    const response = await transport.handleRequest(request, { parsedBody: body });
    const text = await response.text();
    if (!text) return { status: response.status, body: undefined };
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return { status: response.status, body: JSON.parse(trimmed) as unknown };
    }
    return { status: response.status, body: text };
  } finally {
    await server.close().catch(() => undefined);
  }
}

/**
 * Eine einzelne JSON-RPC-Nachricht.
 *
 * Gibt `null` zurück, wenn es sich um eine Benachrichtigung handelt — darauf
 * antwortet der Transport mit 202 und leerem Rumpf.
 */
export async function handleMessage(
  message: JsonRpcRequest,
  ctx: HandlerContext,
): Promise<JsonRpcResponse | null> {
  const outcome = await dispatchMcpRequest(message, ctx);
  if (outcome.status === 202) return null;
  if (outcome.body && typeof outcome.body === 'object' && !Array.isArray(outcome.body)) {
    return outcome.body as JsonRpcResponse;
  }
  return rpcError(message.id ?? null, RpcCode.INTERNAL_ERROR, 'Leere MCP-Antwort');
}
